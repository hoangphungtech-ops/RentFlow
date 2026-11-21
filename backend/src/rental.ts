import { Body, Controller, Get, Param, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { db, matchesPassword, SessionGuard, SessionRequest } from './auth';
import { allow, atomic, audit, day, decimal, found, id, label, leaseScope, meter, money, notify, parse, period, propertyScope, requireCondition } from './rules';
import { balance, changePayment, invoiceFor } from './finance';

@Controller()
export class PublicController {
  @Get('health')
  async health() {
    await db.$queryRaw`SELECT 1`;
    return { status: 'ok' };
  }

  @Post('trials')
  async trial(@Body() body: unknown) {
    const data = parse(z.object({ fullName: label(120), contact: label(120), roomCount: z.number().int().min(1).max(10000).optional(), note: label(1000).optional() }), body);
    return db.trialLead.create({ data, select: { id: true } });
  }
}

@ApiBearerAuth()
@UseGuards(SessionGuard)
@Controller()
export class RentalController {
  @Get('account/deletion-request')
  async deletionStatus(@Req() { actor }: SessionRequest) {
    const request = await db.accountDeletionRequest.findUnique({ where: { userId: actor.id },
      select: { status: true, requestedAt: true, reviewedAt: true } });
    return { request };
  }

  @Post('account/deletion-request')
  async deletionRequest(@Req() { actor }: SessionRequest, @Body() body: unknown) {
    const { password } = parse(z.object({ password: z.string().min(1).max(128) }), body);
    const user = await db.user.findUniqueOrThrow({ where: { id: actor.id }, select: { passwordHash: true } });
    if (!matchesPassword(password, user.passwordHash)) throw new UnauthorizedException('Mật khẩu xác minh không đúng');
    return atomic(async tx => {
      const previous = await tx.accountDeletionRequest.findUnique({ where: { userId: actor.id } });
      if (previous) return { status: previous.status, requestedAt: previous.requestedAt, reviewedAt: previous.reviewedAt };
      const row = await tx.accountDeletionRequest.create({ data: { userId: actor.id },
        select: { status: true, requestedAt: true, reviewedAt: true } });
      await audit(tx, actor, 'ACCOUNT_DELETION_REQUESTED', actor.id);
      return row;
    });
  }

  @Get('overview')
  async overview(@Req() { actor }: SessionRequest) {
    const scope = leaseScope(actor);
    if (actor.role === 'RENTER') await this.remindDue(actor.id);
    const [properties, leases, invoices, notifications] = await Promise.all([
      db.property.findMany({ where: propertyScope(actor), include: { rooms: { orderBy: { roomCode: 'asc' } }, utilityRates: true } }),
      db.lease.findMany({ where: scope, include: { room: { select: { roomCode: true, propertyId: true } }, tenants: { include: { tenant: { select: { id: true, fullName: true } } } } }, orderBy: { createdAt: 'desc' } }),
      db.invoice.findMany({ where: { lease: scope, status: { notIn: ['CANCELLED', 'DRAFT'] } }, orderBy: { dueDate: 'asc' } }),
      db.notification.findMany({ where: { userId: actor.id }, orderBy: { createdAt: 'desc' }, take: 50 }),
    ]);
    const tenants = await db.tenant.findMany({ where: { property: propertyScope(actor) }, select: { id: true, propertyId: true, fullName: true } });
    return { actor, properties, leases, invoices, notifications, tenants };
  }

  private async remindDue(userId: string) {
    const date = new Date();
    const upcoming = new Date(+date + 3 * 86400_000);
    const invoices = await db.invoice.findMany({ where: {
      dueDate: { gte: date, lte: upcoming }, remainingAmount: { gt: 0 }, status: { in: ['ISSUED', 'PARTIALLY_PAID'] },
      lease: { tenants: { some: { tenant: { userId } } } },
    }, select: { id: true, billingPeriod: true } });
    if (invoices.length) await db.notification.createMany({
      data: invoices.map(invoice => ({ userId, event: 'due:' + invoice.id, message: 'Hóa đơn sắp đến hạn kỳ ' + invoice.billingPeriod })),
      skipDuplicates: true,
    });
  }

  @Post('properties')
  async property(@Req() { actor }: SessionRequest, @Body() body: unknown) {
    allow(actor, 'OWNER');
    const data = parse(z.object({ name: label(150), address: label(255) }), body);
    return atomic(async tx => {
      const property = await tx.property.create({ data: { ...data, ownerId: actor.id } });
      await audit(tx, actor, 'PROPERTY_CREATED', property.id);
      return property;
    });
  }

  @Get('rooms/:roomId/history')
  async roomHistory(@Req() { actor }: SessionRequest, @Param('roomId') roomId: string) {
    return found(await db.room.findFirst({
      where: { id: roomId, property: propertyScope(actor) },
      select: {
        leases: { orderBy: [{ startDate: 'desc' }, { id: 'desc' }], take: 50, select: {
          id: true, startDate: true, endDate: true, status: true,
        } },
        meterReadings: { orderBy: { billingPeriod: 'desc' }, take: 50, select: {
          billingPeriod: true, electricOld: true, electricNew: true, waterOld: true, waterNew: true,
        } },
      },
    }));
  }

  @Post('properties/:propertyId/rooms')
  async room(@Req() { actor }: SessionRequest, @Param('propertyId') propertyId: string, @Body() body: unknown) {
    allow(actor, 'OWNER');
    const data = parse(z.object({ roomCode: label(30), baseRentPrice: money, maxOccupants: z.number().int().min(1).max(50), status: z.enum(['AVAILABLE', 'MAINTENANCE']).default('AVAILABLE') }), body);
    return atomic(async tx => {
      found(await tx.property.findFirst({ where: { id: propertyId, ...propertyScope(actor) } }));
      const room = await tx.room.create({ data: { ...data, propertyId } });
      await audit(tx, actor, 'ROOM_CREATED', room.id);
      return room;
    });
  }

  @Post('rooms/:roomId/settings')
  async roomSettings(@Req() { actor }: SessionRequest, @Param('roomId') roomId: string, @Body() body: unknown) {
    allow(actor, 'OWNER');
    const data = parse(z.object({ baseRentPrice: money, maxOccupants: z.number().int().min(1).max(50), status: z.enum(['AVAILABLE', 'MAINTENANCE', 'OCCUPIED']) }), body);
    return atomic(async tx => {
      const room = found(await tx.room.findFirst({ where: { id: roomId, property: propertyScope(actor) } }));
      const active = await tx.lease.findFirst({
        where: { roomId, status: { in: ['ACTIVE', 'EXPIRED'] } }, include: { _count: { select: { tenants: true } } },
      });
      requireCondition(Boolean(active) === (data.status === 'OCCUPIED'), 'Trạng thái phòng phải phù hợp hợp đồng đang giữ phòng');
      requireCondition(!active || data.maxOccupants >= active._count.tenants, 'Sức chứa nhỏ hơn số người đang ở');
      const updated = await tx.room.update({ where: { id: room.id }, data });
      await audit(tx, actor, 'ROOM_UPDATED', room.id);
      return updated;
    });
  }

  @Post('properties/:propertyId/access')
  async access(@Req() { actor }: SessionRequest, @Param('propertyId') propertyId: string, @Body() body: unknown) {
    allow(actor, 'OWNER');
    const data = parse(z.object({ email: z.email().max(254), operation: z.enum(['GRANT', 'REVOKE']) }), body);
    return atomic(async tx => {
      found(await tx.property.findFirst({ where: { id: propertyId, ...propertyScope(actor) } }));
      const user = found(await tx.user.findFirst({
        where: { email: data.email.toLowerCase(), role: { in: ['STAFF', 'ACCOUNTANT'] }, OR: [{ managedById: actor.id }, { managedById: null }] }, select: { id: true },
      }));
      const key = { propertyId, userId: user.id };
      if (data.operation === 'GRANT') {
        await tx.propertyAccess.upsert({ where: { propertyId_userId: key }, create: key, update: {} });
      } else {
        await tx.propertyAccess.deleteMany({ where: key });
      }
      await audit(tx, actor, 'ACCESS_' + data.operation, propertyId, user.id);
      return { ok: true };
    });
  }

  @Post('properties/:propertyId/tenants')
  async tenant(@Req() { actor }: SessionRequest, @Param('propertyId') propertyId: string, @Body() body: unknown) {
    allow(actor, 'OWNER', 'STAFF');
    const { email, ...data } = parse(z.object({ fullName: label(120), contact: label(120).optional(), email: z.email().max(254).optional() }), body);
    if (email) allow(actor, 'OWNER');
    return atomic(async tx => {
      found(await tx.property.findFirst({ where: { id: propertyId, ...propertyScope(actor) } }));
      const user = email ? found(await tx.user.findFirst({ where: { email: email.toLowerCase(), role: 'RENTER', OR: [{ managedById: actor.id }, { managedById: null }] } })) : null;
      const tenant = await tx.tenant.create({ data: { ...data, propertyId, userId: user?.id } });
      await audit(tx, actor, 'TENANT_CREATED', tenant.id);
      return tenant;
    });
  }

  @Post('leases')
  async lease(@Req() { actor }: SessionRequest, @Body() body: unknown) {
    allow(actor, 'OWNER', 'STAFF');
    const { roomId, representative, occupants, ...data } = parse(z.object({
      roomId: id, representative: id, occupants: z.array(id).max(49).default([]),
      startDate: day, endDate: day, rentAmount: money, depositAgreed: money,
    }), body);
    const ids = [representative, ...occupants];
    requireCondition(data.startDate < data.endDate && new Set(ids).size === ids.length, 'Ngày hợp đồng hoặc danh sách người ở không hợp lệ');
    return atomic(async tx => {
      const room = found(await tx.room.findFirst({ where: { id: roomId, property: propertyScope(actor) } }));
      requireCondition(ids.length <= room.maxOccupants, 'Vượt sức chứa phòng');
      const count = await tx.tenant.count({ where: { id: { in: ids }, propertyId: room.propertyId } });
      requireCondition(count === ids.length, 'Người ở phải thuộc cùng khu trọ');
      const lease = await tx.lease.create({ data: { ...data, roomId, status: 'DRAFT', tenants: { create: ids.map(tenantId => ({ tenantId, representative: tenantId === representative })) } } });
      await audit(tx, actor, 'LEASE_CREATED', lease.id);
      return lease;
    });
  }

  @Post('leases/:leaseId/activate')
  async activate(@Req() { actor }: SessionRequest, @Param('leaseId') leaseId: string) {
    allow(actor, 'OWNER');
    return atomic(async tx => {
      const lease = found(await tx.lease.findFirst({ where: { id: leaseId, ...leaseScope(actor) }, include: { room: true, _count: { select: { tenants: true } } } }));
      requireCondition(lease.status === 'DRAFT', 'Chỉ kích hoạt hợp đồng nháp');
      requireCondition(lease._count.tenants > 0 && lease._count.tenants <= lease.room.maxOccupants, 'Danh sách người ở vượt sức chứa hoặc còn thiếu');
      const existing = await tx.lease.count({ where: { roomId: lease.roomId, status: { in: ['ACTIVE', 'EXPIRED'] } } });
      requireCondition(!existing && lease.room.status === 'AVAILABLE', 'Phòng đang thuê hoặc bảo trì');
      await tx.room.update({ where: { id: lease.roomId }, data: { status: 'OCCUPIED' } });
      const updated = await tx.lease.update({ where: { id: leaseId }, data: { status: 'ACTIVE' } });
      await audit(tx, actor, 'LEASE_ACTIVATED', leaseId);
      await notify(tx, leaseId, 'lease:' + leaseId, 'Hợp đồng đã được kích hoạt');
      return updated;
    });
  }

  @Post('leases/:leaseId/handovers')
  async handover(@Req() { actor }: SessionRequest, @Param('leaseId') leaseId: string, @Body() body: unknown) {
    allow(actor, 'OWNER', 'STAFF');
    const data = parse(z.object({ kind: z.enum(['IN', 'OUT']), date: day, condition: label(255), inventory: label(2000), electric: meter, water: meter, notes: label(1000).optional() }), body);
    return atomic(async tx => {
      const lease = found(await tx.lease.findFirst({ where: { id: leaseId, ...leaseScope(actor) }, include: { handovers: true } }));
      requireCondition(lease.status === 'ACTIVE' || lease.status === 'EXPIRED', 'Hợp đồng phải đang giữ phòng');
      if (data.kind === 'OUT') {
        const entry = lease.handovers.find(row => row.kind === 'IN' && row.confirmedAt);
        requireCondition(entry && data.date >= entry.date, 'Cần biên bản nhận phòng đã xác nhận');
      }
      const row = await tx.handover.create({ data: { ...data, leaseId } });
      await audit(tx, actor, 'HANDOVER_CREATED', leaseId);
      return row;
    });
  }

  @Post('leases/:leaseId/handovers/:kind/confirm')
  async confirmHandover(@Req() { actor }: SessionRequest, @Param('leaseId') leaseId: string, @Param('kind') kindParam: string) {
    allow(actor, 'OWNER');
    const kind = parse(z.enum(['IN', 'OUT']), kindParam);
    return atomic(async tx => {
      const row = found(await tx.handover.findFirst({ where: { leaseId, kind, lease: leaseScope(actor) } }));
      if (row.confirmedAt) return row;
      const saved = await tx.handover.update({ where: { leaseId_kind: { leaseId, kind } }, data: { confirmedAt: new Date() } });
      await audit(tx, actor, 'HANDOVER_CONFIRMED', leaseId, kind);
      return saved;
    });
  }

  @Get('leases/:leaseId/ledger')
  async ledger(@Req() { actor }: SessionRequest, @Param('leaseId') leaseId: string) {
    return found(await db.lease.findFirst({
      where: { id: leaseId, ...leaseScope(actor) },
      include: {
        room: { select: { roomCode: true, property: { select: { name: true } } } },
        tenants: { select: { representative: true, tenant: { select: { fullName: true } } } },
        handovers: true, settlement: true,
        invoices: { where: { status: { notIn: ['DRAFT', 'CANCELLED'] } }, include: { items: true, payments: true }, orderBy: { billingPeriod: 'desc' } },
      },
    }));
  }

  @Post('properties/:propertyId/rates')
  async rate(@Req() { actor }: SessionRequest, @Param('propertyId') propertyId: string, @Body() body: unknown) {
    allow(actor, 'OWNER');
    const data = parse(z.object({ serviceType: z.enum(['ELECTRICITY', 'WATER', 'SERVICE']), serviceName: label(100), unit: label(30), unitPrice: money, effectiveFrom: day }), body);
    return atomic(async tx => {
      found(await tx.property.findFirst({ where: { id: propertyId, ...propertyScope(actor) } }));
      const result = await tx.utilityRate.create({ data: { ...data, propertyId } });
      await audit(tx, actor, 'RATE_CREATED', result.id);
      return result;
    });
  }

  @Post('rooms/:roomId/readings')
  async reading(@Req() { actor }: SessionRequest, @Param('roomId') roomId: string, @Body() body: unknown) {
    allow(actor, 'OWNER', 'STAFF');
    const data = parse(z.object({ billingPeriod: period, electricOld: meter, electricNew: meter, waterOld: meter, waterNew: meter }), body);
    requireCondition(data.electricOld <= data.electricNew && data.waterOld <= data.waterNew, 'Chỉ số cuối phải từ chỉ số đầu trở lên');
    return atomic(async tx => {
      found(await tx.room.findFirst({ where: { id: roomId, property: propertyScope(actor) } }));
      const result = await tx.meterReading.create({ data: { ...data, roomId, recordedById: actor.id } });
      await audit(tx, actor, 'METER_RECORDED', result.id);
      return result;
    });
  }

  @Post('leases/:leaseId/invoices')
  async issue(@Req() { actor }: SessionRequest, @Param('leaseId') leaseId: string, @Body() body: unknown) {
    allow(actor, 'OWNER', 'ACCOUNTANT');
    const data = parse(z.object({ billingPeriod: period, dueDate: day.transform(value => new Date(+value + 86400_000 - 1)) }), body);
    return atomic(async tx => {
      const lease = found(await tx.lease.findFirst({ where: { id: leaseId, ...leaseScope(actor) }, include: { room: true } }));
      requireCondition(lease.status === 'ACTIVE' || lease.status === 'EXPIRED', 'Hợp đồng chưa giữ phòng');
      const firstDayUtc = new Date(data.billingPeriod + '-01T00:00:00Z');
      const cutoff = new Date(+firstDayUtc - 7 * 3600_000);
      firstDayUtc.setUTCMonth(firstDayUtc.getUTCMonth() + 1);
      const monthEnd = new Date(+firstDayUtc - 7 * 3600_000);
      requireCondition(lease.startDate < monthEnd && data.dueDate >= cutoff, 'Kỳ hóa đơn hoặc hạn thanh toán không hợp lệ');
      const reading = found(await tx.meterReading.findUnique({ where: { roomId_billingPeriod: { roomId: lease.roomId, billingPeriod: data.billingPeriod } } }));
      const rates = await tx.utilityRate.findMany({ where: { propertyId: lease.room.propertyId, effectiveFrom: { lte: cutoff } }, orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }] });
      const electric = rates.find(rate => rate.serviceType === 'ELECTRICITY');
      const water = rates.find(rate => rate.serviceType === 'WATER');
      const service = rates.find(rate => rate.serviceType === 'SERVICE');
      requireCondition(electric && water, 'Cần đơn giá điện và nước đầu kỳ');
      const items = [
        { itemType: 'RENT' as const, description: 'Tiền phòng', quantity: decimal(1), snapshotUnitPrice: lease.rentAmount },
        { itemType: 'ELECTRICITY' as const, description: electric.serviceName, quantity: reading.electricNew.minus(reading.electricOld), snapshotUnitPrice: electric.unitPrice, meterStart: reading.electricOld, meterEnd: reading.electricNew },
        { itemType: 'WATER' as const, description: water.serviceName, quantity: reading.waterNew.minus(reading.waterOld), snapshotUnitPrice: water.unitPrice, meterStart: reading.waterOld, meterEnd: reading.waterNew },
        ...(service ? [{ itemType: 'SERVICE' as const, description: service.serviceName, quantity: decimal(1), snapshotUnitPrice: service.unitPrice }] : []),
      ].map(item => ({ ...item, lineTotal: item.quantity.mul(item.snapshotUnitPrice).toDecimalPlaces(0, 4) }));
      requireCondition(items.every(item => item.quantity.gte(0)), 'Chỉ số điện nước không hợp lệ');
      const totalAmount = items.reduce((sum, item) => sum.plus(item.lineTotal), decimal(0));
      requireCondition(totalAmount.gt(0) && totalAmount.lte(9999999999), 'Tổng hóa đơn ngoài giới hạn');
      const invoice = await tx.invoice.create({ data: { ...data, leaseId, totalAmount, remainingAmount: totalAmount, status: 'ISSUED', issuedAt: new Date(), items: { create: items } }, include: { items: true } });
      await audit(tx, actor, 'INVOICE_ISSUED', invoice.id);
      await notify(tx, leaseId, 'invoice:' + invoice.id, 'Có hóa đơn mới kỳ ' + data.billingPeriod);
      return invoice;
    });
  }

  @Post('invoices/:invoiceId/payments')
  async report(@Req() { actor }: SessionRequest, @Param('invoiceId') invoiceId: string, @Body() body: unknown) {
    allow(actor, 'OWNER', 'ACCOUNTANT', 'RENTER');
    const data = parse(z.object({ amount: money.refine(value => value > 0), method: z.enum(['CASH', 'TRANSFER']), requestKey: id }), body);
    try {
      return await atomic(async tx => {
        const invoice = await invoiceFor(tx, actor, invoiceId);
        if (actor.role === 'RENTER') {
          const representative = await tx.leaseTenant.findFirst({ where: { leaseId: invoice.leaseId, representative: true, tenant: { userId: actor.id } } });
          requireCondition(representative, 'Chỉ người đại diện được báo thanh toán');
        }
        const previous = await tx.payment.findUnique({ where: { invoiceId_requestKey: { invoiceId, requestKey: data.requestKey } } });
        if (previous) {
          requireCondition(previous.amount.eq(data.amount) && previous.method === data.method, 'Mã yêu cầu đã được dùng với dữ liệu khác');
          return previous;
        }
        requireCondition(invoice.remainingAmount.gte(data.amount), 'Khoản thu vượt số còn nợ');
        const payment = await tx.payment.create({ data: { ...data, invoiceId } });
        await audit(tx, actor, 'PAYMENT_REPORTED', payment.id);
        return payment;
      });
    } catch (error) {
      if (!(error instanceof Error) || !('code' in error) || error.code !== 'P2002') throw error;
      const previous = found(await db.payment.findFirst({
        where: { invoiceId, requestKey: data.requestKey, invoice: { lease: {
          AND: [leaseScope(actor), ...(actor.role === 'RENTER' ? [{ tenants: { some: { representative: true, tenant: { userId: actor.id } } } }] : [])],
        } } },
      }));
      requireCondition(previous.amount.eq(data.amount) && previous.method === data.method, 'Mã yêu cầu đã được dùng với dữ liệu khác');
      return previous;
    }
  }

  @Post('payments/:paymentId/:action')
  async payment(@Req() { actor }: SessionRequest, @Param('paymentId') paymentId: string, @Param('action') actionParam: string, @Body() body: unknown) {
    allow(actor, 'OWNER', 'ACCOUNTANT');
    const action = parse(z.enum(['confirm', 'reverse']), actionParam);
    const { reason } = parse(z.object({ reason: label(255).optional() }), body ?? {});
    return changePayment(actor, paymentId, action, reason);
  }

  @Post('leases/:leaseId/deposit')
  async deposit(@Req() { actor }: SessionRequest, @Param('leaseId') leaseId: string, @Body() body: unknown) {
    allow(actor, 'OWNER');
    const { amount, reason } = parse(z.object({ amount: money.refine(value => value > 0), reason: label(255) }), body);
    return atomic(async tx => {
      const lease = found(await tx.lease.findFirst({ where: { id: leaseId, ...leaseScope(actor) } }));
      requireCondition(lease.status === 'ACTIVE' && lease.depositReceived.eq(0) && lease.depositAgreed.gte(amount), 'Khoản cọc đã ghi nhận hoặc vượt thỏa thuận');
      const saved = await tx.lease.update({ where: { id: leaseId }, data: { depositReceived: amount } });
      await audit(tx, actor, 'DEPOSIT_RECEIVED', leaseId, reason);
      return saved;
    });
  }

  @Post('leases/:leaseId/settlement')
  async settle(@Req() { actor }: SessionRequest, @Param('leaseId') leaseId: string, @Body() body: unknown) {
    allow(actor, 'OWNER');
    const data = parse(z.object({ deduction: money, debtOffset: money, reason: label(255), invoiceId: id.optional() }), body);
    return atomic(async tx => {
      const lease = found(await tx.lease.findFirst({ where: { id: leaseId, ...leaseScope(actor) }, include: { handovers: true } }));
      requireCondition((lease.status === 'ACTIVE' || lease.status === 'EXPIRED') && lease.handovers.some(row => row.kind === 'OUT' && row.confirmedAt), 'Cần hợp đồng giữ phòng và biên bản trả đã xác nhận');
      const offset = decimal(data.debtOffset);
      const refund = lease.depositReceived.minus(data.deduction).minus(offset);
      requireCondition(refund.gte(0), 'Khấu trừ và bù nợ vượt cọc thực nhận');
      requireCondition(offset.gt(0) === Boolean(data.invoiceId), 'Khoản bù nợ cần đúng một hóa đơn');
      if (data.invoiceId) {
        const invoice = await invoiceFor(tx, actor, data.invoiceId);
        requireCondition(invoice.leaseId === leaseId && invoice.remainingAmount.gte(offset), 'Công nợ của hóa đơn không đủ để bù trừ');
        await tx.payment.create({ data: { invoiceId: invoice.id, requestKey: randomUUID(), amount: offset, method: 'DEPOSIT', status: 'CONFIRMED', confirmedAt: new Date() } });
        await balance(tx, invoice);
      }
      const row = await tx.settlement.create({ data: { ...data, leaseId, received: lease.depositReceived, refund, confirmedBy: actor.id } });
      await tx.lease.update({ where: { id: leaseId }, data: { status: 'TERMINATED' } });
      await tx.room.update({ where: { id: lease.roomId }, data: { status: 'AVAILABLE' } });
      await audit(tx, actor, 'LEASE_SETTLED', leaseId, data.reason);
      await notify(tx, leaseId, 'settlement:' + leaseId, 'Đã chốt quyết toán tiền cọc');
      return row;
    });
  }
}
