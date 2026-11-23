import 'dotenv/config';
import * as bcrypt from 'bcryptjs';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient, UserStatus } from '../src/generated/prisma/client';

const adapter = new PrismaMariaDb(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

export const SEED_IDS = {
  PROPERTY_A: '11111111-1111-4111-8111-111111111111',
  PROPERTY_B: '22222222-2222-4222-8222-222222222222',
  LEASE_A: '33333333-3333-4333-8333-333333333333',
  LEASE_B: '44444444-4444-4444-8444-844444444444',
  TENANT_A: '55555555-5555-4555-8555-555555555555',
  TENANT_B: '66666666-6666-4666-8666-666666666666',
};

async function main() {
  const passwordHash = await bcrypt.hash('Rentflow@2026', 10);

  const rolesData = [
    { name: 'OWNER', permissions: ['*'] },
    { name: 'STAFF', permissions: ['property:read', 'room:write', 'meter:write', 'handover:write'] },
    { name: 'ACCOUNTANT', permissions: ['property:read', 'invoice:read', 'payment:write', 'payment:confirm'] },
    { name: 'TENANT', permissions: ['lease:read:own', 'invoice:read:own', 'payment:report:own'] },
  ];

  const roles: Record<string, string> = {};
  for (const r of rolesData) {
    const role = await prisma.role.upsert({
      where: { name: r.name },
      update: { permissions: r.permissions },
      create: { name: r.name, permissions: r.permissions },
    });
    roles[r.name] = role.id;
  }

  const usersData = [
    { email: 'owner.a@rentflow.local', fullName: 'OWNER_A (Chủ trọ Khu A)', roleId: roles.OWNER, propertyId: SEED_IDS.PROPERTY_A },
    { email: 'owner.b@rentflow.local', fullName: 'OWNER_B (Chủ trọ Khu B)', roleId: roles.OWNER, propertyId: SEED_IDS.PROPERTY_B },
    { email: 'staff.a@rentflow.local', fullName: 'STAFF_A (Nhân viên Khu A)', roleId: roles.STAFF, propertyId: SEED_IDS.PROPERTY_A },
    { email: 'accountant.a@rentflow.local', fullName: 'ACCOUNTANT_A (Kế toán Khu A)', roleId: roles.ACCOUNTANT, propertyId: SEED_IDS.PROPERTY_A },
    { email: 'renter.a@rentflow.local', fullName: 'RENTER_A (Người thuê R101)', roleId: roles.TENANT, propertyId: null },
    { email: 'renter.b@rentflow.local', fullName: 'RENTER_B (Người thuê Khu B)', roleId: roles.TENANT, propertyId: null },
  ];

  for (const u of usersData) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { fullName: u.fullName, roleId: u.roleId, status: UserStatus.ACTIVE },
      create: {
        email: u.email,
        passwordHash,
        fullName: u.fullName,
        roleId: u.roleId,
        status: UserStatus.ACTIVE,
      },
    });

    if (u.propertyId) {
      await prisma.userPropertyAccess.upsert({
        where: {
          userId_propertyId: { userId: user.id, propertyId: u.propertyId },
        },
        update: {},
        create: { userId: user.id, propertyId: u.propertyId },
      });
    }
  }

  console.log('Seed H01 hoàn tất! Mật khẩu mặc định: Rentflow@2026');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
