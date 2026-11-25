const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const { randomUUID } = require('node:crypto');
const { deflateSync } = require('node:zlib');
const { join } = require('node:path');

function pngPixel(r = 24, g = 110, b = 85) {
  const crc32 = buffer => {
    let crc = 0xffffffff;
    for (const byte of buffer) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    return (crc ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const name = Buffer.from(type);
    const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
    const checksum = Buffer.alloc(4); checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
    return Buffer.concat([length, name, data, checksum]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(1, 0); header.writeUInt32BE(1, 4);
  header[8] = 8; header[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header), chunk('IDAT', deflateSync(Buffer.from([0, r, g, b]))), chunk('IEND', Buffer.alloc(0)),
  ]);
}

const base = process.env.RENTFLOW_TEST_ORIGIN ?? 'http://127.0.0.1:3000';
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

async function action(page, title, values, path) {
  const form = page.locator('form').filter({ has: page.getByRole('heading', { name: title, exact: true }) });
  for (const [name,value] of Object.entries(values)) {
    const input = form.locator('[name="' + name + '"]');
    if (await input.evaluate(element => element.tagName === 'SELECT')) await input.selectOption(value);
    else await input.fill(value);
  }
  const response = page.waitForResponse(res => new URL(res.url()).pathname === '/api/' + path && res.request().method() === 'POST');
  await form.getByRole('button').click();
  const result = await response;
  assert.equal(result.status(), 201, path);
  return result.json();
}

test('Browser | admin, renter at 360/768/1366px, trial form and offline recovery', async t => {
  assert.ok(password, 'Set DEMO_PASSWORD in backend/.env and seed demo fixtures');
  const executablePath = process.env.RENTFLOW_BROWSER_EXECUTABLE;
  const browser = await chromium.launch({ ...(executablePath ? { executablePath } : { channel: 'msedge' }), headless: true });
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
        const tasks = page.getByRole('region', { name: 'Việc cần xử lý' });
        await tasks.getByRole('heading', { name: '1 khoản chờ xác nhận' }).waitFor();
        await tasks.getByRole('button', { name: 'Đối chiếu' }).click();
        await page.getByRole('heading', { name: 'Xác nhận khoản thu' }).waitFor();
        await page.getByRole('button', { name: 'Tổng quan' }).click();
        const evidence = process.env.RENTFLOW_BILLING_CAPTURE_DIR;
        if (evidence) {
          await page.setViewportSize({ width: 360, height: 900 });
          await noOverflow(page);
          await page.screenshot({ path: join(evidence, 'rentflow-dien-thoai.png') });
          await page.setViewportSize({ width: 1366, height: 900 });
        }
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
        await page.getByRole('button', { name: 'Đăng xuất' }).click();
        await page.getByRole('textbox', { name: 'Tên đăng nhập hoặc email' }).fill('testadmin');
        await page.getByLabel('Mật khẩu', { exact: true }).fill(adminPassword);
        await page.getByRole('button', { name: 'Đăng nhập' }).click();
        await page.getByRole('button', { name: 'Cài đặt' }).click();
        const account = page.locator('details').filter({ has: page.locator('summary').filter({ hasText: username }) });
        await account.locator('summary').click();
        const overview = await page.evaluate(() => fetch('/api/overview', {headers:{'X-RentFlow-Web':'1'}}).then(res => res.json()));
        const accounts = await page.evaluate(() => fetch('/api/accounts', {headers:{'X-RentFlow-Web':'1'}}).then(res => res.json()));
        const accountId = accounts.find(item => item.username === username).id;
        const propertyId = overview.properties.find(item => item.name === 'Khu trọ TestAdmin').id;
        const access = { propertyId, email: username + '@rentflow.test' };
        await action(page, 'Phân quyền theo khu trọ', { ...access, operation: 'REVOKE' }, 'properties/' + propertyId + '/access');
        await account.getByText('Khu được cấp quyền: Chưa có').waitFor();
        await action(page, 'Phân quyền theo khu trọ', { ...access, operation: 'GRANT' }, 'properties/' + propertyId + '/access');
        await account.getByText('Khu được cấp quyền: Khu trọ TestAdmin').waitFor();
        page.on('dialog', dialog => dialog.accept());
        await action(page, 'Quản lý truy cập', { action: 'LOCK' }, 'accounts/' + accountId + '/control');
        await account.locator('summary').filter({hasText:'Đã khóa'}).waitFor();
        await action(page, 'Quản lý truy cập', { action: 'UNLOCK' }, 'accounts/' + accountId + '/control');
        await account.locator('summary').filter({hasText:'Đang hoạt động'}).waitFor();
      } finally { await page.close(); }
    });

    await t.test('V9 business | room, meters, cancel, reissue, A4 PDF, payment and checkout on MySQL', async () => {
      const page = await browser.newPage({ viewport: { width: 768, height: 900 } });
      await page.clock.setFixedTime(new Date('2026-11-25T12:00:00+07:00'));
      const tag = 'EDGE-' + randomUUID().slice(0,8);
      const khu = '22222222-2222-4222-8222-222222222201';
      const navigate = title => page.getByRole('button', { name: title, exact: true }).click();
      const showLease = () => page.getByRole('button', { name: new RegExp('^' + tag + ' ·') }).click();
      try {
        await login(page, 'owner.a');
        await navigate('Khu trọ & phòng');
        const room = await action(page, 'Tạo phòng', { propertyId: khu, roomCode: tag, baseRentPrice: '3000000', maxOccupants: '1', status: 'AVAILABLE' }, 'properties/' + khu + '/rooms');
        const png = pngPixel();
        const addPhoto = async () => {
          const response = page.waitForResponse(res => res.url().endsWith('/api/rooms/' + room.id + '/images') && res.request().method() === 'POST');
          await page.getByLabel('Thêm ảnh phòng ' + tag).setInputFiles({ name: 'room.png', mimeType: 'image/png', buffer: png });
          const result = await response;
          const body = await result.json();
          assert.equal(result.status(), 201, JSON.stringify(body));
          return body;
        };
        const firstPhoto = await addPhoto();
        if (process.env.RENTFLOW_ROOM_CAPTURE) {
          await page.locator('[data-room-image-id="' + firstPhoto.id + '"]').screenshot({ path: process.env.RENTFLOW_ROOM_CAPTURE });
        }
        await page.getByRole('img', { name: 'Ảnh phòng ' + tag }).waitFor();
        const secondPhoto = await addPhoto();
        const secondCard = page.locator('[data-room-image-id="' + secondPhoto.id + '"]');
        await secondCard.getByRole('button', { name: 'Đặt ảnh đại diện' }).click();
        await page.getByRole('status').getByText('Đã chọn ảnh đại diện.').waitFor();
        const firstCard = page.locator('[data-room-image-id="' + firstPhoto.id + '"]');
        const replaceResponse = page.waitForResponse(res => res.url().endsWith('/api/rooms/' + room.id + '/images/' + firstPhoto.id) && res.request().method() === 'PUT');
        await firstCard.getByLabel('Thay ảnh phòng ' + tag).setInputFiles({ name: 'replacement.png', mimeType: 'image/png', buffer: png });
        assert.equal((await replaceResponse).status(), 200);
        page.once('dialog', dialog => dialog.accept());
        const deleteSecond = page.waitForResponse(res => res.url().endsWith('/api/rooms/' + room.id + '/images/' + secondPhoto.id) && res.request().method() === 'DELETE');
        await secondCard.getByRole('button', { name: 'Xóa ảnh' }).click();
        assert.equal((await deleteSecond).status(), 200);
        // Keep the replaced primary image as a visual sample in the persistent demo.
        await navigate('Người thuê');
        const tenant = await action(page, 'Thêm người thuê', { propertyId: khu, fullName: tag }, 'properties/' + khu + '/tenants');
        await navigate('Hợp đồng');
        const lease = await action(page, 'Lập hợp đồng', { roomId: room.id, representative: tenant.id, startDate: '2026-10-01', endDate: '2026-12-15', rentAmount: '3000000', depositAgreed: '2000000' }, 'leases');
        const leasePath = 'leases/' + lease.id;
        await action(page, 'Kích hoạt hợp đồng', { leaseId: lease.id }, leasePath + '/activate');
        await action(page, 'Lập biên bản bàn giao', { leaseId: lease.id, kind: 'IN', date: '2026-10-01', condition: 'Bàn giao Edge', inventory: 'Quạt', electric: '100', water: '20' }, leasePath + '/handovers');
        await showLease();
        await action(page, 'Xác nhận biên bản', {}, leasePath + '/handovers/IN/confirm');
        await navigate('Điện nước');
        await action(page, 'Ghi chỉ số', { roomId: room.id, billingPeriod: '2026-11', electricOld: '100', electricNew: '220', waterOld: '20', waterNew: '25' }, 'rooms/' + room.id + '/readings');
        await navigate('Hóa đơn & thanh toán');
        const input = { leaseId: lease.id, billingPeriod: '2026-11', dueDate: '2026-11-20' };
        const original = await action(page, 'Phát hành hóa đơn', input, leasePath + '/invoices');
        const table = page.getByRole('region', { name: 'Bảng kê hóa đơn' });
        await table.getByRole('row').filter({ hasText: tag }).getByRole('button', { name: 'Xem sổ' }).click();
        await page.getByText(/Tổng 3\.620\.000/).waitFor();
        const originalArticle = page.locator('#invoice-' + original.id);
        await action(page, 'Hủy hóa đơn', { reason: 'Chỉnh chỉ số điện sau đối chiếu' }, 'invoices/' + original.id + '/cancel');
        await originalArticle.getByText('Đã hủy', { exact: true }).waitFor();
        await page.getByText('Đã hủy hóa đơn kỳ 2026-11.').waitFor();
        await navigate('Điện nước');
        await action(page, 'Điều chỉnh chỉ số', {
          roomId: room.id, billingPeriod: '2026-11', electricOld: '100', electricNew: '225',
          waterOld: '20', waterNew: '25', reason: 'Đọc lại công tơ',
        }, 'rooms/' + room.id + '/readings/correct');
        await page.getByText('Đã lưu.', { exact: true }).waitFor();
        await navigate('Hóa đơn & thanh toán');
        const invoice = await action(page, 'Phát hành hóa đơn', input, leasePath + '/invoices');
        assert.notEqual(invoice.id, original.id);
        const reissuedRow = table.getByRole('row').filter({ hasText: tag }).filter({ hasText: 'Chưa thu' });
        await reissuedRow.getByRole('button', { name: 'Xem sổ' }).click();
        const reissuedArticle = page.locator('#invoice-' + invoice.id);
        await reissuedArticle.getByText(/Tổng 3\.637\.500/).waitFor();
        await page.waitForFunction(id => {
          const article = document.getElementById('invoice-' + id);
          return article && Math.abs(article.getBoundingClientRect().top) < 25;
        }, invoice.id);
        const evidence = process.env.RENTFLOW_BILLING_CAPTURE_DIR;
        if (evidence) await table.screenshot({ path: join(evidence, 'rentflow-bang-ke.png') });
        await navigate('Tổng quan');
        const tasks = page.getByRole('region', { name: 'Việc cần xử lý' });
        const overdue = tasks.getByRole('heading', { name: '1 hóa đơn quá hạn' });
        await overdue.waitFor();
        await tasks.getByRole('heading', { name: '1 hợp đồng sắp hết hạn' }).waitFor();
        if (evidence) {
          await page.setViewportSize({ width: 1366, height: 1000 });
          await page.evaluate(() => scrollTo(0, 0));
          await page.screenshot({ path: join(evidence, 'rentflow-dieu-hanh.png') });
          await page.setViewportSize({ width: 768, height: 900 });
        }
        await tasks.getByRole('button', { name: 'Xem hợp đồng' }).click();
        await page.getByRole('heading', { name: 'Phòng ' + tag }).waitFor();
        await tasks.getByRole('button', { name: 'Xem sổ' }).click();
        await reissuedArticle.getByText(/Tổng 3\.637\.500/).waitFor();
        await page.evaluate(() => { window.print = () => { window.__rentflowPrintInvoked = true; }; });
        await reissuedArticle.getByRole('button', { name: 'In / Lưu PDF' }).click();
        assert(await page.evaluate(() => window.__rentflowPrintInvoked));
        await page.emulateMedia({ media: 'print' });
        const print = page.locator('.print-invoice');
        assert.match(await print.innerText(), /225 − 100/);
        assert.doesNotMatch(await print.innerText(), /220 − 100/);
        assert.equal(await page.getByRole('navigation').isVisible(), false);
        assert.equal(await page.getByRole('main').isVisible(), false);
        const pdf = await page.pdf({ format: 'A4', preferCSSPageSize: true, path: evidence && join(evidence, 'rentflow-hoa-don-a4.pdf') });
        assert.equal([...pdf.toString('latin1').matchAll(/\/Type\s*\/Page\b/g)].length, 1);
        await page.emulateMedia({ media: 'screen' });
        const payment = await action(page, 'Báo thanh toán', { amount: '2000000', method: 'TRANSFER' }, 'invoices/' + invoice.id + '/payments');
        await page.getByText(/Chuyển khoản · 2\.000\.000.*Chờ xác nhận/).waitFor({ state: 'attached' });
        await reissuedArticle.getByText('Xem cách tính').click();
        await action(page, 'Xác nhận khoản thu', {}, 'payments/' + payment.id + '/confirm');
        await reissuedArticle.getByText(/Còn nợ 1\.637\.500/).waitFor();
        await navigate('Tiền cọc');
        await action(page, 'Ghi cọc đã nhận', { leaseId: lease.id, amount: '2000000', reason: 'Bằng chứng nhận cọc Edge' }, leasePath + '/deposit');
        await navigate('Hợp đồng');
        await action(page, 'Lập biên bản bàn giao', { leaseId: lease.id, kind: 'OUT', date: '2026-12-01', condition: 'Trả phòng Edge', inventory: 'Quạt', electric: '220', water: '25' }, leasePath + '/handovers');
        await showLease();
        await action(page, 'Xác nhận biên bản', {}, leasePath + '/handovers/OUT/confirm');
        await navigate('Tiền cọc');
        await showLease();
        await action(page, 'Chốt quyết toán phòng ' + tag, { deduction: '300000', debtOffset: '500000', invoiceId: invoice.id, reason: 'Khấu trừ Edge' }, leasePath + '/settlement');
        await page.getByText(/Hoàn cọc 1\.200\.000/).waitFor({ state: 'attached' });
        await page.getByText('Xem quyết toán').click();
        await page.getByText(/Hoàn cọc 1\.200\.000/).waitFor();
        await navigate('Khu trọ & phòng');
        await page.getByLabel('Tìm phòng').fill(tag);
        await page.getByLabel('Trạng thái phòng', { exact: true }).selectOption('AVAILABLE');
        await page.getByText('Lịch sử phòng ' + tag).click();
        await page.getByText(/2026-11 · Điện 100 → 225/).waitFor();
        await page.getByRole('button', { name: /^Đã trả phòng ·/ }).click();
        await page.getByRole('heading', { name: 'Phòng ' + tag }).waitFor();
        await noOverflow(page);
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
