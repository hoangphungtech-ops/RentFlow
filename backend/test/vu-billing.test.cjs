const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

const base = process.env.RENTFLOW_TEST_ORIGIN ?? 'http://127.0.0.1:3000';
const password = process.env.DEMO_PASSWORD;
const propertyId = '22222222-2222-4222-8222-222222222201';

async function createSession(identifier) {
  const res = await fetch(base + '/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-RentFlow-Web': '1' },
    body: JSON.stringify({ identifier, password }),
  });
  const body = await res.json().catch(() => ({}));
  assert(res.status === 200 || res.status === 201, 'Login failed: ' + res.status);
  const cookies = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  const cookie = cookies.map(item => item.split(';')[0]).join('; ');
  const headers = { 'Content-Type': 'application/json', 'X-RentFlow-Web': '1' };
  if (cookie) headers.Cookie = cookie;
  if (body && body.token) headers.Authorization = 'Bearer ' + body.token;
  return async (path, payload) => {
    const response = await fetch(base + '/api/' + path, {
      method: payload === undefined ? 'GET' : 'POST',
      headers,
      body: payload === undefined ? undefined : JSON.stringify(payload),
    });
    const json = await response.json().catch(() => ({}));
    return { status: response.status, body: json };
  };
}

test('VU-BILLING | cancel invoice, correct meter reading, reissue and guard paid invoice', async () => {
  assert.ok(password, 'Set DEMO_PASSWORD in backend/.env');
  const api = await createSession('owner.a@rentflow.test');
  const tag = 'VU-' + randomUUID().slice(0, 8);

  const roomRes = await api('properties/' + propertyId + '/rooms', {
    roomCode: tag, baseRentPrice: 3000000, maxOccupants: 2, status: 'AVAILABLE',
  });
  assert.equal(roomRes.status, 201);
  const room = roomRes.body;

  const tenantRes = await api('properties/' + propertyId + '/tenants', { fullName: 'Khách ' + tag });
  assert.equal(tenantRes.status, 201);

  const leaseRes = await api('leases', {
    roomId: room.id, representative: tenantRes.body.id,
    startDate: '2026-10-01', endDate: '2027-10-01', rentAmount: 3000000, depositAgreed: 2000000,
  });
  assert.equal(leaseRes.status, 201);
  const lease = leaseRes.body;

  const actRes = await api('leases/' + lease.id + '/activate', {});
  assert.equal(actRes.status, 201);

  const badMeter = await api('rooms/' + room.id + '/readings', {
    billingPeriod: '2026-11', electricOld: 100, electricNew: 300, waterOld: 20, waterNew: 25,
  });
  assert.equal(badMeter.status, 201);

  const wrongInv = await api('leases/' + lease.id + '/invoices', {
    billingPeriod: '2026-11', dueDate: '2026-12-05',
  });
  assert.equal(wrongInv.status, 201);
  assert.notEqual(Number(wrongInv.body.totalAmount), 3620000);

  const blockedCorrect = await api('rooms/' + room.id + '/readings/correct', {
    billingPeriod: '2026-11', electricOld: 100, electricNew: 220, waterOld: 20, waterNew: 25,
    reason: 'Thử sửa trước khi hủy hóa đơn',
  });
  assert(blockedCorrect.status >= 400 && blockedCorrect.status < 500, 'Expected 4xx, got ' + blockedCorrect.status);
  assert.match(String(blockedCorrect.body.message), /hủy hóa đơn trước/);

  const cancelRes = await api('invoices/' + wrongInv.body.id + '/cancel', {
    reason: 'Nhập nhầm chỉ số điện 300 thay vì 220',
  });
  assert.equal(cancelRes.status, 201);
  assert.equal(cancelRes.body.status, 'CANCELLED');
  assert.equal(cancelRes.body.activeFlag, null);

  const fixedMeter = await api('rooms/' + room.id + '/readings/correct', {
    billingPeriod: '2026-11', electricOld: 100, electricNew: 220, waterOld: 20, waterNew: 25,
    reason: 'Cập nhật lại đúng chỉ số công tơ 220',
  });
  assert.equal(fixedMeter.status, 201);

  const reissued = await api('leases/' + lease.id + '/invoices', {
    billingPeriod: '2026-11', dueDate: '2026-12-05',
  });
  assert.equal(reissued.status, 201);
  assert.notEqual(reissued.body.id, wrongInv.body.id);
  assert.equal(Number(reissued.body.totalAmount), 3620000);

  const payRes = await api('invoices/' + reissued.body.id + '/payments', {
    amount: 500000, method: 'TRANSFER', requestKey: randomUUID(),
  });
  assert.equal(payRes.status, 201);

  const blockedCancel = await api('invoices/' + reissued.body.id + '/cancel', {
    reason: 'Thử hủy khi đã có thanh toán chờ xác nhận',
  });
  assert(blockedCancel.status >= 400 && blockedCancel.status < 500, 'Expected 4xx, got ' + blockedCancel.status);
  assert.match(String(blockedCancel.body.message), /khoản thanh toán/);
});
