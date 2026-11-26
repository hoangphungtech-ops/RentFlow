import { BadRequestException, Body, Controller, Get, Header, Param, ParseUUIDPipe, Post, Query, Req, Res, StreamableFile, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { Prisma } from '@prisma/client';
import { createReadStream } from 'node:fs';
import type { Response } from 'express';
import { z } from 'zod';
import { actorSelect, db, passwordHash, SessionGuard, SessionRequest } from './auth';
import { imagePath, optimizeImage, UploadedImage } from './room-images';
import { allow, atomic, audit, day, found, id, label, leaseScope, meter, notify, parse, period, propertyScope, requireCondition } from './rules';

const managerRoles = ['OWNER', 'MANAGER', 'STAFF'] as const;
const openListing = { listingStatus: 'PUBLISHED', status: 'AVAILABLE', bookingRequests: { none: { holdFlag: 1 } } } as const;
const imageSelect = { id: true, alt: true, isPrimary: true } as const;
const listingSelect = {
  id: true, roomCode: true, baseRentPrice: true, maxOccupants: true, floorArea: true, listingTitle: true, amenities: true, status: true, listingStatus: true,
  property: { select: { name: true, address: true, id: true } },
  images: { select: imageSelect, orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] },
} satisfies Prisma.RoomSelect;
const bookingLinks = { room: { select: { id: true, roomCode: true, property: { select: { name: true, address: true } } } } };
const maintenanceLinks = { lease: { select: { id: true, room: { select: { roomCode: true, propertyId: true, property: { select: { name: true } } } } } } };

@Controller('auth')
export class RentFlowRegistration {
  @Post('register')
  async register(@Body() body: unknown) {
    const input = parse(z.object({ email: z.email().max(254), fullName: label(120), password: z.string().min(12).max(128) }).strict(), body);
    return db.user.create({ data: {
      email: input.email.toLowerCase(), fullName: input.fullName, passwordHash: passwordHash(input.password), role: 'RENTER',
    }, select: { id: true, email: true } });
  }
}

@UseGuards(SessionGuard)
@Controller('v10')
export class RentFlowV10Controller {
  @Get('me')
  @Header('Cache-Control', 'private, no-store')
  me(@Req() { actor }: SessionRequest) {
    return { ...actor, portal: ({ ADMIN: 'admin', OWNER: 'owner', MANAGER: 'manager', STAFF: 'staff', ACCOUNTANT: 'accountant', RENTER: 'user' } as const)[actor.role] };
  }

  @Get('admin')
  async admin(@Req() { actor }: SessionRequest) {
    allow(actor, 'ADMIN');
    const [users, rooms, properties, applications, auditTrail, maintenance, bookings] = await Promise.all([
      db.user.findMany({ select: { ...actorSelect, lockedAt: true }, orderBy: { createdAt: 'desc' }, take: 100 }),
      db.room.findMany({ select: listingSelect, orderBy: { updatedAt: 'desc' }, take: 100 }),
      db.property.findMany({ select: { id: true, name: true, address: true, _count: { select: { rooms: true } } }, take: 100 }),
      db.ownerApplication.findMany({ include: { user: { select: { fullName: true, email: true } } }, orderBy: { createdAt: 'desc' }, take: 100 }),
      db.audit.findMany({ orderBy: { createdAt: 'desc' }, take: 60 }),
      db.maintenanceRequest.findMany({ select: { id: true, title: true, status: true, ...maintenanceLinks }, orderBy: { createdAt: 'desc' }, take: 50 }),
      db.bookingRequest.findMany({ select: { id: true, status: true, kind: true, ...bookingLinks }, orderBy: { createdAt: 'desc' }, take: 50 }),
    ]);
    return { users, rooms, properties, applications, auditTrail, maintenance, bookings };
  }

  @Post('admin/users/:id')
  async adminAccount(@Req() { actor }: SessionRequest, @Param('id', ParseUUIDPipe) userId: string, @Body() body: unknown) {
    allow(actor, 'ADMIN');
    const { locked } = parse(z.object({ locked: z.boolean() }).strict(), body);
    return atomic(async tx => {
      found(await tx.user.findFirst({ where: { id: userId, role: { not: 'ADMIN' } } }));
      await tx.user.update({ where: { id: userId }, data: { lockedAt: locked ? new Date() : null } });
      if (locked) await tx.session.deleteMany({ where: { userId } });
      await audit(tx, actor, locked ? 'ADMIN_ACCOUNT_LOCKED' : 'ADMIN_ACCOUNT_UNLOCKED', userId);
      return { locked };
    });
  }

  @Post('admin/users/:id/role')
  async adminRole(@Req() { actor }: SessionRequest, @Param('id', ParseUUIDPipe) userId: string, @Body() body: unknown) {
    allow(actor, 'ADMIN');
    const { role } = parse(z.object({ role: z.enum(['MANAGER', 'STAFF', 'ACCOUNTANT']) }).strict(), body);
    return atomic(async tx => {
      const current = found(await tx.user.findFirst({ where: { id: userId, role: { in: ['MANAGER', 'STAFF', 'ACCOUNTANT'] } } }));
      const result = await tx.user.update({ where: { id: userId }, data: { role }, select: actorSelect });
      await tx.session.deleteMany({ where: { userId } });
      await audit(tx, actor, 'ADMIN_ROLE_UPDATED', userId, current.role + ' → ' + role);
      return result;
    });
  }

  @Post('owner-applications')
  async applyOwner(@Req() { actor }: SessionRequest, @Body() body: unknown) {
    allow(actor, 'RENTER');
    const { reason } = parse(z.object({ reason: label(500) }).strict(), body);
    return db.ownerApplication.create({ data: { userId: actor.id, reason } });
  }

  @Post('admin/owner-applications/:id')
  async reviewOwner(@Req() { actor }: SessionRequest, @Param('id', ParseUUIDPipe) applicationId: string, @Body() body: unknown) {
    allow(actor, 'ADMIN');
    const { approve } = parse(z.object({ approve: z.boolean() }).strict(), body);
    return atomic(async tx => {
      const application = found(await tx.ownerApplication.findFirst({ where: { id: applicationId, status: 'PENDING', user: { role: 'RENTER', lockedAt: null } } }));
      if (approve) {
        requireCondition(await tx.tenant.count({ where: { userId: application.userId } }) === 0, 'Dùng tài khoản chủ trọ riêng khi tài khoản này đã liên kết hồ sơ thuê.');
        await tx.user.update({ where: { id: application.userId }, data: { role: 'OWNER' } });
        await tx.session.deleteMany({ where: { userId: application.userId } });
      }
      const result = await tx.ownerApplication.update({ where: { id: applicationId }, data: { status: approve ? 'APPROVED' : 'REJECTED' } });
      await audit(tx, actor, 'ADMIN_OWNER_APPLICATION_REVIEWED', applicationId, result.status);
      return result;
    });
  }

  @Post('admin/rooms/:id')
  async moderate(@Req() { actor }: SessionRequest, @Param('id', ParseUUIDPipe) roomId: string, @Body() body: unknown) {
    allow(actor, 'ADMIN');
    const { approve } = parse(z.object({ approve: z.boolean() }).strict(), body);
    return atomic(async tx => {
      found(await tx.room.findFirst({ where: { id: roomId, listingStatus: 'PENDING' } }));
      const result = await tx.room.update({ where: { id: roomId }, data: { listingStatus: approve ? 'PUBLISHED' : 'REJECTED' }, select: listingSelect });
      await audit(tx, actor, 'ADMIN_ROOM_REVIEWED', roomId, result.listingStatus);
      return result;
    });
  }

  @Get('owner/operations')
  async ownerOperations(@Req() { actor }: SessionRequest) {
    allow(actor, 'OWNER');
    const scope = leaseScope(actor);
    const zone = 'Asia/Ho_Chi_Minh';
    const formatter = new Intl.DateTimeFormat('sv-SE', { timeZone: zone, year: 'numeric', month: '2-digit' });
    const [year, month] = formatter.format(new Date()).split('-').map(Number);
    const periods = Array.from({ length: 6 }, (_, index) =>
      new Date(Date.UTC(year, month - 6 + index, 1)).toISOString().slice(0, 7));
    const since = new Date(periods[0] + '-01T00:00:00+07:00');
    const [payments, openRepairs, recent] = await Promise.all([
      db.payment.findMany({ where: { status: 'CONFIRMED', method: { not: 'DEPOSIT' }, confirmedAt: { gte: since }, invoice: { lease: scope } }, select: { amount: true, confirmedAt: true } }),
      db.maintenanceRequest.count({ where: { lease: scope, status: { not: 'DONE' } } }),
      db.payment.findMany({
        where: { status: { in: ['CONFIRMED', 'PENDING'] }, invoice: { lease: scope } },
        select: { id: true, status: true, amount: true, createdAt: true, confirmedAt: true, invoice: { select: { lease: { select: { room: { select: { roomCode: true } } } } } } },
        orderBy: [{ confirmedAt: 'desc' }, { createdAt: 'desc' }], take: 6,
      }),
    ]);
    const totals = new Map(periods.map(period => [period, new Prisma.Decimal(0)]));
    for (const payment of payments) {
      if (!payment.confirmedAt) continue;
      const key = formatter.format(payment.confirmedAt);
      const current = totals.get(key);
      if (current) totals.set(key, current.add(payment.amount));
    }
    return { months: periods.map(period => ({ period, total: totals.get(period) })), openRepairs, recent };
  }

  @Get('manager')
  async manager(@Req() { actor }: SessionRequest) {
    allow(actor, ...managerRoles);
    const scope = propertyScope(actor);
    const [rooms, bookings, maintenance] = await Promise.all([
      db.room.findMany({ where: { property: scope }, select: listingSelect, orderBy: { updatedAt: 'desc' }, take: 100 }),
      db.bookingRequest.findMany({ where: { room: { property: scope } }, include: { ...bookingLinks, user: { select: { fullName: true } } }, orderBy: { createdAt: 'desc' }, take: 100 }),
      db.maintenanceRequest.findMany({ where: { lease: leaseScope(actor), ...(actor.role === 'STAFF' ? { assigneeId: actor.id } : {}) }, include: maintenanceLinks, orderBy: { createdAt: 'desc' }, take: 100 }),
    ]);
    const staff = actor.role === 'STAFF' ? [] : await db.propertyAccess.findMany({
      where: { property: scope, user: { role: 'STAFF', lockedAt: null } },
      select: { propertyId: true, user: { select: { id: true, fullName: true } } },
    });
    return { rooms, bookings: actor.role === 'STAFF' ? [] : bookings, maintenance, staff };
  }

  @Post('manager/properties/:id')
  async property(@Req() { actor }: SessionRequest, @Param('id', ParseUUIDPipe) propertyId: string, @Body() body: unknown) {
    allow(actor, 'OWNER');
    const data = parse(z.object({ name: label(150), address: label(255) }).strict(), body);
    return atomic(async tx => {
      found(await tx.property.findFirst({ where: { id: propertyId, ...propertyScope(actor) } }));
      const result = await tx.property.update({ where: { id: propertyId }, data });
      await audit(tx, actor, 'PROPERTY_UPDATED', propertyId);
      return result;
    });
  }

  @Post('manager/rooms/:id/listing')
  async publish(@Req() { actor }: SessionRequest, @Param('id', ParseUUIDPipe) roomId: string, @Body() body: unknown) {
    allow(actor, 'OWNER', 'MANAGER', 'STAFF');
    const { floorArea, amenities, listingTitle } = parse(z.object({ listingTitle: label(150).optional(), floorArea: z.number().min(1).max(10000), amenities: label(500).optional() }).strict(), body);
    return atomic(async tx => {
      found(await tx.room.findFirst({ where: { id: roomId, property: propertyScope(actor) } }));
      const result = await tx.room.update({ where: { id: roomId }, data: { floorArea, amenities: amenities ?? null, listingTitle, listingStatus: 'PENDING' }, select: listingSelect });
      await audit(tx, actor, 'ROOM_LISTING_SUBMITTED', roomId);
      return result;
    });
  }

  @Get('listings')
  async search(@Req() { actor }: SessionRequest, @Query() query: unknown) {
    allow(actor, 'RENTER');
    const { area, max, catalogue } = parse(z.object({ catalogue: z.literal('1').optional(), area: z.string().trim().max(120).optional(), max: z.coerce.number().int().min(0).max(9999999999).optional() }), query);
    return db.room.findMany({ where: { ...(catalogue ? { listingStatus: 'PUBLISHED', bookingRequests: { none: { holdFlag: 1 } } } as const : openListing), property: area ? { OR: [{ name: { contains: area } }, { address: { contains: area } }] } : undefined, baseRentPrice: max === undefined ? undefined : { lte: max } }, select: listingSelect, orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }], take: 100 });
  }

  @Get('listings/:id')
  async listing(@Req() { actor }: SessionRequest, @Param('id', ParseUUIDPipe) roomId: string) {
    allow(actor, 'RENTER');
    return found(await db.room.findFirst({ where: { id: roomId, ...openListing }, select: listingSelect }));
  }

  @Get('listing-photos/:room/:photo')
  async listingPhoto(@Req() { actor }: SessionRequest, @Param('room', ParseUUIDPipe) roomId: string, @Param('photo', ParseUUIDPipe) photoId: string, @Res({ passthrough: true }) response: Response) {
    const scope = actor.role === 'ADMIN' ? {} : actor.role === 'RENTER' ? { listingStatus: 'PUBLISHED' as const, bookingRequests: { none: { holdFlag: 1 } } } : { property: propertyScope(actor) };
    const image = found(await db.roomImage.findFirst({ where: { id: photoId, roomId, room: scope } }));
    response.set({ 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
    return new StreamableFile(createReadStream(imagePath(image.storageKey)), { type: image.mimeType, disposition: 'inline' });
  }

  @Get('user')
  async user(@Req() { actor }: SessionRequest) {
    allow(actor, 'RENTER');
    const [bookings, maintenance, application] = await Promise.all([
      db.bookingRequest.findMany({ where: { userId: actor.id }, include: bookingLinks, orderBy: { createdAt: 'desc' }, take: 100 }),
      db.maintenanceRequest.findMany({ where: { userId: actor.id, lease: leaseScope(actor) }, include: maintenanceLinks, orderBy: { createdAt: 'desc' }, take: 100 }),
      db.ownerApplication.findUnique({ where: { userId: actor.id }, select: { status: true } }),
    ]);
    return { bookings, maintenance, application };
  }

  @Post('listings/:id/bookings')
  async requestRoom(@Req() { actor }: SessionRequest, @Param('id', ParseUUIDPipe) roomId: string, @Body() body: unknown) {
    allow(actor, 'RENTER');
    const data = parse(z.object({ kind: z.enum(['VIEW', 'RENT']), visitDate: day.optional(), note: label(500) }).strict(), body);
    return atomic(async tx => {
      found(await tx.room.findFirst({ where: { id: roomId, ...openListing } }));
      requireCondition(!await tx.bookingRequest.findFirst({ where: { roomId, userId: actor.id, kind: data.kind, status: { in: ['PENDING', 'APPROVED', 'CONFIRMED'] } } }), 'Bạn đã có yêu cầu đang xử lý.');
      return tx.bookingRequest.create({ data: { ...data, roomId, userId: actor.id } });
    });
  }

  @Get('bookings/:id/messages')
  async bookingMessages(@Req() { actor }: SessionRequest, @Param('id', ParseUUIDPipe) bookingId: string) {
    const scope = this.bookingConversationScope(actor);
    found(await db.bookingRequest.findFirst({ where: { id: bookingId, ...scope }, select: { id: true } }));
    const messages = await db.bookingMessage.findMany({
      where: { bookingId, booking: scope },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 100,
      select: { id: true, body: true, createdAt: true, author: { select: { fullName: true } } },
    });
    return messages.reverse();
  }

  @Post('bookings/:id/messages')
  async sendBookingMessage(@Req() { actor }: SessionRequest, @Param('id', ParseUUIDPipe) bookingId: string, @Body() body: unknown) {
    const scope = this.bookingConversationScope(actor);
    const { message } = parse(z.object({ message: label(1000) }).strict(), body);
    return atomic(async tx => {
      found(await tx.bookingRequest.findFirst({ where: { id: bookingId, ...scope }, select: { id: true } }));
      return tx.bookingMessage.create({
        data: { bookingId, authorId: actor.id, body: message },
        select: { id: true, body: true, createdAt: true, author: { select: { fullName: true } } },
      });
    });
  }

  private bookingConversationScope(actor: SessionRequest['actor']): Prisma.BookingRequestWhereInput {
    allow(actor, 'RENTER', 'OWNER', 'MANAGER');
    return actor.role === 'RENTER' ? { userId: actor.id } : { room: { property: propertyScope(actor) } };
  }

  @Post('manager/bookings/:id')
  async reviewBooking(@Req() { actor }: SessionRequest, @Param('id', ParseUUIDPipe) bookingId: string, @Body() body: unknown) {
    allow(actor, 'OWNER', 'MANAGER', 'STAFF');
    const { approve } = parse(z.object({ approve: z.boolean() }).strict(), body);
    return atomic(async tx => {
      const row = found(await tx.bookingRequest.findFirst({ where: { id: bookingId, status: { in: approve ? ['PENDING'] : ['PENDING', 'APPROVED', 'CONFIRMED'] }, room: { property: propertyScope(actor) } }, include: { room: true } }));
      if (approve) requireCondition(row.room.status === 'AVAILABLE' && row.room.listingStatus === 'PUBLISHED', 'Phòng không còn nhận yêu cầu.');
      const result = await tx.bookingRequest.update({ where: { id: bookingId }, data: { status: approve ? 'APPROVED' : 'REJECTED', holdFlag: approve && row.kind === 'RENT' ? 1 : null } });
      await audit(tx, actor, 'BOOKING_REVIEWED', bookingId, result.status);
      return result;
    });
  }

  @Post('user/bookings/:id/confirm')
  async confirmBooking(@Req() { actor }: SessionRequest, @Param('id', ParseUUIDPipe) bookingId: string) {
    allow(actor, 'RENTER');
    return atomic(async tx => {
      const row = found(await tx.bookingRequest.findFirst({ where: { id: bookingId, userId: actor.id, status: 'APPROVED' }, include: { room: true } }));
      if (row.kind === 'RENT') {
        requireCondition(row.room.status === 'AVAILABLE', 'Phòng không còn trống.');
        const profile = await tx.tenant.findFirst({ where: { userId: actor.id, propertyId: row.room.propertyId } });
        if (!profile) await tx.tenant.create({ data: { propertyId: row.room.propertyId, userId: actor.id, fullName: actor.fullName } });
      }
      return tx.bookingRequest.update({ where: { id: bookingId }, data: { status: 'CONFIRMED' } });
    });
  }

  @Post('user/leases/:id/maintenance')
  async maintenance(@Req() { actor }: SessionRequest, @Param('id', ParseUUIDPipe) leaseId: string, @Body() body: unknown) {
    allow(actor, 'RENTER');
    const data = parse(z.object({ title: label(120), description: label(1000) }).strict(), body);
    return atomic(async tx => {
      found(await tx.lease.findFirst({ where: { id: leaseId, status: 'ACTIVE', ...leaseScope(actor) } }));
      return tx.maintenanceRequest.create({ data: { ...data, leaseId, userId: actor.id } });
    });
  }

  @Post('manager/maintenance/:id/assign')
  async assignMaintenance(@Req() { actor }: SessionRequest, @Param('id', ParseUUIDPipe) ticketId: string, @Body() body: unknown) {
    allow(actor, 'OWNER', 'MANAGER');
    const { assigneeId } = parse(z.object({ assigneeId: id }).strict(), body);
    return atomic(async tx => {
      const ticket = found(await tx.maintenanceRequest.findFirst({ where: { id: ticketId, lease: leaseScope(actor), status: { not: 'DONE' } }, include: { lease: { select: { room: { select: { propertyId: true } } } } } }));
      found(await tx.propertyAccess.findFirst({ where: { propertyId: ticket.lease.room.propertyId, userId: assigneeId, user: { role: 'STAFF', lockedAt: null } } }));
      const result = await tx.maintenanceRequest.update({ where: { id: ticketId }, data: { assigneeId } });
      await audit(tx, actor, 'MAINTENANCE_ASSIGNED', ticketId, assigneeId);
      return result;
    });
  }

  @Post('manager/maintenance/:id')
  async maintenanceStatus(@Req() { actor }: SessionRequest, @Param('id', ParseUUIDPipe) ticketId: string, @Body() body: unknown) {
    allow(actor, 'OWNER', 'MANAGER', 'STAFF');
    const { status } = parse(z.object({ status: z.enum(['IN_PROGRESS', 'DONE']) }).strict(), body);
    return atomic(async tx => {
      const row = found(await tx.maintenanceRequest.findFirst({ where: { id: ticketId, lease: leaseScope(actor), ...(actor.role === 'STAFF' ? { assigneeId: actor.id } : {}) } }));
      requireCondition(row.status === status || (row.status === 'OPEN' && status === 'IN_PROGRESS') || (row.status === 'IN_PROGRESS' && status === 'DONE'), 'Thứ tự cập nhật tiến độ không hợp lệ.');
      if (row.status === status) return row;
      const result = await tx.maintenanceRequest.update({ where: { id: ticketId }, data: { status } });
      await audit(tx, actor, 'MAINTENANCE_STATUS_CHANGED', ticketId, status);
      await notify(tx, row.leaseId, 'maintenance:' + ticketId + ':' + status, status === 'DONE' ? 'Yêu cầu bảo trì đã hoàn thành.' : 'Yêu cầu bảo trì đang được xử lý.');
      return result;
    });
  }

  @Post('manager/rooms/:id/meter-evidence')
  @UseInterceptors(FileFieldsInterceptor([{ name: 'electric', maxCount: 1 }, { name: 'water', maxCount: 1 }], { limits: { fileSize: 8 * 1024 * 1024, files: 2 } }))
  async record(@Req() { actor }: SessionRequest, @Param('id', ParseUUIDPipe) roomId: string, @Body() body: unknown, @UploadedFiles() images: { electric?: UploadedImage[]; water?: UploadedImage[] }) {
    allow(actor, 'OWNER', 'MANAGER', 'STAFF');
    const numeric = z.coerce.number().pipe(meter);
    const data = parse(z.object({ billingPeriod: period, electricOld: numeric, electricNew: numeric, waterOld: numeric, waterNew: numeric }).strict(), body);
    if (data.electricNew < data.electricOld || data.waterNew < data.waterOld) throw new BadRequestException('Chỉ số cuối kỳ phải lớn hơn hoặc bằng đầu kỳ.');
    found(await db.room.findFirst({ where: { id: roomId, property: propertyScope(actor) } }));
    const [electric, water] = await Promise.all([optimizeImage(images?.electric?.[0]), optimizeImage(images?.water?.[0])]);
    return atomic(async tx => {
      found(await tx.room.findFirst({ where: { id: roomId, property: propertyScope(actor) } }));
      const result = await tx.meterReading.create({ data: { ...data, roomId, recordedById: actor.id, evidence: { create: [
        { kind: 'ELECTRICITY', data: new Uint8Array(electric.buffer) }, { kind: 'WATER', data: new Uint8Array(water.buffer) },
      ] } } });
      await audit(tx, actor, 'METER_RECORDED_WITH_EVIDENCE', result.id);
      return result;
    });
  }

  @Get('invoices/:id/meter-evidence')
  async evidence(@Req() { actor }: SessionRequest, @Param('id', ParseUUIDPipe) invoiceId: string) {
    const invoice = found(await db.invoice.findFirst({ where: { id: invoiceId, lease: leaseScope(actor), status: { notIn: ['DRAFT', 'CANCELLED'] } }, select: { billingPeriod: true, lease: { select: { roomId: true } } } }));
    return db.meterEvidence.findMany({ where: { reading: { roomId: invoice.lease.roomId, billingPeriod: invoice.billingPeriod } }, select: { id: true, kind: true, createdAt: true } });
  }

  @Get('invoices/:id/meter-evidence/:photo')
  async evidencePhoto(@Req() { actor }: SessionRequest, @Param('id', ParseUUIDPipe) invoiceId: string, @Param('photo', ParseUUIDPipe) photoId: string, @Res({ passthrough: true }) response: Response) {
    const items = await this.evidence({ actor } as SessionRequest, invoiceId);
    found(items.find(item => item.id === photoId) ?? null);
    const photo = found(await db.meterEvidence.findUnique({ where: { id: photoId } }));
    response.set('Cache-Control', 'private, no-store');
    return new StreamableFile(Buffer.from(photo.data), { type: 'image/webp', disposition: 'inline' });
  }
}
