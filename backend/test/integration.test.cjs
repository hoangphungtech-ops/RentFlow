const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');

const db = new PrismaClient();
const base = process.env.RENTFLOW_TEST_ORIGIN ?? 'http://127.0.0.1:3000';
const password = process.env.DEMO_PASSWORD;
const seededLeaseId = '55555555-5555-4555-8555-555555555501';
const propertyB = '22222222-2222-4222-8222-222222222202';
const mintedSessions = [];
const unique = randomUUID().slice(0, 8);

async function api(path, options = {}) {
  const { token, data, expected = data ? 201 : 200 } = options;
  const res = await fetch(base + '/api/' + path, {
    method: data ? 'POST' : 'GET',
    headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(data ? { 'Content-Type': 'application/json' } : {}) },
    body: data && JSON.stringify(data),
    signal: AbortSignal.timeout(15000),
  });
  const result = await res.json();
  assert.equal(res.status, expected, path + ' ' + (res.ok ? '' : JSON.stringify(result)));
  return result;
}
async function login(name) {
  assert.ok(password, 'Set DEMO_PASSWORD in backend/.env and seed demo fixtures');
  const { token } = await api('login', { data: { email: name + '@rentflow.test', password }, expected: 200 });
  mintedSessions.push(token);
  return token;
}
const post = (token, path, data = {}, expected = 201) => api(path, { token, data, expected });
const ledger = (token, id = seededLeaseId, expected = 200) => api('leases/' + id + '/ledger', { token, expected });

after(async () => {
  try {
    await Promise.all(mintedSessions.map(token => fetch(base + '/api/logout', {
      method: 'POST', headers: { Authorization: 'Bearer ' + token }, signal: AbortSignal.timeout(3000),
    }).catch(() => undefined)));
  } finally { await db.$disconnect(); }
});

test('RF01–RF20 | MySQL 8, API proxied by Next, role scope and rental-to-settlement workflow', async t => {
  const [{ version }] = await db.$queryRaw`SELECT VERSION() AS version`;
  assert.match(version, /^8\./);
  assert.deepEqual(await api('health'), { status: 'ok' });
  const owner = await login('owner.a');
  const otherOwner = await login('owner.b');
  const staff = await login('staff.a');
  const renter = await login('renter.a');
  const outsider = await login('renter.b');
  const accountant = await login('accountant.a');
  const overview = await api('overview', { token: owner });
  const property = overview.properties.find(row => row.id === '22222222-2222-4222-8222-222222222201');
  await t.test('RF01 owner boundaries return a scoped list and 404 for foreign IDs', async () => {
    assert(!overview.properties.some(row => row.id === propertyB));
    await post(owner, 'properties/' + propertyB + '/rooms', { roomCode: unique, baseRentPrice: 1, maxOccupants: 1 }, 404);
    await ledger(otherOwner, seededLeaseId, 404);
  });
  await t.test('RF02 renter cannot read another contract or manage property', async () => {
    await ledger(outsider, seededLeaseId, 404);
    await ledger(renter);
    await api('overview', { expected: 401 });
  });
  await t.test('RF03 staff and accountant role limits', async () => {
    await post(staff, 'properties', { name: 'Restricted', address: 'Restricted' }, 403);
    await post(staff, 'leases/' + seededLeaseId + '/invoices', { billingPeriod: '2026-11', dueDate: '2026-12-05' }, 403);
    await post(accountant, 'leases/' + seededLeaseId + '/settlement', { deduction: 0, debtOffset: 0, reason: 'Restricted' }, 403);
  });
  await t.test('RF08–09 seeded invoice 3620000, confirmed 2000000 and pending 200000', async () => {
    const seeded = (await ledger(renter)).invoices.find(row => row.billingPeriod === '2026-11');
    assert.deepEqual([seeded.totalAmount, seeded.paidAmount, seeded.remainingAmount], ['3620000', '2000000', '1620000']);
    assert.deepEqual(seeded.items.map(row => Number(row.lineTotal)).sort((a,b) => a-b), [100000,100000,420000,3000000]);
    assert(seeded.payments.some(row => row.status === 'PENDING' && row.amount === '200000'));
    const electric = seeded.items.find(row => row.itemType === 'ELECTRICITY');
    assert.deepEqual([electric.meterStart, electric.meterEnd, electric.snapshotUnitPrice], ['100','220','3500']);
  });
  const room = await post(owner, 'properties/' + property.id + '/rooms', { roomCode: 'TEST-' + unique, baseRentPrice: 3000000, maxOccupants: 1 });
  const tenant = await post(staff, 'properties/' + property.id + '/tenants', { fullName: 'Người thuê kiểm thử ' + unique });
  const leaseData = { roomId: room.id, representative: tenant.id, startDate: '2026-10-01', endDate: '2027-10-01', rentAmount: 3000000, depositAgreed: 2000000 };
  await t.test('RF05 occupancy capacity is enforced', async () => {
    await post(owner, 'leases', { ...leaseData, occupants: [overview.tenants.find(row => row.id !== tenant.id).id] }, 409);
  });
  const lease = await post(owner, 'leases', leaseData);
  const competingLease = await post(owner, 'leases', leaseData);
  await t.test('RF04 activate one lease and reject another active lease in the same room', async () => {
    const outcomes = await Promise.allSettled([
      post(owner, 'leases/' + lease.id + '/activate'),
      post(owner, 'leases/' + competingLease.id + '/activate', {}, 409),
    ]);
    if (outcomes.some(row => row.status !== 'fulfilled')) {
      const a = await ledger(owner, lease.id);
      const b = await ledger(owner, competingLease.id);
      assert.deepEqual([a.status, b.status].sort(), ['ACTIVE','DRAFT']);
    }
  });
  const activeLease = (await ledger(owner, lease.id)).status === 'ACTIVE' ? lease : competingLease;
  const prefix = 'leases/' + activeLease.id;
  const entry = { kind: 'IN', date: '2026-10-01', condition: 'Bàn giao thử', inventory: 'Quạt', electric: 100, water: 20 };
  await post(staff, prefix + '/handovers', entry);
  await post(owner, prefix + '/handovers/IN/confirm');
  const reading = { billingPeriod: '2026-11', electricOld: 100, electricNew: 220, waterOld: 20, waterNew: 25 };
  const readingPath = 'rooms/' + room.id + '/readings';
  await t.test('RF06 negative meter rejected', async () => {
    await post(staff, readingPath, { ...reading, electricOld: -1 }, 400);
    await post(staff, readingPath, { ...reading, waterNew: 19 }, 409);
  });
  await post(staff, readingPath, reading);
  const invoiceInput = { billingPeriod: '2026-11', dueDate: '2026-12-05' };
  const invoice = await post(accountant, prefix + '/invoices', invoiceInput);
  await t.test('RF07–08 issued invoice snapshots rates and rejects duplicate invoice', async () => {
    assert.equal(invoice.totalAmount, '3620000');
    await post(owner, prefix + '/invoices', invoiceInput, 409);
    const scopedProperty = await post(owner, 'properties', { name: 'Bảng giá kiểm thử ' + unique, address: 'Địa chỉ mẫu' });
    const ratePath = 'properties/' + scopedProperty.id + '/rates';
    for (const [serviceType, unitPrice] of [['ELECTRICITY',3500],['WATER',20000],['SERVICE',100000]]) {
      await post(owner, ratePath, { serviceType, serviceName: serviceType, unit: 'đv', unitPrice, effectiveFrom: '2026-10-01' });
    }
    const priceRoom = await post(owner, 'properties/' + scopedProperty.id + '/rooms', { roomCode: 'RATE', baseRentPrice: 3000000, maxOccupants: 1 });
    const priceTenant = await post(owner, 'properties/' + scopedProperty.id + '/tenants', { fullName: 'Khách thử đơn giá' });
    const priceLease = await post(owner, 'leases', { ...leaseData, roomId: priceRoom.id, representative: priceTenant.id });
    await post(owner, 'leases/' + priceLease.id + '/activate');
    await post(owner, 'rooms/' + priceRoom.id + '/readings', reading);
    const fixed = await post(owner, 'leases/' + priceLease.id + '/invoices', invoiceInput);
    await post(owner, ratePath, { serviceType: 'ELECTRICITY', serviceName: 'Điện điều chỉnh', unit: 'kWh', unitPrice: 9000, effectiveFrom: '2026-10-15' });
    const snapshot = (await ledger(owner, priceLease.id)).invoices.find(row => row.id === fixed.id);
    assert.equal(snapshot.totalAmount, '3620000');
    assert.equal(snapshot.items.find(row => row.itemType === 'ELECTRICITY').snapshotUnitPrice, '3500');
  });
  const payPath = 'invoices/' + invoice.id + '/payments';
  const paymentData = { amount: 2000000, method: 'TRANSFER', requestKey: randomUUID() };
  await t.test('RF09–11 pending, repeated and concurrent confirm requests preserve debt', async () => {
    const [first, repeated] = await Promise.all([post(owner, payPath, paymentData), post(owner, payPath, paymentData)]);
    assert.equal(first.id, repeated.id);
    await post(owner, payPath, { ...paymentData, amount: 100 }, 409);
    assert.equal((await ledger(owner, activeLease.id)).invoices[0].remainingAmount, '3620000');
    const path = 'payments/' + first.id + '/confirm';
    const [confirmed, retried] = await Promise.all([post(accountant, path), post(accountant, path)]);
    for (const row of [confirmed, retried]) assert.deepEqual([row.paidAmount,row.remainingAmount], ['2000000','1620000']);
    const reversed = await post(accountant, 'payments/' + first.id + '/reverse', { reason: 'Đảo khoản thu thử' });
    assert.equal(reversed.remainingAmount, '3620000');
    const replacement = await post(owner, payPath, { ...paymentData, requestKey: randomUUID() });
    const settled = await post(accountant, 'payments/' + replacement.id + '/confirm');
    assert.equal(settled.remainingAmount, '1620000');
  });
  await post(owner, prefix + '/deposit', { amount: 2000000, reason: 'Đã nhận cọc thử' });
  await post(staff, prefix + '/handovers', { ...entry, kind: 'OUT', date: '2026-12-01', electric: 220, water: 25 });
  await post(owner, prefix + '/handovers/OUT/confirm');
  await t.test('RF12–13 and RF20 valid refund 1200000 and duplicate offset rejected', async () => {
    const input = { deduction: 300000, debtOffset: 500000, invoiceId: invoice.id, reason: 'Sửa chữa và bù nợ' };
    await post(owner, prefix + '/settlement', { ...input, deduction: 1800000 }, 409);
    await post(owner, prefix + '/settlement', { ...input, debtOffset: 1700000, deduction: 0 }, 409);
    const result = await post(owner, prefix + '/settlement', input);
    assert.deepEqual([result.received,result.deduction,result.debtOffset,result.refund], ['2000000','300000','500000','1200000']);
    await post(owner, prefix + '/settlement', input, 409);
    const final = await ledger(owner, activeLease.id);
    assert.equal(final.status, 'TERMINATED');
    assert.equal(final.invoices[0].remainingAmount, '1120000');
    assert.equal(final.invoices[0].payments.filter(row => row.method === 'DEPOSIT').length, 1);
    const updated = await api('overview', { token: owner });
    assert.equal(updated.properties.find(row => row.id === property.id).rooms.find(row => row.id === room.id).status, 'AVAILABLE');
  });
  await t.test('PR01 | verified deletion request, scoped status and operator processing', async () => {
    const email = 'deletion-' + unique + '@rentflow.test';
    const operator = (action, input) => execFileSync(process.execPath, ['dist/src/operator.js', action], {
      input: JSON.stringify(input), encoding: 'utf8',
    });
    const account = JSON.parse(operator('create', { email, fullName: 'Người thuê kiểm thử xóa', role: 'RENTER', password: password + 'Test16!' }));
    const loginData = { email, password: password + 'Test16!' };
    const { token } = await api('login', { data: loginData, expected: 200 });
    mintedSessions.push(token);
    await post(token, 'account/deletion-request', { password: 'incorrect' }, 401);
    const first = await post(token, 'account/deletion-request', { password: loginData.password });
    const repeated = await post(token, 'account/deletion-request', { password: loginData.password });
    assert.deepEqual(first, repeated);
    assert.equal(first.status, 'PENDING');
    assert.equal((await api('account/deletion-request', { token: owner })).request, null);
    operator('close-renter', { userId: account.id, reviewerId: overview.actor.id,
      disposition: 'ERASED', evidence: 'Bằng chứng thử nghiệm ' + unique });
    await api('overview', { token, expected: 401 });
    await api('login', { data: loginData, expected: 401 });
    assert.equal((await db.accountDeletionRequest.findUnique({ where: { userId: account.id } })).status, 'ERASED');
    assert.equal(await db.user.findUnique({ where: { email } }), null);
  });
  await t.test('RF15 / RF17 Next proxy persists trial in MySQL', async () => {
    const page = await fetch(base);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /Đăng ký dùng thử/);
    const trial = await api('trials', { data: { fullName: 'Demo ' + unique, contact: unique + '@rentflow.test', roomCount: 10 } });
    assert.equal((await db.trialLead.findUnique({ where: { id: trial.id } })).roomCount, 10);
  });
});
