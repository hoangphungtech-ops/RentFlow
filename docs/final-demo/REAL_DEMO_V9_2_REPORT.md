# RENTFLOW DEMO STATUS — V9.2

**Result: PASS for local Web/API/MySQL demo and rental workflow; PARTIAL for product-owner acceptance and native Android.**  
**Date:** 2026-11-24, Asia/Saigon  
**Workspace:** `E:\dev\rentflow-upstream`  
**Branch / baseline commit:** `codex/v9-stable-demo` / `7939838c27a07b94f061c52dbfab246a93864d5b`  
**Git:** local changes retained; no reset, commit, or push.

## Access

- Web Admin: [http://127.0.0.1:3000/quan-ly](http://127.0.0.1:3000/quan-ly)
- Web home: [http://127.0.0.1:3000](http://127.0.0.1:3000)
- Backend health: [http://127.0.0.1:3001/api/health](http://127.0.0.1:3001/api/health)
- Swagger: [http://127.0.0.1:3001/swagger](http://127.0.0.1:3001/swagger)
- Demo owner login: `owner.a@rentflow.test`
- Demo renter login: `renter.a@rentflow.test`
- Both use the generated temporary value in ignored `backend/.env` (`DEMO_PASSWORD`). It is provided separately at handoff and is not stored in Git or this report.

## Runtime and database isolation

| Component | Status | Evidence |
|---|---|---|
| MySQL 8 | PASS | Compose project `rentflow-v9-demo`; container healthy; loopback only at `127.0.0.1:33317`; dedicated volume `rentflow-v9-demo_rentflow_mysql_data` |
| Backend | PASS | Built NestJS API; health and Swagger returned HTTP 200 before and after Backend/Web restart |
| Web Admin | PASS | Built Next standalone server; Web home, admin and proxied API health returned HTTP 200 |
| Prisma schema | PASS | Six migrations applied; `prisma migrate status` reports up to date |
| Persistence | PASS | Backend and Web restarted without restarting MySQL; SELECT checks still find linked business records and stored image bytes |
| RAM | PASS | About 4.6 GiB free of 15.2 GiB visible at the final host check |

Before applying migrations, the requested Compose project had no existing named volume. The first Prisma status showed all six migrations pending. They were applied only to the newly created empty V9.2 volume. The older MySQL on port 3307 and previous test database on port 33307 were left untouched; the earlier 33307 volume is stopped and retained.

## Business workflow created via the authenticated API

All business records below were created through RentFlow API actions; no SQL inserts were used to fabricate the result.

| Step | Result |
|---|---|
| Property | `RentFlow Demo House`, 101 Đường Demo, TP. Hồ Chí Minh |
| Rooms | P101, P102, P103; each 3,000,000 VND/month |
| Room photo | P101 WebP primary image, file stored outside MySQL; fixture is visibly watermarked as a test image |
| Tenant | Nguyễn Thị Demo, linked to `renter.a@rentflow.test` |
| Contract | P101, 2026-10-01 to 2027-10-01; deposit agreed/received 3,000,000 VND |
| Handover | Move-in and move-out records, both confirmed |
| Electricity/water | 100→220 kWh; 20→24 m³ for 2026-11 |
| Invoice | Rent 3,000,000 + electricity 420,000 + water 80,000 + service 100,000 = **3,600,000 VND** |
| Payment | Confirmed bank transfer **2,000,000 VND** |
| Debt | **1,600,000 VND** before settlement; **0 VND** after offset |
| Deposit settlement | 3,000,000 received − 300,000 deduction − 1,600,000 debt offset = **1,100,000 VND refund** |

Read-only database checks verified IDs and foreign keys for property→rooms, tenant→lease, lease→handovers and invoice, meter→room, invoice→four items and two payment records, settlement→lease, and image metadata→an existing 5,542-byte `image/webp` file. MySQL amounts equal the UI/API values. Query script: `backend/scripts/verify-v9-demo.cjs`.

## Screen and acceptance evidence

The real app was rendered in Edge, with captures stored in `artifacts/real-demo-v9-2/screenshots/`:

`01-login.png`, `02-dashboard.png`, `03-property-list.png`, `04-room-list.png`, `05-room-detail.png`, `06-tenant-list.png`, `07-contract.png`, `08-handover.png`, `09-meter-readings.png`, `10-invoice.png`, `11-payment.png`, `12-debt.png`, `13-deposit-settlement.png`, `14-tenant-mobile.png`.

The renter view was opened at 390 px and inspected at 360, 390, 768 and 1366 px; no horizontal overflow was detected. This validates responsive tenant Web access, not a native Android installation.

The release-candidate suite on isolated tmpfs MySQL passed: API 14/14, auth 8/8, SMTP loopback 1/1, Browser 8/8, backend/Web builds, Prisma validation, and backend audit with zero vulnerabilities. Room-image API tests cover actual decode/format checks, optimization, property isolation, view, replace, primary selection, and deletion. SMTP provider delivery was not tested.

Photo backup/restore was exercised locally: `artifacts/real-demo-v9-2/room-images-backup.tar.gz` was extracted to a separate temporary folder and the restored SHA-256 matched the stored file. MySQL was not restarted during persistence verification.

## Feature checklist

| Requirement | Status | Notes |
|---|---|---|
| Login | PASS | Existing seeded owner and renter accounts; session flow verified |
| Room management | PASS | Property and P101/P102/P103 present in UI/API/MySQL |
| Room images | PASS | Upload, view, replace, delete and primary actions implemented and tested; image files persist and archive restore hashes match |
| Tenant | PASS | Demo tenant is linked to renter login and lease |
| Contract | PASS | Active contract lifecycle and ledger view verified |
| Handover | PASS | Both handovers confirmed |
| Electricity/water | PASS | MySQL meter values matched invoice calculations |
| Invoice | PASS | Four lines total 3,600,000 VND |
| Payment | PASS | 2,000,000 VND transfer confirmed; 1,600,000 VND deposit offset recorded |
| Debt | PASS | 1,600,000 VND before deposit settlement, 0 afterward |
| Deposit | PASS | 1,100,000 VND refund after 300,000 deduction and 1,600,000 debt offset |
| Tenant mobile | PASS (Web) / PARTIAL (native) | Responsive tenant Web view; no device/emulator or APK/AAB acceptance |
| Data persistence | PASS | Verified after restarting Backend and Web; MySQL volume retained |

## Remaining work and constraints

- Replace the explicit test image with real room photos supplied by the property owner. No actual room photos were supplied; the fixture is not presented as a photograph.
- Publish available rooms on the public Landing Page; that module does not yet read live rooms/images from MySQL.
- Native Android installation, signing, and Play release remain unverified.
- Production domain, provider SMTP, production database backup/restore, off-host backup, and product-owner acceptance remain outstanding.
- No existing/production password was changed. The only generated demo passwords belong to newly initialized local demo accounts. Secrets remain in ignored local `.env` files.

## Start and stop

Start the initialized V9.2 project without package installation, build, seed, or migration:

```powershell
cd E:\dev\rentflow-upstream
powershell -ExecutionPolicy Bypass -File .\scripts\run-demo.ps1
```

Open `http://127.0.0.1:3000/quan-ly` and use the owner or renter login above. Stop the app and MySQL safely while preserving volumes:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\stop-demo.ps1
```

Do not use `docker compose down -v`. The startup/stop logs are in `artifacts/real-demo-v9-2/logs/`.
