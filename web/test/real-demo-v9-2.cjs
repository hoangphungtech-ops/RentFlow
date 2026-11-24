const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright-core');
const { randomUUID } = require('node:crypto');

const base = process.env.RENTFLOW_TEST_ORIGIN ?? 'http://127.0.0.1:3000';
const shots = path.resolve(process.env.RENTFLOW_SCREENSHOT_DIR ?? '../artifacts/real-demo-v9-2/screenshots');
const password = process.env.DEMO_PASSWORD;
const api = async (page, route, body, method = 'POST') => {
  const result = await page.evaluate(async ({ route, body, method }) => {
    const response = await fetch('/api/' + route, {
      method, headers: { 'Content-Type': 'application/json', 'X-RentFlow-Web': '1' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const data = await response.json().catch(() => null);
    return { status: response.status, data };
  }, { route, body, method });
  assert(result.status >= 200 && result.status < 300, `${method} ${route}: ${JSON.stringify(result.data)}`);
  return result.data;
};
const screenshot = async (page, name) => page.screenshot({ path: path.join(shots, name), fullPage: true });

function testPng() {
  const crc32 = buffer => {
    let crc = 0xffffffff;
    for (const byte of buffer) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0); }
    return (crc ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const name = Buffer.from(type), len = Buffer.alloc(4), crc = Buffer.alloc(4);
    len.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
    return Buffer.concat([len, name, data, crc]);
  };
  const header = Buffer.alloc(13); header.writeUInt32BE(1, 0); header.writeUInt32BE(1, 4); header[8] = 8; header[9] = 2;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', header), chunk('IDAT', require('node:zlib').deflateSync(Buffer.from([0,24,110,85]))), chunk('IEND', Buffer.alloc(0))]);
}

async function main() {
  assert(password?.length >= 12, 'DEMO_PASSWORD is missing or too short');
  fs.mkdirSync(shots, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1366, height: 960 }, deviceScaleFactor: 1 });
  try {
    await page.goto(base + '/quan-ly');
    await page.locator('input[name="identifier"]').fill('owner.a@rentflow.test');
    await page.locator('input[name="password"]').fill(password);
    await screenshot(page, '01-login.png');
    await page.locator('form button').click();
    await page.getByRole('heading', { name: 'Tổng quan' }).waitFor();

    const property = await api(page, 'properties', { name: 'RentFlow Demo House', address: '101 Đường Demo, TP. Hồ Chí Minh' });
    const rooms = {};
    for (const code of ['P101','P102','P103']) {
      rooms[code] = await api(page, `properties/${property.id}/rooms`, { roomCode: code, baseRentPrice: 3000000, maxOccupants: 1, status: 'AVAILABLE' });
    }
    const rates = [
      ['ELECTRICITY','Điện sinh hoạt','kWh',3500], ['WATER','Nước sinh hoạt','m³',20000], ['SERVICE','Dịch vụ chung','tháng',100000],
    ];
    for (const [serviceType, serviceName, unit, unitPrice] of rates) await api(page, `properties/${property.id}/rates`, { serviceType, serviceName, unit, unitPrice, effectiveFrom: '2026-10-01' });
    const tenant = await api(page, `properties/${property.id}/tenants`, { fullName: 'Nguyễn Thị Demo', contact: '0900000101', email: 'renter.a@rentflow.test' });
    const lease = await api(page, 'leases', { roomId: rooms.P101.id, representative: tenant.id, occupants: [], startDate: '2026-10-01', endDate: '2027-10-01', rentAmount: 3000000, depositAgreed: 3000000 });
    await api(page, `leases/${lease.id}/activate`, {});
    const handoverIn = await api(page, `leases/${lease.id}/handovers`, { kind: 'IN', date: '2026-10-01', condition: 'Phòng sạch, thiết bị hoạt động', inventory: 'Quạt, đèn, chìa khóa', electric: 100, water: 20 });
    await api(page, `leases/${lease.id}/handovers/IN/confirm`, {});
    await api(page, `leases/${lease.id}/deposit`, { amount: 3000000, reason: 'Đã nhận tiền cọc khi ký hợp đồng' });
    const reading = await api(page, `rooms/${rooms.P101.id}/readings`, { billingPeriod: '2026-11', electricOld: 100, electricNew: 220, waterOld: 20, waterNew: 24 });
    const image = await page.evaluate(async ({ roomId, base64 }) => {
      const form = new FormData(); form.append('image', new Blob([Uint8Array.from(atob(base64), c => c.charCodeAt(0))], { type: 'image/png' }), 'test-room.png');
      const response = await fetch(`/api/rooms/${roomId}/images`, { method: 'POST', headers: { 'X-RentFlow-Web': '1' }, body: form });
      return { status: response.status, data: await response.json() };
    }, { roomId: rooms.P101.id, base64: testPng().toString('base64') });
    assert.equal(image.status, 201, JSON.stringify(image.data));
    const imageId = image.data.id;
    await api(page, `rooms/${rooms.P101.id}/images/${imageId}/primary`, {});
    const invoice = await api(page, `leases/${lease.id}/invoices`, { billingPeriod: '2026-11', dueDate: '2026-12-05' });
    assert.equal(Number(invoice.totalAmount), 3600000, 'invoice should be 3,600,000 VND');
    const payment = await api(page, `invoices/${invoice.id}/payments`, { amount: 2000000, method: 'TRANSFER', requestKey: randomUUID() });
    await api(page, `payments/${payment.id}/confirm`, {});

    await api(page, `leases/${lease.id}/handovers`, { kind: 'OUT', date: '2026-11-24', condition: 'Đã kiểm tra khi trả phòng', inventory: 'Đủ tài sản, trừ hao mòn 300.000đ', electric: 220, water: 24 });
    await api(page, `leases/${lease.id}/handovers/OUT/confirm`, {});
    const settlement = await api(page, `leases/${lease.id}/settlement`, { deduction: 300000, debtOffset: 1600000, invoiceId: invoice.id, reason: 'Khấu trừ hao mòn và bù công nợ hóa đơn tháng 11' });
    assert.equal(Number(settlement.refund), 1100000);

    await page.reload(); await page.getByRole('heading', { name: 'Tổng quan' }).waitFor();
    await screenshot(page, '02-dashboard.png');
    const tabs = page.getByRole('navigation', { name: 'Quản lý' }).getByRole('button');
    await tabs.nth(1).click(); await page.getByText('RentFlow Demo House').waitFor();
    await screenshot(page, '03-property-list.png');
    await page.getByLabel('Tìm phòng').fill('P101'); await page.getByText('P101', { exact: true }).waitFor();
    await screenshot(page, '04-room-list.png');
    const history = page.locator('details').filter({ has: page.locator('summary').filter({ hasText: 'P101' }) }).first();
    await history.locator('summary').click(); await page.getByText('2026-11', { exact: false }).first().waitFor();
    await screenshot(page, '05-room-detail.png');
    await tabs.nth(2).click(); await page.getByText('Nguyễn Thị Demo').waitFor(); await screenshot(page, '06-tenant-list.png');
    await tabs.nth(3).click(); await page.locator('button.choose').filter({ hasText: 'P101' }).first().click();
    await page.getByText('Nguyễn Thị Demo').waitFor(); await screenshot(page, '07-contract.png');
    await screenshot(page, '08-handover.png');
    await tabs.nth(4).click(); await page.getByText('Điện sinh hoạt').waitFor();
    await screenshot(page, '09-meter-readings.png');
    await tabs.nth(5).click(); await page.locator('button.choose').filter({ hasText: 'P101' }).first().click();
    await page.getByText('Tổng 3.600.000').waitFor(); await screenshot(page, '10-invoice.png');
    await page.getByText('Xem cách tính').click(); await page.getByText('Chuyển khoản · 2.000.000 · Đã xác nhận').waitFor({ state: 'attached' });
    await screenshot(page, '11-payment.png');
    await tabs.nth(0).click(); await page.getByText('Công nợ').waitFor(); await screenshot(page, '12-debt.png');
    await tabs.nth(6).click(); await page.locator('button.choose').filter({ hasText: 'P101' }).first().click();
    await page.getByText('Xem quyết toán').click(); await page.getByText('Hoàn cọc 1.100.000').waitFor();
    await screenshot(page, '13-deposit-settlement.png');

    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => fetch('/api/logout', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-RentFlow-Web': '1' }, body: '{}' }));
    await page.goto(base + '/quan-ly');
    await page.locator('input[name="identifier"]').fill('renter.a@rentflow.test');
    await page.locator('input[name="password"]').fill(password);
    await page.locator('form button').click(); await page.getByRole('heading', { name: 'Tổng quan' }).waitFor();
    await page.getByRole('button').filter({ hasText: 'P101' }).first().click();
    await page.getByText('Nguyễn Thị Demo').waitFor();
    await assertResponsive(page, [360,390,768,1366]);
    await page.setViewportSize({ width: 390, height: 844 }); await screenshot(page, '14-tenant-mobile.png');

    const imageFetch = await page.evaluate(async ({ roomId, imageId }) => {
      const response = await fetch(`/api/rooms/${roomId}/images/${imageId}/file`, { headers: { 'X-RentFlow-Web': '1' } });
      return { status: response.status, type: response.headers.get('content-type'), size: (await response.arrayBuffer()).byteLength };
    }, { roomId: rooms.P101.id, imageId });
    assert.equal(imageFetch.status, 200); assert.equal(imageFetch.type, 'image/webp'); assert(imageFetch.size > 0);
    console.log(JSON.stringify({ propertyId: property.id, roomIds: Object.fromEntries(Object.entries(rooms).map(([k,v]) => [k,v.id])), tenantId: tenant.id, leaseId: lease.id, handoverId: handoverIn.id, readingId: reading.id, imageId, invoiceId: invoice.id, paymentId: payment.id, settlementId: settlement.id, invoiceAmount: Number(invoice.totalAmount), paid: 2000000, debtBeforeSettlement: 1600000, deduction: 300000, depositOffset: 1600000, refund: Number(settlement.refund), screenshots: 14 }));
  } finally { await browser.close(); }
}

async function assertResponsive(page, widths) {
  for (const width of widths) {
    await page.setViewportSize({ width, height: 844 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    assert.equal(overflow, false, `horizontal overflow at ${width}px`);
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
