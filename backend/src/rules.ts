import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { Actor, db, Tx } from './auth';

export const id = z.uuid();
export const label = (max: number) => z.string().trim().min(1).max(max);
export const money = z.number().int().min(0).max(9999999999);
export const meter = z.number().min(0).max(99999999.99).multipleOf(0.01);
export const period = z.string().regex(/^(20\d{2})-(0[1-9]|1[0-2])$/);
export const day = z.iso.date().transform(value => new Date(value + 'T00:00:00+07:00'));
export const decimal = (value: number | Prisma.Decimal) => new Prisma.Decimal(value);

export function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new BadRequestException(result.error.issues.map(issue => issue.path.join('.') + ' ' + issue.message));
  }
  return result.data;
}

export function allow(actor: Actor, ...roles: Actor['role'][]) {
  if (!roles.includes(actor.role)) throw new ForbiddenException('Bạn không có quyền thực hiện thao tác này');
}

export function propertyScope(actor: Actor): Prisma.PropertyWhereInput {
  if (actor.role === 'OWNER') return { ownerId: actor.id };
  if (actor.role === 'RENTER') return { id: { in: [] } };
  return { access: { some: { userId: actor.id } } };
}

export function leaseScope(actor: Actor): Prisma.LeaseWhereInput {
  if (actor.role === 'RENTER') return { tenants: { some: { tenant: { userId: actor.id } } } };
  return { room: { property: propertyScope(actor) } };
}

export function found<T>(value: T | null): T {
  if (value === null) throw new NotFoundException('Không tìm thấy dữ liệu');
  return value;
}

export function requireCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new ConflictException(message);
}

export async function atomic<T>(work: (tx: Tx) => Promise<T>) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await db.$transaction(work, { isolationLevel: 'Serializable' });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034' && attempt < 2) continue;
      throw error;
    }
  }
}

export async function audit(tx: Tx, actor: Actor, action: string, entityId: string, reason?: string) {
  await tx.audit.create({ data: { actorId: actor.id, action, entityId, reason } });
}

export async function notify(tx: Tx, leaseId: string, event: string, message: string) {
  const members = await tx.leaseTenant.findMany({ where: { leaseId }, select: { tenant: { select: { userId: true } } } });
  const userIds = [...new Set(members.flatMap(({ tenant }) => tenant.userId ? [tenant.userId] : []))];
  if (userIds.length) await tx.notification.createMany({
    data: userIds.map(userId => ({ userId, event, message })), skipDuplicates: true,
  });
}
