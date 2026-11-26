const assert = require('node:assert/strict');
const { mkdir } = require('node:fs/promises');
const { join } = require('node:path');
const { chromium } = require('playwright-core');

const origin = process.env.RENTFLOW_TEST_ORIGIN ?? 'http://127.0.0.1:32512';
const password = process.env.DEMO_PASSWORD;
const images = process.env.RENTFLOW_SCREENSHOTS;

const accounts = {
  testnguoidung: 'user', testchutro: 'owner', testquanly: 'manager',
  testadmin: 'admin', testnhanvien: 'staff', testketoan: 'accountant',
  testnguoidung2: 'user', testchutro2: 'owner', testquanly2: 'manager',
  'owner.a@rentflow.test': 'owner', 'owner.b@rentflow.test': 'owner',
  'renter.a@rentflow.test': 'user', 'renter.b@rentflow.test': 'user',
  'staff.a@rentflow.test': 'staff', 'accountant.a@rentflow.test': 'accountant',
  'user.demo@rentflow.test': 'user', 'manager.demo@rentflow.test': 'owner', 'admin.demo@rentflow.test': 'admin',
};

async function main() {
  assert(password, 'DEMO_PASSWORD is required');
  if (images) await mkdir(images, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.RENTFLOW_BROWSER_EXECUTABLE, headless: true });
  const contexts = new Map();
  const captured = new Set();
  try {
    for (const [account, portal] of Object.entries(accounts)) {
      const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, extraHTTPHeaders: { 'X-RentFlow-Web': '1' } });
      contexts.set(account, context);
      const page = await context.newPage();
      await page.goto(origin + '/login');
      const login = page.getByRole('button', { name: 'Đăng nhập', exact: true });
      await login.waitFor();
      if (images && contexts.size === 1) await page.screenshot({ path: join(images, 'login.png') });
      await page.locator('input[name=identifier]').fill(account);
      await page.locator('input[name=password]').fill(password);
      await login.click();
      await page.waitForURL('**/' + portal + '/dashboard', { timeout: 10000 });
      await page.getByRole('heading', { name: 'Tổng quan', exact: true }).waitFor({ timeout: 12000 });
      if (images && !captured.has(portal)) {
        await page.screenshot({ path: join(images, portal + '.png') });
        captured.add(portal);
      }
      if (account === 'testketoan') {
        await page.getByRole('button', { name: 'Hóa đơn & thanh toán', exact: true }).click();
        const downloaded = page.waitForEvent('download');
        await page.getByRole('button', { name: 'Xuất bảng kê CSV', exact: true }).click();
        assert.equal((await downloaded).suggestedFilename(), 'rentflow-cong-no.csv');
        console.log('PASS accountant exports scoped CSV');
      }
      console.log('PASS login via UI', account, portal);
      const wrongDashboard = portal === 'admin' ? 'owner' : 'admin';
      await page.goto(origin + '/' + wrongDashboard + '/dashboard');
      await page.getByRole('heading', { name: 'Không có quyền truy cập' }).waitFor({ timeout: 10000 });
      await page.close();
    }
    console.log('PASS wrong dashboard denied for all ' + contexts.size + ' accounts');
    const api = (account) => contexts.get(account).request;
    async function overview(account) {
      const r = await api(account).get(origin + '/api/overview');
      assert.equal(r.status(), 200);
      return r.json();
    }
    const manager = await overview('testquanly');
    const otherManager = await overview('testquanly2');
    assert.deepEqual(manager.properties.map(p => p.name), ['Khu trọ Minh']);
    assert.deepEqual(otherManager.properties.map(p => p.name), ['Khu trọ An']);
    const owner = await overview('testchutro');
    assert.deepEqual(owner.properties.map(p => p.name), ['Khu trọ Minh']);
    const renter = await overview('testnguoidung');
    assert.equal(renter.leases.length, 1);
    assert.equal(renter.invoices.length, 1);
    assert.equal((await overview('testnhanvien')).invoices.length, 0);
    assert.equal((await api('testquanly').get(origin + '/api/v10/admin')).status(), 403);
    assert.equal((await api('testadmin').get(origin + '/api/v10/manager')).status(), 403);
    console.log('PASS isolated property lists, renter ledger overview, staff finance restriction and admin/manager API guards');
    const renter2 = await overview('testnguoidung2');
    assert.equal((await api('testnguoidung').get(origin + '/api/leases/' + renter2.leases[0].id + '/ledger')).status(), 404);
    const ticketResponse = await api('testnguoidung').post(origin + '/api/v10/user/leases/' + renter.leases[0].id + '/maintenance', {
      data: { title: 'Kiểm tra bàn giao bảo trì', description: 'Yêu cầu từ bộ kiểm thử demo.' },
    });
    assert(ticketResponse.ok(), await ticketResponse.text());
    const ticket = await ticketResponse.json();
    const managerDesk = await (await api('testquanly').get(origin + '/api/v10/manager')).json();
    assert.equal(managerDesk.staff.length, 1);
    const assigneeId = managerDesk.staff[0].user.id;
    const assignPath = origin + '/api/v10/manager/maintenance/' + ticket.id + '/assign';
    assert.equal((await api('testquanly2').post(assignPath, { data: { assigneeId } })).status(), 404);
    assert((await api('testquanly').post(assignPath, { data: { assigneeId } })).ok());
    const staffDesk = await (await api('testnhanvien').get(origin + '/api/v10/manager')).json();
    assert(staffDesk.maintenance.some(row => row.id === ticket.id));
    const updatePath = origin + '/api/v10/manager/maintenance/' + ticket.id;
    assert((await api('testnhanvien').post(updatePath, { data: { status: 'IN_PROGRESS' } })).ok());
    assert((await api('testnhanvien').post(updatePath, { data: { status: 'DONE' } })).ok());
    const userDesk = await (await api('testnguoidung').get(origin + '/api/v10/user')).json();
    assert(userDesk.maintenance.some(row => row.id === ticket.id && row.status === 'DONE'));
    console.log('PASS renter lease isolation, maintenance assignment scope, staff progress and renter status');
    const logout = await api('testnguoidung').post(origin + '/api/logout', { data: {} });
    assert(logout.ok());
    assert.equal((await api('testnguoidung').get(origin + '/api/v10/me')).status(), 401);
    const mobile = await browser.newPage({ viewport: { width: 360, height: 780 } });
    await mobile.goto(origin + '/login');
    await mobile.getByRole('button', { name: 'Đăng nhập', exact: true }).waitFor();
    assert(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    if (images) await mobile.screenshot({ path: join(images, 'login-360.png') });
    console.log('PASS logout revokes session and mobile login fits 360px');
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
