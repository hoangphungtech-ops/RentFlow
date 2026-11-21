import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { z } from 'zod';
import { issueCode } from './accounts';
import { production } from './browser-session';
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
  if (action === 'list-recovery') {
    const users = await db.user.findMany({
      where: { recoveryRequestedAt: { not: null }, lockedAt: null, ...(production() ? { isDemo: false } : {}) },
      select: { id: true, email: true, recoveryRequestedAt: true }, take: 100,
    });
    console.log(JSON.stringify(users));
    return;
  }
  if (action === 'issue-reset') {
    const input = parse(z.object({
      userId: z.uuid(), evidence: z.string().trim().min(12).max(255), outputFile: z.string().min(1).max(512),
    }), JSON.parse(readFileSync(0, 'utf8')));
    let written = false;
    try {
      await db.$transaction(async tx => {
        const user = await tx.user.findUnique({ where: { id: input.userId } });
        requireCondition(user?.passwordHash && !user.lockedAt && !(production() && user.isDemo), 'Active account required');
        const reset = await issueCode(tx, user.id, 'RESET');
        await tx.audit.create({ data: { actorId: user.id, entityId: user.id, action: 'OPERATOR_RESET_ISSUED', reason: input.evidence } });
        writeFileSync(input.outputFile, JSON.stringify(reset), { flag: 'wx', mode: 0o600 });
        written = true;
      }, { isolationLevel: 'Serializable' });
    } catch (error) {
      if (written) unlinkSync(input.outputFile);
      throw error;
    }
    console.log('Reset material written to the supplied private file.');
    return;
  }
  if (action === 'verify-email') {
    const input = parse(z.object({
      userId: z.uuid(), email: z.email().max(254), evidence: z.string().trim().min(12).max(255),
    }), JSON.parse(readFileSync(0, 'utf8')));
    await atomic(async tx => {
      const user = await tx.user.findUnique({ where: { id: input.userId } });
      requireCondition(user?.passwordHash && !user.lockedAt && !(production() && user.isDemo), 'Active account required');
      await tx.user.update({ where: { id: user.id }, data: { email: input.email.toLowerCase(), emailVerifiedAt: new Date(), recoveryRequestedAt: null } });
      await tx.session.deleteMany({ where: { userId: user.id } });
      await tx.accountCode.deleteMany({ where: { userId: user.id } });
      await tx.audit.create({ data: { actorId: user.id, entityId: user.id, action: 'OPERATOR_EMAIL_VERIFIED', reason: input.evidence } });
    });
    console.log('Verified email updated.');
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
      await tx.accountCode.deleteMany({ where: { userId: input.userId } });
      await tx.notification.deleteMany({ where: { userId: input.userId } });
      await tx.user.update({ where: { id: input.userId }, data: {
        email: input.userId + '@deleted.invalid', fullName: 'Tài khoản đã xóa', passwordHash: null, username: null, emailVerifiedAt: null, recoveryRequestedAt: null,
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
