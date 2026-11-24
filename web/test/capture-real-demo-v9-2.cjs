const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright-core');
const base = process.env.RENTFLOW_TEST_ORIGIN ?? 'http://127.0.0.1:3000';
const shots = path.resolve('../artifacts/real-demo-v9-2/screenshots');
const password = process.env.DEMO_PASSWORD;
const shot = (page, name) => page.screenshot({ path: path.join(shots, name), fullPage: true });
async function api(page, route, method = 'GET') {
  const result = await page.evaluate(async ({ route, method }) => {
    const r = await fetch('/api/' + route, { method, headers: { 'X-RentFlow-Web': '1', 'Content-Type': 'application/json' }, ...(method === 'POST' ? { body: '{}' } : {}) });
    return { status: r.status, data: await r.json() };
  }, { route, method });
  assert(result.status >= 200 && result.status < 300, `${route} returned ${result.status}`);
  return result.data;
}
async function main() {
  fs.mkdirSync(shots, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1366, height: 960 } });
  try {
    await page.goto(base + '/quan-ly');
    await page.locator('input[name="identifier"]').fill('owner.a@rentflow.test');
    await page.locator('input[name="password"]').fill(password);
    await page.locator('form button').click();
    await page.getByRole('heading', { name: 'Tổng quan' }).waitFor();
    const overview = await api(page, 'overview');
    const property = overview.properties.find(x => x.name === 'RentFlow Demo House');
    assert(property, 'demo property missing');
    const room = property.rooms.find(x => x.roomCode === 'P101'); assert(room, 'P101 missing');
    const lease = overview.leases.find(x => x.roomId === room.id); assert(lease, 'P101 lease missing');
    const tenant = overview.tenants.find(x => x.fullName === 'Nguyễn Thị Demo'); assert(tenant, 'demo tenant missing');
    const ledger = await api(page, `leases/${lease.id}/ledger`);
    assert.equal(Number(ledger.invoices[0].totalAmount), 3600000);
    assert.equal(Number(ledger.settlement.refund), 1100000);
    const roomImage = room.images.find(x => x.isPrimary); assert(roomImage, 'P101 primary image missing');
    const fixture = await page.evaluate(async ({ roomId, imageId }) => {
      const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 360;
      const ctx = canvas.getContext('2d'); ctx.fillStyle = '#dcefe8'; ctx.fillRect(0, 0, 640, 360);
      ctx.fillStyle = '#075e48'; ctx.textAlign = 'center';
      ctx.font = 'bold 48px sans-serif'; ctx.fillText('TEST FIXTURE', 320, 150);
      ctx.font = '28px sans-serif'; ctx.fillText('NOT A REAL ROOM PHOTO', 320, 210);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      const form = new FormData(); form.append('image', blob, 'test-fixture.png');
      const response = await fetch(`/api/rooms/${roomId}/images/${imageId}`, { method: 'PUT', headers: { 'X-RentFlow-Web': '1' }, body: form });
      return response.status;
    }, { roomId: room.id, imageId: roomImage.id });
    assert.equal(fixture, 200, 'upload watermarked test fixture through the real API');

    await shot(page, '02-dashboard.png');
    const tabs = page.getByRole('navigation', { name: 'Quản lý' }).getByRole('button');
    await tabs.nth(1).click(); await page.getByRole('heading', { name: 'RentFlow Demo House' }).waitFor();
    await page.locator('img.room-photo').first().waitFor(); await shot(page, '03-property-list.png');
    await page.getByLabel('Tìm phòng').fill('P101'); await shot(page, '04-room-list.png');
    const history = page.locator('details').filter({ has: page.locator('summary').filter({ hasText: 'P101' }) }).first();
    await history.locator('summary').click(); await history.getByText(/220/).waitFor();
    await shot(page, '05-room-detail.png'); await shot(page, '09-meter-readings.png');
    await tabs.nth(2).click(); await page.getByText('Nguyễn Thị Demo').waitFor(); await shot(page, '06-tenant-list.png');
    await tabs.nth(3).click(); await page.locator('button.choose').filter({ hasText: 'P101' }).first().click();
    await page.locator('.print-ledger p').filter({ hasText: 'Nguyễn Thị Demo' }).waitFor(); await shot(page, '07-contract.png'); await shot(page, '08-handover.png');
    await tabs.nth(5).click(); await page.locator('button.choose').filter({ hasText: 'P101' }).first().click();
    await page.getByText('Tổng 3.600.000').waitFor(); await shot(page, '10-invoice.png');
    await page.locator('.invoice details summary').first().click(); await page.locator('.invoice').getByText(/2\.000\.000/).last().waitFor({ state: 'attached' });
    await shot(page, '11-payment.png');
    await tabs.nth(0).click(); await page.getByText('Công nợ').waitFor(); await shot(page, '12-debt.png');
    await tabs.nth(6).click(); await page.locator('button.choose').filter({ hasText: 'P101' }).first().click();
    await page.getByText('Xem quyết toán').click(); await page.getByText('Hoàn cọc 1.100.000').waitFor();
    await shot(page, '13-deposit-settlement.png');

    await page.evaluate(() => fetch('/api/logout', { method: 'POST', headers: { 'X-RentFlow-Web': '1', 'Content-Type': 'application/json' }, body: '{}' }));
    await page.setViewportSize({ width: 390, height: 844 }); await page.goto(base + '/quan-ly');
    await page.locator('input[name="identifier"]').fill('renter.a@rentflow.test');
    await page.locator('input[name="password"]').fill(password); await page.locator('form button').click();
    await page.getByRole('heading', { name: 'Tổng quan' }).waitFor();
    await page.getByRole('button').filter({ hasText: 'P101' }).first().click(); await page.locator('.print-ledger p').filter({ hasText: 'Nguyễn Thị Demo' }).waitFor();
    for (const width of [360,390,768,1366]) {
      await page.setViewportSize({ width, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `overflow at ${width}px`);
    }
    await page.setViewportSize({ width: 390, height: 844 }); await shot(page, '14-tenant-mobile.png');
    console.log('Captured 14 real UI states for RentFlow Demo House.');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
