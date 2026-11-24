const assert = require('node:assert/strict');
const { existsSync, statSync } = require('node:fs');
const { join, resolve } = require('node:path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
async function main() {
  const property = await prisma.property.findFirst({ where: { name: 'RentFlow Demo House' } });
  assert(property, 'RentFlow Demo House missing');
  const rooms = await prisma.room.findMany({ where: { propertyId: property.id }, orderBy: { roomCode: 'asc' }, include: { images: true } });
  assert.deepEqual(rooms.map(x => x.roomCode), ['P101','P102','P103']);
  const room = rooms.find(x => x.roomCode === 'P101');
  assert.equal(room.images.length, 1); assert.equal(room.images[0].isPrimary, true);
  const imagePath = join(resolve(process.env.UPLOAD_DIR || 'uploads'), 'rooms', room.images[0].storageKey);
  assert(existsSync(imagePath), 'persistent image file missing');

  const tenant = await prisma.tenant.findFirst({ where: { propertyId: property.id, fullName: 'Nguyễn Thị Demo' } });
  assert(tenant, 'RentFlow demo tenant missing');
  const lease = await prisma.lease.findFirst({ where: { roomId: room.id, tenants: { some: { tenantId: tenant.id } } }, include: {
    tenants: { include: { tenant: { select: { id: true, fullName: true, userId: true } } } },
    handovers: { orderBy: { date: 'asc' } }, invoices: { include: { items: true, payments: { orderBy: { createdAt: 'asc' } } } }, settlement: true,
  } });
  assert(lease, 'P101 lease or tenant foreign-key link missing');
  assert.equal(lease.handovers.length, 2); assert(lease.handovers.every(x => x.confirmedAt));
  const meter = await prisma.meterReading.findUnique({ where: { roomId_billingPeriod: { roomId: room.id, billingPeriod: '2026-11' } } });
  assert(meter, 'November meter row missing');
  const invoice = lease.invoices.find(x => x.billingPeriod === '2026-11'); assert(invoice, 'November invoice missing');
  assert.equal(Number(invoice.totalAmount), 3600000); assert.equal(Number(invoice.paidAmount), 3600000); assert.equal(Number(invoice.remainingAmount), 0);
  assert.deepEqual(invoice.items.map(x => Number(x.lineTotal)).sort((a,b) => a-b), [80000,100000,420000,3000000]);
  assert.equal(invoice.payments.filter(x => x.method === 'TRANSFER' && x.status === 'CONFIRMED').reduce((s,x) => s + Number(x.amount),0), 2000000);
  assert.equal(invoice.payments.filter(x => x.method === 'DEPOSIT' && x.status === 'CONFIRMED').reduce((s,x) => s + Number(x.amount),0), 1600000);
  assert(lease.settlement); assert.equal(Number(lease.settlement.received), 3000000);
  assert.equal(Number(lease.settlement.deduction), 300000); assert.equal(Number(lease.settlement.debtOffset), 1600000);
  assert.equal(Number(lease.settlement.refund), 1100000);
  const counts = await prisma.$transaction([
    prisma.property.count({ where: { id: property.id } }), prisma.room.count({ where: { propertyId: property.id } }),
    prisma.tenant.count({ where: { id: tenant.id, propertyId: property.id } }), prisma.lease.count({ where: { id: lease.id, roomId: room.id } }),
    prisma.handover.count({ where: { leaseId: lease.id } }), prisma.meterReading.count({ where: { roomId: room.id, billingPeriod: '2026-11' } }),
    prisma.invoice.count({ where: { id: invoice.id, leaseId: lease.id } }), prisma.invoiceItem.count({ where: { invoiceId: invoice.id } }),
    prisma.payment.count({ where: { invoiceId: invoice.id } }), prisma.settlement.count({ where: { leaseId: lease.id } }),
  ]);
  console.log(JSON.stringify({ propertyId: property.id, rooms: rooms.map(x => ({ id: x.id, code: x.roomCode })), tenantId: tenant.id,
    leaseId: lease.id, handovers: lease.handovers.map(x => ({ kind: x.kind, confirmed: Boolean(x.confirmedAt) })),
    reading: { id: meter.id, electric: `${meter.electricOld}->${meter.electricNew}`, water: `${meter.waterOld}->${meter.waterNew}` },
    invoice: { id: invoice.id, total: Number(invoice.totalAmount), paid: Number(invoice.paidAmount), debt: Number(invoice.remainingAmount), items: invoice.items.length },
    payments: invoice.payments.map(x => ({ id: x.id, method: x.method, amount: Number(x.amount), status: x.status })),
    settlement: { id: lease.settlement.id, received: Number(lease.settlement.received), deduction: Number(lease.settlement.deduction), offset: Number(lease.settlement.debtOffset), refund: Number(lease.settlement.refund) },
    image: { id: room.images[0].id, primary: room.images[0].isPrimary, type: room.images[0].mimeType, sizeBytes: room.images[0].sizeBytes, exists: true, fileBytes: statSync(imagePath).size }, counts,
  }));
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
