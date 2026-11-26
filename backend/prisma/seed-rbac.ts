import { demoPassword } from './seed-demo-config';
import { randomUUID } from 'node:crypto';
import { UserRoleStub } from '@prisma/client';
import { db, passwordHash } from '../src/auth';

const accounts = [
  ['testchutro', 'OWNER', 'Chủ trọ Minh'],
  ['testchutro2', 'OWNER', 'Chủ trọ An'],
  ['testquanly', 'MANAGER', 'Quản lý Minh'],
  ['testquanly2', 'MANAGER', 'Quản lý An'],
  ['testnhanvien', 'STAFF', 'Nhân viên vận hành'],
  ['testketoan', 'ACCOUNTANT', 'Kế toán khu Minh'],
  ['testnguoidung', 'RENTER', 'Người thuê Minh'],
  ['testnguoidung2', 'RENTER', 'Người thuê An'],
  ['testadmin', 'ADMIN', 'Quản trị RentFlow'],
] as const satisfies ReadonlyArray<readonly [string, UserRoleStub, string]>;

async function seed() {
  const password = demoPassword();
  await db.$transaction(async tx => {
    const ids = new Map<string, string>();
    for (const [username, role, fullName] of accounts) {
      const email = username + '@rentflow.test';
      const rows = await tx.user.findMany({ where: { OR: [{ email }, { username }] } });
      if (rows.some(row => !row.isDemo || row.role !== role || row.username !== username || row.email !== email)) {
        throw new Error('Trùng định danh ngoài bộ tài khoản demo: ' + username);
      }
      const user = rows[0] ?? await tx.user.create({ data: { username, email, role, fullName, isDemo: true, passwordHash: passwordHash(password) } });
      ids.set(username, user.id);
    }
    for (const [suffix, name, address, propertyId] of [
      ['', 'Khu trọ Minh', '18A Nguyễn Xí, Bình Thạnh, TP.HCM', 'a9261100-0000-4000-8000-000000000001'],
      ['2', 'Khu trọ An', '24 Nguyễn Kiệm, Phú Nhuận, TP.HCM', 'a9261100-0000-4000-8000-000000000002'],
    ] as const) {
      const ownerId = ids.get('testchutro' + suffix)!;
      const renterId = ids.get('testnguoidung' + suffix)!;
      const property = await tx.property.upsert({ where: { id: propertyId }, update: {}, create: { id: propertyId, name, address, ownerId } });
      if (property.ownerId !== ownerId) throw new Error('Khu demo đã thuộc chủ khác.');
      const staff = suffix ? ['testquanly2'] : ['testquanly', 'testnhanvien', 'testketoan'];
      for (const username of staff) {
        const userId = ids.get(username)!;
        await tx.user.updateMany({ where: { id: userId, managedById: null }, data: { managedById: ownerId } });
        await tx.propertyAccess.upsert({ where: { propertyId_userId: { propertyId, userId } }, update: {}, create: { propertyId, userId } });
      }
      const room = await tx.room.upsert({
        where: { propertyId_roomCode: { propertyId, roomCode: '101' } }, update: {},
        create: { propertyId, roomCode: '101', baseRentPrice: 3000000, maxOccupants: 2, status: 'OCCUPIED' },
      });
      await tx.room.upsert({
        where: { propertyId_roomCode: { propertyId, roomCode: '102' } }, update: {},
        create: { propertyId, roomCode: '102', baseRentPrice: 3400000, maxOccupants: 2, listingStatus: suffix ? 'PENDING' : 'PUBLISHED', amenities: 'Wi-Fi, bếp nhỏ', floorArea: 25 },
      });
      const tenant = await tx.tenant.findFirst({ where: { propertyId, userId: renterId } }) ??
        await tx.tenant.create({ data: { propertyId, userId: renterId, fullName: 'Người thuê khu ' + name.split(' ').at(-1) } });
      const lease = await tx.lease.findFirst({ where: { roomId: room.id, tenants: { some: { tenantId: tenant.id } } } }) ??
        await tx.lease.create({ data: { roomId: room.id, startDate: new Date('2026-01-01'), endDate: new Date('2029-01-01'), status: 'ACTIVE',
          rentAmount: 3000000, depositAgreed: 3000000, depositReceived: 3000000,
          tenants: { create: { tenantId: tenant.id, representative: true } },
        } });
      await tx.invoice.upsert({ where: { leaseId_billingPeriod_activeFlag: { leaseId: lease.id, billingPeriod: '2026-11', activeFlag: 1 } }, update: {},
        create: { leaseId: lease.id, billingPeriod: '2026-11', status: 'ISSUED', totalAmount: 3000000, remainingAmount: 3000000,
          dueDate: new Date('2026-12-05'), idempotencyKey: randomUUID(),
          items: { create: { itemType: 'RENT', description: 'Tiền phòng', quantity: 1, snapshotUnitPrice: 3000000, lineTotal: 3000000 } },
        } });
    }
  });
  console.log('Đã kiểm tra 9 tài khoản demo và hai phạm vi khu trọ.');
}

seed().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => db.$disconnect());
