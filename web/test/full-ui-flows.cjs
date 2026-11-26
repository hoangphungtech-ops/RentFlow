const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { readFile } = require('node:fs/promises');
const { join } = require('node:path');

module.exports = async function fullUiFlows({ origin, contexts, images, owner, renter, renter2, ticket, ticketTitle }) {
  async function send(user, path, options = {}) {
    const response = await contexts.get(user).request.fetch(origin + '/api/' + path, options);
    assert.equal(response.status(), options.expected ?? (options.method === 'POST' ? 201 : 200), path + ' ' + await response.text());
    return response;
  }
  async function json(user, path, data) {
    const res = await send(user, path, data === undefined ? {} : { method: 'POST', data });
    return res.json();
  }
  async function screen(user, portal, section, action) {
    const page = await contexts.get(user).newPage();
    await page.addInitScript(() => { window.print = () => {}; });
    await page.goto(origin + '/' + portal + '/dashboard');
    await page.getByRole('navigation', { name: 'Quản lý' }).getByRole('button', { name: section, exact: true }).click();
    try { await action(page); } finally { await page.close(); }
  }
  const capture = async (page, name) => { if (images) await page.screenshot({ path: join(images, name + '.png'), fullPage: true }); };
  const property = owner.properties[0];
  const tag = 'DEMO-' + randomUUID().slice(0, 6);
  const room = await json('testchutro', 'properties/' + property.id + '/rooms', {
    roomCode: tag, baseRentPrice: 2800000, maxOccupants: 2,
  });
  const image = { name: 'phong-mau.jpg', mimeType: 'image/jpeg', buffer: await readFile(join(__dirname, '../../backend/prisma/demo-assets/room-1.jpg')) };
  const photo = await (await send('testchutro', 'rooms/' + room.id + '/images', { method: 'POST', multipart: { image } })).json();
  await json('testchutro', 'v10/manager/rooms/' + room.id + '/listing', { floorArea: 24, amenities: 'Wi-Fi, bếp nhỏ' });
  const photoPath = 'v10/listing-photos/' + room.id + '/' + photo.id;
  await send('testnguoidung', photoPath, { expected: 404 });
  await screen('testadmin', 'admin', 'Duyệt tin phòng', async page => {
    const listing = page.locator('article').filter({ has: page.getByRole('heading', { name: tag + ' · ' + property.name }) });
    await listing.getByRole('button', { name: 'Xem ảnh phòng' }).click();
    await listing.getByRole('img').waitFor();
    await capture(page, '09-duyet-tin-phong');
  });
  await json('testadmin', 'v10/admin/rooms/' + room.id, { approve: true });
  await send('testnguoidung', photoPath);
  const listings = await json('testnguoidung', 'v10/listings?area=Bình+Thạnh&max=2800000');
  assert(listings.some(row => row.id === room.id));
  assert(!(await json('testnguoidung', 'v10/listings?max=2799999')).some(row => row.id === room.id));
  await screen('testnguoidung', 'user', 'Tìm phòng', async page => {
    const result = page.locator('article').filter({ has: page.getByRole('heading', { name: tag + ' · ' + property.name }) });
    await result.getByRole('button', { name: 'Xem ảnh phòng' }).click();
    await result.getByRole('img').waitFor();
    await capture(page, '10-tim-phong');
  });
  const booking = await json('testnguoidung', 'v10/listings/' + room.id + '/bookings', { kind: 'VIEW', note: 'Xem phòng demo' });
  await send('testquanly2', 'v10/manager/bookings/' + booking.id, { method: 'POST', data: { approve: true }, expected: 404 });
  await json('testquanly', 'v10/manager/bookings/' + booking.id, { approve: true });
  assert((await json('testnguoidung', 'v10/user')).bookings.some(row => row.id === booking.id && row.status === 'APPROVED'));
  console.log('PASS room creation, photo visibility, moderation, area/price filters and scoped viewing request');

  const lease = renter.leases[0];
  const billingPeriod = '2026-12';
  await json('testchutro', 'properties/' + property.id + '/rates', { serviceType: 'ELECTRICITY', serviceName: 'Điện', unit: 'kWh', unitPrice: 3500, effectiveFrom: '2026-01-01' });
  await json('testchutro', 'properties/' + property.id + '/rates', { serviceType: 'WATER', serviceName: 'Nước', unit: 'm³', unitPrice: 20000, effectiveFrom: '2026-01-01' });
  await send('testnhanvien', 'v10/manager/rooms/' + lease.roomId + '/meter-evidence', {
    method: 'POST', multipart: { billingPeriod, electricOld: '100', electricNew: '120', waterOld: '10', waterNew: '13', electric: image, water: image },
  });
  const issue = () => json('testketoan', 'leases/' + lease.id + '/invoices', { billingPeriod, dueDate: '2026-12-25' });
  const original = await issue();
  await json('testketoan', 'invoices/' + original.id + '/cancel', { reason: 'Cập nhật chỉ số điện đã đối chiếu' });
  await json('testchutro', 'rooms/' + lease.roomId + '/readings/correct', {
    billingPeriod, electricOld: 100, electricNew: 121, waterOld: 10, waterNew: 13, reason: 'Đối chiếu lại số công tơ',
  });
  const invoice = await issue();
  assert.notEqual(invoice.id, original.id);
  assert.equal(Number(invoice.totalAmount) - Number(original.totalAmount), 3500);
  const evidencePath = 'v10/invoices/' + invoice.id + '/meter-evidence';
  const evidence = await json('testnguoidung', evidencePath);
  assert.equal(evidence.length, 2);
  await send('testnguoidung', evidencePath + '/' + evidence[0].id);
  await send('testnguoidung2', evidencePath + '/' + evidence[0].id, { expected: 404 });
  assert(renter2.leases.every(row => row.id !== lease.id));

  const payment = await json('testnguoidung', 'invoices/' + invoice.id + '/payments', { amount: 100000, method: 'TRANSFER', requestKey: randomUUID() });
  let clerkLedger = await json('testketoan', 'leases/' + lease.id + '/ledger');
  assert.equal(clerkLedger.invoices.find(row => row.id === invoice.id).payments.find(row => row.id === payment.id).status, 'PENDING');
  await screen('testketoan', 'accountant', 'Hóa đơn & thanh toán', async page => {
    await page.locator('#invoice-row-' + invoice.id).getByRole('button', { name: 'Xem sổ' }).click();
    const item = page.locator('#invoice-' + invoice.id);
    await item.getByText('Xem cách tính').click();
    await item.getByText('Xác nhận khoản thu').waitFor();
    await capture(page, '12-doi-soat');
  });
  await json('testketoan', 'payments/' + payment.id + '/confirm', {});
  clerkLedger = await json('testketoan', 'leases/' + lease.id + '/ledger');
  assert.equal(clerkLedger.invoices.find(row => row.id === original.id).status, 'CANCELLED');
  assert.equal(Number(clerkLedger.invoices.find(row => row.id === invoice.id).paidAmount), 100000);
  await screen('testnguoidung', 'user', 'Hóa đơn & thanh toán', async page => {
    await page.locator('#invoice-row-' + invoice.id).getByRole('button', { name: 'Xem sổ' }).click();
    const item = page.locator('#invoice-' + invoice.id);
    await item.getByRole('button', { name: 'Xem ảnh công tơ' }).click();
    await item.getByText('Công tơ điện', { exact: false }).first().waitFor();
    await capture(page, '11-hoa-don-anh-cong-to');
    await item.getByRole('button', { name: 'In / Lưu PDF' }).click();
    const print = await page.pdf({ format: 'A4', preferCSSPageSize: true });
    try {
      const meta = execFileSync('pdfinfo', ['-'], { input: print, encoding: 'utf8' });
      assert.match(meta, /^Pages:\s+1$/m);
      assert.match(meta, /^Page size:.*A4/m);
      console.log('PASS invoice prints on one A4 page');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      console.log('NOT RUN PDF page count: pdfinfo unavailable');
    }
  });
  await screen('testnguoidung', 'user', 'Bảo trì', async page => {
    await page.getByText(ticketTitle + ' · Hoàn thành', { exact: true }).waitFor();
    await capture(page, '13-bao-tri');
  });
  const adminActor = await json('testadmin', 'v10/me');
  assert.equal(adminActor.portal, 'admin');
  const renter2Actor = await json('testnguoidung2', 'v10/me');
  const lockPath = 'v10/admin/users/' + renter2Actor.id;
  await json('testadmin', lockPath, { locked: true });
  try {
    await send('testnguoidung2', 'v10/me', { expected: 401 });
  } finally {
    await json('testadmin', lockPath, { locked: false });
  }
  const signup = await contexts.get('testnguoidung').request.post(origin + '/api/auth/register', {
    data: { email: 'signup-' + tag.toLowerCase() + '@rentflow.test', fullName: 'Tài khoản thử', password: 'Register@20261126', role: 'ADMIN' },
  });
  assert.equal(signup.status(), 400);
  console.log('PASS locked account loses its session and public registration rejects role injection');
  assert(ticket.id);
  console.log('PASS meter evidence scope, invoice cancellation and reissue, pending payment and accountant reconciliation');
};
