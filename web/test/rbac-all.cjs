const assert = require('node:assert/strict');
const { mkdir } = require('node:fs/promises');
const { join } = require('node:path');
const { chromium } = require('playwright-core');
const { randomUUID } = require('node:crypto');
const fullUiFlows = require('./full-ui-flows.cjs');

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
      const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
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
      await page.getByRole('heading', { name: portal === 'user' ? 'Tìm phòng phù hợp' : portal === 'owner' ? 'Tổng quan vận hành' : 'Tổng quan', exact: true }).waitFor({ timeout: 12000 });
      if (account === 'testnguoidung') {
        await page.getByRole('heading', { name: 'Studio An Bình' }).waitFor();
        await page.getByLabel('Tìm phòng, tuyến đường, khu vực').fill('studio an binh');
        await page.getByLabel('Trạng thái phòng').selectOption('AVAILABLE');
        assert.equal(await page.locator('.rental-grid article').count(), 1);
        await page.getByLabel('Tìm phòng, tuyến đường, khu vực').clear();
        console.log('PASS renter lands directly on listing gallery with accent-insensitive search');
      }
      if (account === 'testchutro') {
        await page.getByRole('heading', { name: 'Doanh thu 12 tháng' }).waitFor();
        if (images) await page.screenshot({ path: join(images, 'owner-operations.png') });

        await page.getByRole('button', { name: 'Xem phòng trống', exact: true }).click();
        assert.equal(await page.getByLabel('Trạng thái phòng', { exact: true }).inputValue(), 'AVAILABLE');
        const site = page.getByLabel('Cơ sở và địa chỉ');
        assert.equal(await site.locator('optgroup[label="Bình Thạnh"]').count(), 1);
        await site.selectOption({ index: 1 });
        await page.getByRole('heading', { name: 'Khu trọ Minh', exact: true }).waitFor();
        await page.getByText('Địa chỉ trong bản demo là dữ liệu minh họa.').waitFor();
        if (images) await page.screenshot({ path: join(images, '08-co-so-va-phong-trong.png') });
        console.log('PASS owner room metric opens filtered inventory grouped by address');
      }
      for (const width of [360, 768, 1366]) {
        await page.setViewportSize({ width, height: 900 });
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), portal + ' overflows at ' + width);
      }
      if (account === 'testnguoidung') {
        await page.setViewportSize({ width: 360, height: 780 });
        await page.getByRole('navigation', { name: 'Điều hướng nhanh người thuê' }).getByRole('button', { name: 'Hóa đơn', exact: true }).click();
        await page.getByRole('button', { name: 'Xem chi tiết từng khoản' }).waitFor();
        if (images) await page.screenshot({ path: join(images, 'user-invoice-360.png') });
        await page.setViewportSize({ width: 1366, height: 900 });
        await page.getByRole('navigation', { name: 'Quản lý' }).getByRole('button', { name: 'Tìm phòng', exact: true }).click();
        await page.getByRole('heading', { name: 'Studio An Bình' }).waitFor();
      }
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
    const api = account => {
      const fetch = (url, options) => contexts.get(account).request.fetch(url, {
        ...options, headers: { ...options?.headers, 'X-RentFlow-Web': '1' },
      });
      return {
        fetch,
        get: (url, options) => fetch(url, { ...options, method: 'GET' }),
        post: (url, options) => fetch(url, { ...options, method: 'POST' }),
      };
    };
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
    const ticketTitle = 'Kiểm tra bảo trì ' + randomUUID().slice(0, 8);
    const ticketResponse = await api('testnguoidung').post(origin + '/api/v10/user/leases/' + renter.leases[0].id + '/maintenance', {
      data: { title: ticketTitle, description: 'Yêu cầu từ bộ kiểm thử demo.' },
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
    if (process.env.RENTFLOW_FULL_UI === '1') {
      await fullUiFlows({ origin, contexts, api, images, owner, renter, renter2, ticket, ticketTitle });
    }
    const logout = await api('testnguoidung').post(origin + '/api/logout', { data: {} });
    assert(logout.ok());
    assert.equal((await api('testnguoidung').get(origin + '/api/v10/me')).status(), 401);
    const switchPage = await contexts.get('testnguoidung').newPage();
    await switchPage.goto(origin + '/login');
    await switchPage.locator('input[name=identifier]').fill('testquanly');
    await switchPage.locator('input[name=password]').fill(password);
    await switchPage.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
    await switchPage.waitForURL('**/manager/dashboard');
    await switchPage.goto(origin + '/user/dashboard');
    await switchPage.getByRole('heading', { name: 'Không có quyền truy cập' }).waitFor();
    await switchPage.getByRole('link', { name: 'Về giao diện của bạn' }).click();
    await switchPage.waitForURL('**/manager/dashboard');
    console.log('PASS same browser switches from renter to manager and the denied page leads to the correct portal');
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
