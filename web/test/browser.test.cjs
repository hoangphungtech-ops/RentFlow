const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const { randomUUID } = require('node:crypto');

const base = 'http://127.0.0.1:3000';
const password = process.env.DEMO_PASSWORD;
async function login(page, email) {
  await page.goto(base + '/quan-ly');
  await page.getByRole('textbox', { name: 'Tên đăng nhập hoặc email' }).fill(email + '@rentflow.test');
  await page.getByLabel('Mật khẩu').fill(password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.getByRole('heading', { name: 'Tổng quan' }).waitFor();
}
async function noOverflow(page) {
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
}

test('Edge | admin, renter at 360/768/1366px, trial form and offline recovery', async t => {
  assert.ok(password, 'Set DEMO_PASSWORD in backend/.env and seed demo fixtures');
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const width of [360, 768, 1366]) {
      await t.test('RF15 | renter ledger at ' + width + 'px', async () => {
        const page = await browser.newPage({ viewport: { width, height: 900 } });
        try {
          await login(page, 'renter.a');
          await page.getByRole('button', { name: /R101/ }).click();
          await page.getByText('Xem cách tính').click();
          await page.getByText(/220 − 100/).waitFor();
          await page.getByText(/Còn nợ 1\.620\.000/).last().waitFor();
          if (width === 1366 && process.env.RENTFLOW_CAPTURE === '1') {
            await page.locator('.invoice').screenshot({ path: 'public/so-doi-chieu-r101.png' });
          }
          await page.getByRole('button', { name: /R110/ }).click();
          await page.getByText('Xem quyết toán').click();
          await page.getByText(/Hoàn cọc 1\.200\.000/).waitFor();
          await noOverflow(page);
          await page.getByRole('button', { name: 'Đăng xuất' }).click();
          await page.getByRole('heading', { name: 'Đăng nhập RentFlow' }).waitFor();
        } finally { await page.close(); }
      });
    }

    await t.test('RF15 | owner sees scoped rooms and payment forms', async () => {
      const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
      try {
        await login(page, 'owner.a');
        await page.getByRole('button', { name: 'Khu trọ & phòng' }).click();
        await page.getByRole('heading', { name: 'Cập nhật phòng' }).waitFor();
        await page.getByLabel('Tìm phòng').fill('r103');
        await page.getByText('R103', { exact: true }).waitFor();
        assert.equal(await page.getByText('R101', { exact: true }).count(), 0);
        await page.getByRole('button', { name: 'Hóa đơn & thanh toán' }).click();
        await page.getByRole('heading', { name: 'Phát hành hóa đơn' }).waitFor();
        await page.getByRole('button', { name: 'Cài đặt' }).click();
        await page.getByRole('heading', { name: 'Phân quyền theo khu trọ' }).waitFor();
        await noOverflow(page);
      } finally { await page.close(); }
    });

    await t.test('ADMIN UI | create and activate staff via the shared API at 360px', async () => {
      const page = await browser.newPage({ viewport: { width: 360, height: 900 } });
      const adminPassword = process.env.DEMO_ADMIN_PASSWORD;
      assert.ok(adminPassword, 'Configure backend/.env.admin-demo');
      const username = 'ui-' + randomUUID().slice(0, 12);
      try {
        await page.goto(base + '/quan-ly');
        await page.getByRole('textbox', { name: 'Tên đăng nhập hoặc email' }).fill('testadmin');
        await page.getByLabel('Mật khẩu', { exact: true }).fill(adminPassword);
        await page.getByRole('button', { name: 'Đăng nhập' }).click();
        await page.getByRole('heading', { name: 'Tổng quan' }).waitFor();
        assert((await page.context().cookies()).some(cookie => cookie.name === 'rentflow_session' && cookie.httpOnly));
        await page.reload();
        await page.getByRole('button', { name: 'Cài đặt' }).click();
        const form = page.locator('form').filter({ has: page.getByRole('heading', { name: 'Tạo tài khoản', exact: true }) });
        await form.getByLabel('Họ tên').fill(username);
        await form.getByLabel('Tên đăng nhập').fill(username);
        await form.getByLabel('Email').fill(username + '@rentflow.test');
        await form.getByLabel('Vai trò').selectOption('STAFF');
        await form.getByLabel('Khu trọ').selectOption({ label: 'Khu trọ TestAdmin' });
        await form.getByRole('button', { name: 'Tạo tài khoản' }).click();
        const invitation = page.getByLabel('Mã lời mời');
        await invitation.waitFor();
        const code = await invitation.inputValue();
        await noOverflow(page);
        await page.getByRole('button', { name: 'Đăng xuất' }).click();
        await page.getByRole('link', { name: 'Kích hoạt tài khoản' }).click();
        const initial = randomUUID();
        await page.getByLabel('Mã một lần').fill(code);
        await page.getByLabel('Mật khẩu mới', { exact: true }).fill(initial);
        await page.getByLabel('Nhập lại mật khẩu mới').fill(initial);
        await page.locator('form').getByRole('button', { name: 'Lưu', exact: true }).click();
        await page.getByText('Mật khẩu đã được lưu. Bạn có thể đăng nhập.').waitFor();
        await page.getByRole('link', { name: 'Về trang đăng nhập' }).click();
        await page.getByRole('textbox', { name: 'Tên đăng nhập hoặc email' }).fill(username);
        await page.getByLabel('Mật khẩu', { exact: true }).fill(initial);
        await page.getByRole('button', { name: 'Đăng nhập' }).click();
        await page.getByRole('button', { name: 'Cài đặt' }).click();
        await page.getByRole('heading', { name: 'Hồ sơ cá nhân' }).waitFor();
        assert.equal(await page.getByRole('heading', { name: 'Tài khoản & phân quyền' }).count(), 0);
        const nextPassword = randomUUID();
        await page.getByLabel('Mật khẩu hiện tại').fill(initial);
        await page.getByLabel('Mật khẩu mới (tối thiểu 12 ký tự)', { exact: true }).fill(nextPassword);
        await page.getByLabel('Nhập lại mật khẩu mới').fill(nextPassword);
        await page.getByRole('button', { name: 'Đổi mật khẩu' }).click();
        await page.getByText('Đã đổi mật khẩu. Vui lòng đăng nhập lại.').waitFor();
        await page.getByRole('textbox', { name: 'Tên đăng nhập hoặc email' }).fill(username);
        await page.getByLabel('Mật khẩu', { exact: true }).fill(nextPassword);
        await page.getByRole('button', { name: 'Đăng nhập' }).click();
        await page.getByRole('heading', { name: 'Tổng quan' }).waitFor();
      } finally { await page.close(); }
    });

    await t.test('RF17/RF19 | trial submission retains inputs on lost connection and succeeds after retry', async () => {
      const page = await browser.newPage({ viewport: { width: 360, height: 800 } });
      try {
        await page.goto(base);
        await page.getByRole('link', { name: 'Quyền riêng tư' }).waitFor();
        const name = 'Khách thử ' + randomUUID().slice(0, 8);
        const button = page.getByRole('button', { name: 'Gửi đăng ký' });
        await page.getByLabel('Họ tên').fill(name);
        await page.getByLabel('Email hoặc số điện thoại').fill('edge-demo@rentflow.test');
        await page.getByLabel('Số phòng').fill('10');
        await page.context().setOffline(true);
        await button.click();
        await page.getByRole('alert').getByText(/Mất kết nối/).waitFor();
        assert.equal(await page.getByLabel('Họ tên').inputValue(), name);
        await page.context().setOffline(false);
        const completion = page.waitForResponse(res => res.url().endsWith('/api/trials') && res.status() === 201);
        await button.click();
        await completion;
        await page.getByRole('status').getByText('Đã lưu.').waitFor();
        await noOverflow(page);
      } finally { await page.close(); }
    });
  } finally { await browser.close(); }
});
