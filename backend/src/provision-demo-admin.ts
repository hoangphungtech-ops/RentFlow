import { db, passwordHash } from './auth';
import { production } from './browser-session';
import { z } from 'zod';

async function provision() {
  const url = new URL(process.env.DATABASE_URL ?? '');
  if (production() || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
    throw new Error('Demo provisioning requires a local database.');
  const username = 'testadmin';
  const existing = await db.user.findUnique({ where: { username }, select: { role: true, isDemo: true } });
  if (existing) {
    if (!existing.isDemo || existing.role !== 'OWNER') throw new Error('Username is already reserved.');
    console.log('Demo owner already exists; credentials preserved.');
    return;
  }
  const email = z.email().max(254).parse(process.env.DEMO_ADMIN_EMAIL).toLowerCase();
  const password = z.string().min(10).max(128).parse(process.env.DEMO_ADMIN_PASSWORD);
  await db.user.create({ data: {
    username, email, passwordHash: passwordHash(password), fullName: 'Chủ trọ thử nghiệm', role: 'OWNER', isDemo: true,
    ownedProperties: { create: { name: 'Khu trọ TestAdmin', address: 'Dữ liệu demo local' } },
  } });
  console.log('Demo owner created.');
}
provision().catch(() => {
  console.error('Demo provisioning refused. Check local environment, account uniqueness and migration.');
  process.exitCode = 1;
}).finally(() => db.$disconnect());
