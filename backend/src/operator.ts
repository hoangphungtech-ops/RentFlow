import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { db, passwordHash } from './auth';
import { parse, atomic, requireCondition } from './rules';

async function main() {
  const action = process.argv[2];
  if (action === 'create') {
    const input = parse(z.object({
      email: z.email().max(254), fullName: z.string().trim().min(1).max(120),
      role: z.enum(['OWNER', 'STAFF', 'ACCOUNTANT', 'RENTER']), password: z.string().min(16).max(128),
    }), JSON.parse(readFileSync(0, 'utf8')));
    const entity = await db.user.create({ data: {
      email: input.email.toLowerCase(), fullName: input.fullName, role: input.role, passwordHash: passwordHash(input.password),
    }, select: { id: true } });
    console.log(JSON.stringify(entity));
    return;
  }
  if (action === 'list-deletion') {
    const rows = await db.accountDeletionRequest.findMany({
      where: { status: 'PENDING' }, select: { userId: true, requestedAt: true, user: { select: { role: true } } },
      orderBy: { requestedAt: 'asc' }, take: 100,
    });
    console.log(JSON.stringify(rows));
    return;
  }
  if (action === 'close-renter') {
    const input = parse(z.object({
      userId: z.uuid(), reviewerId: z.uuid(), disposition: z.enum(['ERASED', 'RETAINED_RECORDS']),
      evidence: z.string().trim().min(12).max(255),
    }), JSON.parse(readFileSync(0, 'utf8')));
    await atomic(async tx => {
      const request = await tx.accountDeletionRequest.findUnique({ where: { userId: input.userId }, include: { user: { select: { role: true } } } });
      requireCondition(request?.status === 'PENDING' && request.user.role === 'RENTER', 'A pending renter request is required');
      const reviewer = await tx.user.findUnique({ where: { id: input.reviewerId }, select: { role: true } });
      requireCondition(reviewer?.role === 'OWNER', 'An accountable owner is required');
      const tenants = await tx.tenant.findMany({ where: { userId: input.userId }, select: { id: true, _count: { select: { leases: true } } } });
      const historical = tenants.filter(tenant => tenant._count.leases > 0);
      requireCondition((historical.length > 0) === (input.disposition === 'RETAINED_RECORDS'), 'Lease retention must be explicitly recorded');
      const standalone = tenants.filter(tenant => tenant._count.leases === 0);
      await tx.tenant.deleteMany({ where: { id: { in: standalone.map(tenant => tenant.id) } } });
      await tx.tenant.updateMany({ where: { id: { in: historical.map(tenant => tenant.id) } }, data: { userId: null, contact: null } });
      await tx.session.deleteMany({ where: { userId: input.userId } });
      await tx.notification.deleteMany({ where: { userId: input.userId } });
      await tx.user.update({ where: { id: input.userId }, data: {
        email: input.userId + '@deleted.invalid', fullName: 'Tài khoản đã xóa', passwordHash: null,
      } });
      await tx.accountDeletionRequest.update({ where: { userId: input.userId }, data: { status: input.disposition, reviewedAt: new Date() } });
      await tx.audit.create({ data: {
        actorId: input.reviewerId, entityId: input.userId, action: 'ACCOUNT_DELETION_REVIEWED', reason: input.evidence,
      } });
    });
    console.log('Deletion request processed.');
    return;
  }
  throw new Error('Use create, list-deletion or close-renter');
}

main().catch(() => {
  console.error('Operation rejected. Check command, evidence, role and database.');
  process.exitCode = 1;
}).finally(() => db.$disconnect());
