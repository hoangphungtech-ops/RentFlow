const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright-core');
const { PrismaClient } = require('../../backend/node_modules/@prisma/client');

const base = 'http://127.0.0.1:3000';
const screenshotRoot = path.resolve(__dirname, '../../artifacts/real-demo-v9-2/screenshots/after-v9.3');
const recoveryFile = path.join(process.env.USERPROFILE, 'Documents/RentFlow-Password-Recovery/batch-20261124-162719/passwords.json');
const db = new PrismaClient();

async function main() {
  fs.mkdirSync(screenshotRoot, { recursive: true });
  const handoff = JSON.parse(fs.readFileSync(recoveryFile, 'utf8'));
  const owner = handoff.accounts.find(row => row.username === 'owner.a@rentflow.test');
  const renter = handoff.accounts.find(row => row.username === 'renter.a@rentflow.test');
  assert(owner?.password && renter?.password, 'Recovery entries required for browser acceptance');
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1366, height: 950 } });
  try {
    await page.goto(base + '/quan-ly');
    await page.locator('input[name="identifier"]').fill(owner.username);
    await page.locator('input[name="password"]').fill(owner.password);
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await page.getByRole('heading', { name: 'Tổng quan' }).waitFor();
    assert.equal(await page.evaluate(async () => (await fetch('/api/health')).status), 200);
    const overview = await page.evaluate(async () => {
      const response = await fetch('/api/overview', { headers: { 'X-RentFlow-Web': '1' } });
      return { status: response.status, body: await response.json() };
    });
    assert.equal(overview.status, 200);
    assert.equal(overview.body.actor.role, 'OWNER');
    const propertyIds = overview.body.properties.map(row => row.id);
    const rooms = overview.body.properties.flatMap(row => row.rooms);
    assert(rooms.length > 0, 'Owner API returned no rooms');

    const foreignKeys = await db.$queryRaw`
      SELECT
        (SELECT COUNT(*) FROM Room r LEFT JOIN Property p ON p.id = r.propertyId WHERE p.id IS NULL) AS roomProperty,
        (SELECT COUNT(*) FROM Tenant t LEFT JOIN Property p ON p.id = t.propertyId WHERE p.id IS NULL) AS tenantProperty,
        (SELECT COUNT(*) FROM Lease l LEFT JOIN Room r ON r.id = l.roomId WHERE r.id IS NULL) AS leaseRoom,
        (SELECT COUNT(*) FROM LeaseTenant lt LEFT JOIN Lease l ON l.id = lt.leaseId LEFT JOIN Tenant t ON t.id = lt.tenantId WHERE l.id IS NULL OR t.id IS NULL) AS leaseTenant,
        (SELECT COUNT(*) FROM UtilityRate u LEFT JOIN Property p ON p.id = u.propertyId WHERE p.id IS NULL) AS rateProperty,
        (SELECT COUNT(*) FROM RoomImage i LEFT JOIN Room r ON r.id = i.roomId WHERE r.id IS NULL) AS imageRoom
    `;
    const badImageRooms = await db.roomImage.groupBy({ by: ['roomId'], _count: { _all: true }, having: { roomId: { _count: { gt: 12 } } } });
    const duplicatePrimaryRooms = await db.roomImage.groupBy({ by: ['roomId'], where: { isPrimary: true }, _count: { _all: true }, having: { roomId: { _count: { gt: 1 } } } });

    await page.screenshot({ path: path.join(screenshotRoot, '01-dashboard-owner.png'), fullPage: true });
    const tabs = page.getByRole('navigation', { name: 'Quản lý' }).getByRole('button');
    await tabs.nth(1).click();
    await page.getByRole('heading', { name: overview.body.properties[0].name }).first().waitFor();
    await page.screenshot({ path: path.join(screenshotRoot, '02-room-list-owner.png'), fullPage: true });
    const ownerRoomStatus = await page.evaluate(() => [...document.querySelectorAll('.room-status-control select')].length);
    await tabs.nth(3).click();
    await page.getByRole('heading', { name: 'Lập hợp đồng' }).waitFor();
    await page.screenshot({ path: path.join(screenshotRoot, '03-contract-form-owner.png'), fullPage: true });
    const ownerContractForm = await page.evaluate(() => ({
      roomSelect: document.querySelectorAll('form select[name="roomId"] option').length,
      tenantSearch: document.querySelectorAll('form input[type="search"]').length,
    }));
    await tabs.nth(4).click();
    await page.getByRole('heading', { name: 'Thêm đơn giá' }).waitFor();
    await page.screenshot({ path: path.join(screenshotRoot, '04-rate-form-owner.png'), fullPage: true });
    await page.evaluate(() => fetch('/api/logout', { method: 'POST', headers: { 'X-RentFlow-Web': '1', 'Content-Type': 'application/json' }, body: '{}' }));
    await page.goto(base + '/quan-ly');
    await page.locator('input[name="identifier"]').fill(renter.username);
    await page.locator('input[name="password"]').fill(renter.password);
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await page.getByRole('heading', { name: 'Tổng quan' }).waitFor();
    await page.getByRole('button', { name: 'Hợp đồng' }).click();
    const renterScope = await page.evaluate(async () => {
      const response = await fetch('/api/overview', { headers: { 'X-RentFlow-Web': '1' } });
      const body = await response.json();
      return { status: response.status, role: body.actor?.role, properties: body.properties?.length, leases: body.leases?.length };
    });
    const responsive = [];
    for (const width of [360, 390, 768, 1366]) {
      await page.setViewportSize({ width, height: 844 });
      responsive.push({ width, overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth) });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(screenshotRoot, '05-renter-390px.png'), fullPage: true });
    const results = {
      apiHealth: 'PASS', ownerOverview: 'PASS', ownerPropertyScope: propertyIds.length,
      rooms: rooms.length, tenants: overview.body.tenants.length, leases: overview.body.leases.length,
      roomStatuses: rooms.reduce((counts, room) => ({ ...counts, [room.status]: (counts[room.status] ?? 0) + 1 }), {}),
      roomOccupancyMismatches: rooms.filter(room => (room.status === 'AVAILABLE' && room.activeLeaseCount > 0) || (room.status === 'OCCUPIED' && room.activeLeaseCount === 0)).length,
      foreignKeyViolations: Object.fromEntries(Object.entries(foreignKeys[0]).map(([key, value]) => [key, Number(value)])), imagesOverLimit: badImageRooms.length, duplicatePrimaryRooms: duplicatePrimaryRooms.length,
      ownerRoomStatusControls: ownerRoomStatus, contractForm: ownerContractForm,
      renterScope, responsive, screenshots: screenshotRoot,
    };
    console.log(JSON.stringify(results));
  } finally {
    await browser.close();
    await db.$disconnect();
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
