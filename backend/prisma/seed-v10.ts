import { demoPassword } from './seed-demo-config';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import sharp from 'sharp';
import { db, passwordHash } from '../src/auth';

const ids = {
  user: 'a9251100-0000-4000-8000-000000000001',
  admin: 'a9251100-0000-4000-8000-000000000002',
  manager: 'a9251100-0000-4000-8000-000000000003',
  property: 'a9251100-0000-4000-8000-000000000004',
  occupied: 'a9251100-0000-4000-8000-000000000005',
  listing: 'a9251100-0000-4000-8000-000000000006',
  tenant: 'a9251100-0000-4000-8000-000000000007',
  lease: 'a9251100-0000-4000-8000-000000000008',
  invoice: 'a9251100-0000-4000-8000-000000000009',
  review: 'a9251100-0000-4000-8000-000000000010',
};

async function seed() {
  const pass = demoPassword();
  for (const [key, role, fullName] of [
    ['user', 'RENTER', 'Khách thuê demo'], ['admin', 'ADMIN', 'Quản trị viên demo'], ['manager', 'OWNER', 'Chủ trọ demo'],
  ] as const) {
    const email = key + '.demo@rentflow.test';
    const existing = await db.user.findUnique({ where: { email } });
    if (existing && (existing.id !== ids[key] || !existing.isDemo || existing.role !== role)) throw Error('Demo account collision.');
    await db.user.upsert({ where: { email }, create: { id: ids[key], email, role, fullName, passwordHash: passwordHash(pass), isDemo: true }, update: {} });
  }
  await db.property.upsert({ where: { id: ids.property }, update: {}, create: { id: ids.property, ownerId: ids.manager, name: 'Khu trọ An Bình', address: '18A Nguyễn Xí, Bình Thạnh, TP.HCM' } });
  for (const [id, roomCode, status, listingStatus, rent] of [
    [ids.occupied, 'AB101', 'OCCUPIED', 'DRAFT', 3000000],
    [ids.listing, 'AB201', 'AVAILABLE', 'PUBLISHED', 3800000],
    [ids.review, 'AB202', 'AVAILABLE', 'PENDING', 3500000],
  ] as const) {
    await db.room.upsert({ where: { id }, update: {}, create: { id, roomCode, status, listingStatus, baseRentPrice: rent, maxOccupants: 2, floorArea: 26, amenities: 'Wi-Fi, gác lửng, bếp nhỏ', propertyId: ids.property } });
  }
  const directory = join(resolve(process.env.UPLOAD_DIR || 'uploads'), 'rooms');
  await mkdir(directory, { recursive: true });
  for (const [roomId, first] of [[ids.listing, 20], [ids.review, 30]] as const) {
    for (const index of [1, 2]) {
      const imageId = 'a9251100-0000-4000-8000-' + String(first + index).padStart(12, '0');
      const storageKey = imageId + '.webp';
      if (await db.roomImage.findUnique({ where: { id: imageId } })) continue;
      const source = await readFile(join(process.cwd(), 'prisma', 'demo-assets', 'room-' + index + '.jpg'));
      const image = await sharp(source).rotate().resize({ width: 750, withoutEnlargement: true }).webp({ quality: 78 }).toBuffer({ resolveWithObject: true });
      await writeFile(join(directory, storageKey), image.data);
      await db.roomImage.create({ data: {
        id: imageId, roomId, storageKey, alt: 'Ảnh minh họa ' + index, isPrimary: index === 1,
        mimeType: 'image/webp', width: image.info.width, height: image.info.height, sizeBytes: image.data.byteLength,
      } });
    }
  }
  await db.tenant.upsert({ where: { id: ids.tenant }, update: {}, create: { id: ids.tenant, propertyId: ids.property, userId: ids.user, fullName: 'Khách thuê demo' } });
  await db.lease.upsert({ where: { id: ids.lease }, update: {}, create: {
    id: ids.lease, roomId: ids.occupied, rentAmount: 3000000, depositAgreed: 3000000, depositReceived: 3000000,
    startDate: new Date('2026-09-01T00:00:00+07:00'), endDate: new Date('2028-12-01T00:00:00+07:00'), status: 'ACTIVE',
    tenants: { create: { tenantId: ids.tenant, representative: true } },
  } });
  const billPeriod = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit' }).format(new Date());
  if (!await db.invoice.findUnique({ where: { id: ids.invoice } })) {
    await db.invoice.create({ data: {
      id: ids.invoice, leaseId: ids.lease, billingPeriod: billPeriod, dueDate: new Date(Date.now() + 10 * 86400000),
      totalAmount: 3620000, paidAmount: 0, remainingAmount: 3620000, issuedAt: new Date(), status: 'ISSUED',
      items: { create: [
        { itemType: 'RENT', description: 'Tiền phòng', quantity: 1, snapshotUnitPrice: 3000000, lineTotal: 3000000 },
        { itemType: 'ELECTRICITY', description: 'Điện (kWh)', quantity: 120, snapshotUnitPrice: 3500, lineTotal: 420000, meterStart: 100, meterEnd: 220 },
        { itemType: 'WATER', description: 'Nước (m³)', quantity: 5, snapshotUnitPrice: 20000, lineTotal: 100000, meterStart: 20, meterEnd: 25 },
        { itemType: 'SERVICE', description: 'Wi-Fi và vệ sinh', quantity: 1, snapshotUnitPrice: 100000, lineTotal: 100000 },
      ] },
    } });
  }
  for (const [serviceType, serviceName, unit, unitPrice] of [
    ['ELECTRICITY', 'Điện', 'kWh', 3500], ['WATER', 'Nước', 'm³', 20000], ['SERVICE', 'Wi-Fi và vệ sinh', 'tháng', 100000],
  ] as const) {
    if (!await db.utilityRate.findFirst({ where: { propertyId: ids.property, serviceType } })) {
      await db.utilityRate.create({ data: { propertyId: ids.property, serviceType, serviceName, unit, unitPrice, effectiveFrom: new Date('2026-01-01T00:00:00+07:00') } });
    }
  }
  console.log('V10 demo accounts, property, rooms and lease ready.');
}

seed().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => db.$disconnect());
