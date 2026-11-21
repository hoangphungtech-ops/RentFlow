const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { mkdtempSync, readFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { PrismaClient } = require('@prisma/client');

const db = new PrismaClient();
const base = process.env.RENTFLOW_TEST_ORIGIN ?? 'http://127.0.0.1:3000';
const demo = process.env.DEMO_PASSWORD;
const adminPassword = process.env.DEMO_ADMIN_PASSWORD;
const random = () => randomBytes(18).toString('hex');
const propertyB = '22222222-2222-4222-8222-222222222202';
const issued = [];

async function call(path, { body, token, expected = body ? 201 : 200, headers = {} } = {}) {
  const response = await fetch(base + '/api/' + path, {
    method: body ? 'POST' : 'GET',
    headers: { ...headers, ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10000),
  });
  assert.equal(response.status, expected, path);
  const data = await response.json();
  assert(!JSON.stringify(data).includes('passwordHash'), path + ' exposes a hash field');
  return { data, response };
}

async function login(identifier, password, expected = 200) {
  const { data } = await call('login', { body: { identifier, password }, expected });
  if (data.token) issued.push(data.token);
  return data;
}

test.after(async () => {
  try { await Promise.allSettled(issued.map(token => call('logout', { body: {}, token, expected: 200 }))); }
  finally { await db.$disconnect(); }
});

test('V6 account lifecycle and isolation on MySQL', async t => {
  assert(adminPassword && demo, 'Configure demo passwords in private env files');
  const tag = random().slice(0, 12);
  const firstPassword = random();
  const changedPassword = random();
  const resetPassword = random();
  let owner;
  await t.test('ADMIN-01,03,17 testadmin username login and legacy-safe HttpOnly web cookie', async () => {
    owner = await login('TESTADMIN', adminPassword);
    assert.equal(owner.actor.role, 'OWNER');
    await login('testadmin', random(), 401);
    const { response, data } = await call('login', { body: { identifier: 'testadmin', password: adminPassword },
      headers: { 'X-RentFlow-Web': '1' }, expected: 200 });
    assert.equal(data.token, undefined);
    const cookie = response.headers.get('set-cookie');
    assert(cookie.includes('HttpOnly') && cookie.includes('SameSite=Strict'));
    const credentials = { Cookie: cookie.split(';')[0] };
    await call('account/me', { headers: credentials, expected: 401 });
    const headers = { ...credentials, 'X-RentFlow-Web': '1' };
    await call('account/me', { headers });
    await call('logout', { body: {}, headers, expected: 200 });
    await call('account/me', { headers, expected: 401 });
  });
  const token = owner.token;
  const { data: overview } = await call('overview', { token });
  const property = overview.properties[0].id;
  const details = { fullName: 'V6 Test ' + tag, username: 'v6-' + tag, email: tag + '@rentflow.test', role: 'STAFF', propertyId: property };
  let staff, invite, session;
  await t.test('ADMIN-04,05,06,07 invitation, duplicate username and owner boundaries', async () => {
    await call('accounts', { token, body: { ...details, propertyId: propertyB }, expected: 404 });
    await call('accounts', { token, body: { ...details, role: 'OWNER' }, expected: 400 });
    const { data } = await call('accounts', { token, body: details });
    staff = data.user; invite = data.invitation.code;
    await call('accounts', { token, body: { ...details, username: details.username.toUpperCase(), email: 'dup-' + details.email }, expected: 409 });
    await login(details.username, firstPassword, 401);
    const body = { code: invite, newPassword: firstPassword, confirmPassword: firstPassword };
    await call('auth/activate', { body, expected: 200 });
    await call('auth/activate', { body, expected: 401 });
    session = await login(details.username, firstPassword);
    await call('accounts', { token: session.token, body: { ...details, role: 'OWNER' }, expected: 403 });
    const other = await login('owner.b@rentflow.test', demo);
    await call('accounts/' + staff.id + '/control', { token: other.token, body: { action: 'LOCK' }, expected: 404 });
    await call('properties/' + propertyB + '/access', { token: other.token, body: { email: details.email, operation: 'GRANT' }, expected: 404 });
  });

  await t.test('ADMIN-08,09,10 password policy and session revocation', async () => {
    const second = await login(details.email, firstPassword);
    const body = { currentPassword: firstPassword, newPassword: changedPassword, confirmPassword: changedPassword };
    const auth = { token: session.token };
    await call('account/password/change', { ...auth, body: { ...body, currentPassword: random() }, expected: 401 });
    await call('account/password/change', { ...auth, body: { ...body, confirmPassword: random() }, expected: 409 });
    await call('account/password/change', { ...auth, body: { ...body, newPassword: 'short', confirmPassword: 'short' }, expected: 400 });
    await call('account/password/change', { ...auth, body });
    await call('account/me', { token: second.token, expected: 401 });
    await call('account/me', { token: session.token, expected: 401 });
    await login(details.username, firstPassword, 401);
    session = await login(details.username, changedPassword);
  });

  await t.test('ADMIN-11,12,13 generic recovery response, expiry, single-use and CLI issuance', async () => {
    const known = await call('auth/forgot-password', { body: { email: details.email }, expected: 200 });
    const unknown = await call('auth/forgot-password', { body: { email: 'missing-' + details.email }, expected: 200 });
    assert.deepEqual(known.data, unknown.data);
    assert(!known.data.code);
    const dir = mkdtempSync(join(tmpdir(), 'rentflow-test-reset-'));
    try {
      const outputFile = join(dir, 'reset.json');
      const ops = spawnSync(process.execPath, ['dist/src/operator.js', 'issue-reset'], {
        input: JSON.stringify({ userId: staff.id, outputFile, evidence: 'Verified synthetic test account' }), encoding: 'utf8',
      });
      assert.equal(ops.status, 0, 'operator reset issuance failed');
      const { code } = JSON.parse(readFileSync(outputFile, 'utf8'));
      assert(!ops.stdout.includes(code));
      const body = { code, newPassword: resetPassword, confirmPassword: resetPassword };
      await db.accountCode.update({ where: { userId_kind: { userId: staff.id, kind: 'RESET' } }, data: { expiresAt: new Date(0) } });
      await call('auth/reset-password', { body, expected: 401 });
      const renewed = join(dir, 'renewed.json');
      const result = spawnSync(process.execPath, ['dist/src/operator.js', 'issue-reset'], {
        input: JSON.stringify({ userId: staff.id, outputFile: renewed, evidence: 'Verified synthetic test account' }), encoding: 'utf8',
      });
      assert.equal(result.status, 0);
      body.code = JSON.parse(readFileSync(renewed, 'utf8')).code;
      await call('auth/reset-password', { body, expected: 200 });
      await call('auth/reset-password', { body, expected: 401 });
      await call('account/me', { token: session.token, expected: 401 });
      session = await login(details.username, resetPassword);
    } finally {
      for (const name of ['reset.json', 'renewed.json']) rmSync(join(dir,name), { force: true });
    }
  });

  await t.test('ADMIN-14,15 lock, unlock, property revoke and role change', async () => {
    await call('properties/' + property + '/access', { token, body: { email: details.email, operation: 'REVOKE' } });
    assert.equal((await call('overview', { token: session.token })).data.properties.length, 0);
    await call('accounts/' + staff.id + '/control', { token, body: { action: 'LOCK' } });
    await call('account/me', { token: session.token, expected: 401 });
    await login(details.username, resetPassword, 401);
    await call('accounts/' + staff.id + '/control', { token, body: { action: 'UNLOCK' } });
    session = await login(details.username, resetPassword);
    await call('accounts/' + staff.id + '/profile', { token, body: {
      username: details.username, fullName: details.fullName, role: 'ACCOUNTANT',
    } });
    await call('account/me', { token: session.token, expected: 401 });
    assert.equal((await login(details.username, resetPassword)).actor.role, 'ACCOUNTANT');
  });

  await t.test('ADMIN-02 production provisioning command refuses demo credentials', () => {
    const result = spawnSync(process.execPath, ['dist/src/provision-demo-admin.js'], {
      env: { ...process.env, NODE_ENV: 'production' }, encoding: 'utf8',
    });
    assert.notEqual(result.status, 0);
    assert(!result.stderr.includes(adminPassword));
  });
  await t.test('ADMIN-16 limiter sets Retry-After without a real login attempt', () => {
    const { sensitiveRateLimit } = require('../dist/src/rate-limit.js');
    let forwarded = 0;
    let rejected = 0;
    let retry;
    const res = { status(code) { assert.equal(code, 429); return this; }, json() { rejected++; },
      setHeader(key,value) { if (key === 'Retry-After') retry = Number(value); } };
    for (let n=0; n<31; n++) sensitiveRateLimit({ method: 'POST', path: '/api/login', ip: 'test-only' }, res, () => forwarded++);
    assert.equal(forwarded, 30); assert.equal(rejected, 1); assert(retry > 0);
  });
});
