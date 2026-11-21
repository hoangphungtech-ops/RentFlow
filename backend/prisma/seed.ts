import {
  PrismaClient,
  RoomStatus,
  UtilityServiceType,
  InvoiceStatus,
  InvoiceItemType,
  UserRoleStub,
  LeaseStatusStub,
} from "@prisma/client";
import Decimal from "decimal.js";
import { passwordHash } from "../src/auth";

const prisma = new PrismaClient();

function roundVnd(value: Decimal): Decimal {
  return value.toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
}

const IDS = {
  OWNER_A: "11111111-1111-4111-8111-111111111101",
  OWNER_B: "11111111-1111-4111-8111-111111111102",
  STAFF_A: "11111111-1111-4111-8111-111111111103",
  ACCOUNTANT_A: "11111111-1111-4111-8111-111111111104",
  RENTER_A: "11111111-1111-4111-8111-111111111105",
  RENTER_B: "11111111-1111-4111-8111-111111111106",
  PROP_A: "22222222-2222-4222-8222-222222222201",
  PROP_B: "22222222-2222-4222-8222-222222222202",
  ROOM_A_R101: "33333333-3333-4333-8333-333333333301",
  ROOM_A_R102: "33333333-3333-4333-8333-333333333302",
  ROOM_A_R103: "33333333-3333-4333-8333-333333333303",
  ROOM_B_R101: "33333333-3333-4333-8333-333333333304",
  RATE_ELEC_A: "44444444-4444-4444-8444-444444444401",
  RATE_WATER_A: "44444444-4444-4444-8444-444444444402",
  RATE_SVC_A: "44444444-4444-4444-8444-444444444403",
  LEASE_A: "55555555-5555-4555-8555-555555555501",
  METER_A_2026_11: "66666666-6666-4666-8666-666666666601",
  INVOICE_A_2026_11: "77777777-7777-4777-8777-777777777701",
};

async function main() {
  console.log("Dang nap bo du lieu mau RentFlow V2.0...");

  const users = [
    {
      id: IDS.OWNER_A,
      email: "owner.a@rentflow.test",
      fullName: "OWNER_A (Chu khu A)",
      role: UserRoleStub.OWNER,
    },
    {
      id: IDS.OWNER_B,
      email: "owner.b@rentflow.test",
      fullName: "OWNER_B (Chu khu B)",
      role: UserRoleStub.OWNER,
    },
    {
      id: IDS.STAFF_A,
      email: "staff.a@rentflow.test",
      fullName: "STAFF_A (Nhan vien khu A)",
      role: UserRoleStub.STAFF,
    },
    {
      id: IDS.ACCOUNTANT_A,
      email: "accountant.a@rentflow.test",
      fullName: "ACCOUNTANT_A (Ke toan)",
      role: UserRoleStub.ACCOUNTANT,
    },
    {
      id: IDS.RENTER_A,
      email: "renter.a@rentflow.test",
      fullName: "RENTER_A (Nguoi thue R101)",
      role: UserRoleStub.RENTER,
    },
    {
      id: IDS.RENTER_B,
      email: "renter.b@rentflow.test",
      fullName: "RENTER_B (Nguoi thue B)",
      role: UserRoleStub.RENTER,
    },
  ];

  const password = process.env.DEMO_PASSWORD;
  if (!password || password.length < 12) throw new Error("Configure DEMO_PASSWORD (minimum 12 characters)");
  const hash = passwordHash(password);
  for (const u of users) {
    await prisma.user.upsert({
      where: { id: u.id },
      update: { passwordHash: hash },
      create: { ...u, passwordHash: hash },
    });
  }

  await prisma.property.upsert({
    where: { id: IDS.PROP_A },
    update: {},
    create: {
      id: IDS.PROP_A,
      ownerId: IDS.OWNER_A,
      name: "Khu tro A (Thi diem)",
      address: "101 Duong Mau A, TP.HCM",
      description: "Khu tro du lieu gia lap kiem thu tich hop",
    },
  });

  await prisma.property.upsert({
    where: { id: IDS.PROP_B },
    update: {},
    create: {
      id: IDS.PROP_B,
      ownerId: IDS.OWNER_B,
      name: "Khu tro B (Cach ly quyen)",
      address: "202 Duong Mau B, TP.HCM",
      description: "Dung kiem thu Owner A khong xem duoc du lieu Owner B",
    },
  });

  const rooms = [
    {
      id: IDS.ROOM_A_R101,
      propertyId: IDS.PROP_A,
      roomCode: "R101",
      baseRentPrice: "3000000.00",
      maxOccupants: 2,
      status: RoomStatus.OCCUPIED,
    },
    {
      id: IDS.ROOM_A_R102,
      propertyId: IDS.PROP_A,
      roomCode: "R102",
      baseRentPrice: "2800000.00",
      maxOccupants: 2,
      status: RoomStatus.AVAILABLE,
    },
    {
      id: IDS.ROOM_A_R103,
      propertyId: IDS.PROP_A,
      roomCode: "R103",
      baseRentPrice: "3000000.00",
      maxOccupants: 2,
      status: RoomStatus.MAINTENANCE,
    },
    {
      id: IDS.ROOM_B_R101,
      propertyId: IDS.PROP_B,
      roomCode: "R101",
      baseRentPrice: "3200000.00",
      maxOccupants: 2,
      status: RoomStatus.AVAILABLE,
    },
  ];

  for (const r of rooms) {
    await prisma.room.upsert({
      where: { id: r.id },
      update: {},
      create: r,
    });
  }

  const effectiveDate = new Date("2026-10-01T00:00:00.000Z");
  const rates = [
    {
      id: IDS.RATE_ELEC_A,
      propertyId: IDS.PROP_A,
      serviceType: UtilityServiceType.ELECTRICITY,
      serviceName: "Dien sinh hoat (mau)",
      unit: "kWh",
      unitPrice: "3500.00",
      effectiveFrom: effectiveDate,
    },
    {
      id: IDS.RATE_WATER_A,
      propertyId: IDS.PROP_A,
      serviceType: UtilityServiceType.WATER,
      serviceName: "Nuoc sinh hoat (mau)",
      unit: "m3",
      unitPrice: "20000.00",
      effectiveFrom: effectiveDate,
    },
    {
      id: IDS.RATE_SVC_A,
      propertyId: IDS.PROP_A,
      serviceType: UtilityServiceType.SERVICE,
      serviceName: "Dich vu chung (Rac + Wifi)",
      unit: "thang",
      unitPrice: "100000.00",
      effectiveFrom: effectiveDate,
    },
  ];

  for (const rate of rates) {
    await prisma.utilityRate.upsert({
      where: { id: rate.id },
      update: {},
      create: rate,
    });
  }

  await prisma.lease.upsert({
    where: { id: IDS.LEASE_A },
    update: {},
    create: {
      id: IDS.LEASE_A,
      roomId: IDS.ROOM_A_R101,
      rentAmount: "3000000.00",
      billingCycleMonths: 1,
      depositAgreed: "3000000.00",
      depositReceived: "2000000.00",
      startDate: new Date("2026-10-01T00:00:00.000Z"),
      endDate: new Date("2027-10-01T00:00:00.000Z"),
      status: LeaseStatusStub.ACTIVE,
    },
  });

  await prisma.meterReading.upsert({
    where: { id: IDS.METER_A_2026_11 },
    update: {},
    create: {
      id: IDS.METER_A_2026_11,
      roomId: IDS.ROOM_A_R101,
      billingPeriod: "2026-11",
      electricOld: "100.00",
      electricNew: "220.00",
      waterOld: "20.00",
      waterNew: "25.00",
      recordedById: IDS.STAFF_A,
    },
  });

  const rentLine = roundVnd(new Decimal(1).mul(3000000));
  const elecLine = roundVnd(new Decimal(120).mul(3500));
  const waterLine = roundVnd(new Decimal(5).mul(20000));
  const svcLine = roundVnd(new Decimal(1).mul(100000));
  const totalAmount = rentLine.plus(elecLine).plus(waterLine).plus(svcLine);

  await prisma.invoice.upsert({
    where: { id: IDS.INVOICE_A_2026_11 },
    update: {},
    create: {
      id: IDS.INVOICE_A_2026_11,
      leaseId: IDS.LEASE_A,
      billingPeriod: "2026-11",
      activeFlag: 1,
      idempotencyKey: "SEED-LEASE_A-2026-11",
      totalAmount: totalAmount.toFixed(2),
      paidAmount: "0.00",
      remainingAmount: totalAmount.toFixed(2),
      dueDate: new Date("2026-12-05T16:59:59.000Z"),
      status: InvoiceStatus.ISSUED,
      issuedAt: new Date("2026-11-20T03:00:00.000Z"),
      items: {
        create: [
          {
            itemType: InvoiceItemType.RENT,
            description: "Tien thue phong R101 ky 2026-11",
            quantity: "1.00",
            snapshotUnitPrice: "3000000.00",
            lineTotal: rentLine.toFixed(2),
          },
          {
            itemType: InvoiceItemType.ELECTRICITY,
            description: "Tien dien ky 2026-11 (220 - 100 = 120 kWh)",
            meterStart: 100, meterEnd: 220,
            quantity: "120.00",
            snapshotUnitPrice: "3500.00",
            lineTotal: elecLine.toFixed(2),
          },
          {
            itemType: InvoiceItemType.WATER,
            description: "Tien nuoc ky 2026-11 (25 - 20 = 5 m3)",
            meterStart: 20, meterEnd: 25,
            quantity: "5.00",
            snapshotUnitPrice: "20000.00",
            lineTotal: waterLine.toFixed(2),
          },
          {
            itemType: InvoiceItemType.SERVICE,
            description: "Phi dich vu chung ky 2026-11",
            quantity: "1.00",
            snapshotUnitPrice: "100000.00",
            lineTotal: svcLine.toFixed(2),
          },
        ],
      },
    },
  });

  for (const userId of [IDS.STAFF_A, IDS.ACCOUNTANT_A]) {
    await prisma.propertyAccess.upsert({ where: { propertyId_userId: { propertyId: IDS.PROP_A, userId } },
      update: {}, create: { propertyId: IDS.PROP_A, userId } });
  }
  for (let n = 104; n <= 110; n++) {
    const roomCode = "R" + n;
    await prisma.room.upsert({ where: { propertyId_roomCode: { propertyId: IDS.PROP_A, roomCode } },
      update: {}, create: { propertyId: IDS.PROP_A, roomCode, baseRentPrice: 2800000 } });
  }
  const representative = await prisma.tenant.upsert({
    where: { propertyId_userId: { propertyId: IDS.PROP_A, userId: IDS.RENTER_A } },
    update: {}, create: { propertyId: IDS.PROP_A, userId: IDS.RENTER_A, fullName: "Ng??i thu? m?u A" },
  });
  const companion = await prisma.tenant.upsert({
    where: { id: "88888888-8888-4888-8888-888888888801" }, update: {},
    create: { id: "88888888-8888-4888-8888-888888888801", propertyId: IDS.PROP_A, fullName: "Ng??i ? c?ng m?u" },
  });
  await prisma.leaseTenant.createMany({ data: [
    { leaseId: IDS.LEASE_A, tenantId: representative.id, representative: true },
    { leaseId: IDS.LEASE_A, tenantId: companion.id, representative: false },
  ], skipDuplicates: true });
  await prisma.handover.upsert({ where: { leaseId_kind: { leaseId: IDS.LEASE_A, kind: "IN" } },
    update: {}, create: { leaseId: IDS.LEASE_A, kind: "IN", date: effectiveDate, confirmedAt: effectiveDate,
      condition: "Ph?ng s?ch, thi?t b? ho?t ??ng", inventory: "M?t gi??ng, m?t qu?t", electric: 100, water: 20 } });
  await prisma.$transaction(async tx => {
    const invoiceId = IDS.INVOICE_A_2026_11;
    const requestKey = "99999999-9999-4999-8999-999999999901";
    const prior = await tx.payment.findUnique({ where: { invoiceId_requestKey: { invoiceId, requestKey } } });
    if (prior) return;
    await tx.payment.createMany({ data: [
      { invoiceId, requestKey, amount: 2000000, method: "TRANSFER", status: "CONFIRMED", confirmedAt: new Date() },
      { invoiceId, requestKey: "99999999-9999-4999-8999-999999999902", amount: 200000, method: "TRANSFER" },
    ] });
    await tx.invoice.update({ where: { id: invoiceId }, data: {
      paidAmount: 2000000, remainingAmount: totalAmount.minus(2000000).toFixed(2), status: "PARTIALLY_PAID",
    } });
  });

  await prisma.$transaction(async tx => {
    const leaseId = "55555555-5555-4555-8555-555555555502";
    if (await tx.lease.findUnique({ where: { id: leaseId } })) return;
    const checkoutRoom = await tx.room.findUniqueOrThrow({
      where: { propertyId_roomCode: { propertyId: IDS.PROP_A, roomCode: "R110" } },
    });
    const checkout = new Date("2026-11-15T00:00:00+07:00");
    const invoiceId = "77777777-7777-4777-8777-777777777702";
    const received = new Decimal(2000000);
    const deduction = new Decimal(300000);
    const debtOffset = new Decimal(500000);
    await tx.lease.create({ data: {
      id: leaseId, roomId: checkoutRoom.id, rentAmount: 500000, depositAgreed: received.toFixed(2),
      depositReceived: received.toFixed(2), startDate: effectiveDate, endDate: checkout, status: "TERMINATED",
      tenants: { create: { tenantId: representative.id, representative: true } },
      handovers: { create: [
        { kind: "IN", date: effectiveDate, confirmedAt: effectiveDate, condition: "Ph?ng nguy?n tr?ng", inventory: "M?t qu?t", electric: 0, water: 0 },
        { kind: "OUT", date: checkout, confirmedAt: checkout, condition: "C?ng t?c qu?t c?n s?a", inventory: "M?t qu?t", electric: 0, water: 0 },
      ] },
      invoices: { create: {
        id: invoiceId, billingPeriod: "2026-11", totalAmount: 500000, paidAmount: 500000, remainingAmount: 0,
        dueDate: checkout, issuedAt: checkout, status: "PAID",
        items: { create: { itemType: "RENT", description: "Ti?n thu? c?n l?i", quantity: 1, snapshotUnitPrice: 500000, lineTotal: 500000 } },
        payments: { create: {
          requestKey: "99999999-9999-4999-8999-999999999903", amount: debtOffset.toFixed(2), method: "DEPOSIT",
          status: "CONFIRMED", confirmedAt: checkout,
        } },
      } },
      settlement: { create: {
        received: received.toFixed(2), deduction: deduction.toFixed(2), debtOffset: debtOffset.toFixed(2),
        refund: received.minus(deduction).minus(debtOffset).toFixed(2), invoiceId, confirmedBy: IDS.OWNER_A,
        reason: "S?a c?ng t?c qu?t theo bi?n b?n tr? ph?ng v? b? ti?n thu? c?n l?i", createdAt: checkout,
      } },
    } });
    await tx.notification.create({ data: { userId: IDS.RENTER_A, event: "settlement:" + leaseId, message: "?? ch?t quy?t to?n c?c ph?ng R110" } });
  });

  console.log(
    `Seed hoan tat! Tong hoa don mau R101 ky 2026-11 = ${totalAmount.toFixed(0)} VND`,
  );
}

main()
  .catch((error: unknown) => {
    const code = error && typeof error === "object" && "code" in error ? error.code : "configuration";
    console.error("Seed failed. Check demo configuration and migration status.", code);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
