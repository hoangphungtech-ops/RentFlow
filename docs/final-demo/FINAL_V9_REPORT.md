# RentFlow V9 — Release and real-demo verification

**Verified:** 2026-11-24 (local time, Asia/Saigon)
**Repository:** `https://github.com/hoangphungtech-ops/RentFlow.git`
**Working branch:** `codex/v9-stable-demo`
**Baseline commit:** `7939838c27a07b94f061c52dbfab246a93864d5b`
**Workspace:** `E:\dev\rentflow-upstream`

The source branch and baseline commit were preserved. The worktree has uncommitted V9.1/V9.2 changes; nothing was committed or pushed. The earlier `E:\dev\rentflow` checkout was not used or modified.

## Release-candidate checks

| Check | Result |
|---|---|
| Prisma schema validation and generation | PASS |
| Isolated candidate migrations | PASS — six migrations, including `20261124150000_room_images`, applied to a disposable tmpfs MySQL 8 instance |
| Nest backend build | PASS |
| Next Web build | PASS |
| API integration | PASS — 14/14, including upload validation, optimization, scope, replace, primary selection and delete |
| Account/authentication | PASS — 8/8 |
| SMTP loopback workflow | PASS — 1/1; external provider delivery is not configured |
| Edge browser suite | PASS — 8/8; viewport checks cover 360, 768 and 1366 px |
| Backend `npm audit` | PASS — 0 vulnerabilities |
| Current V9.2 mobile web | PASS — renter ledger opened at 390 px; no horizontal overflow at 360, 390, 768 or 1366 px |
| Native Android device/emulator | PARTIAL — no install or APK/AAB acceptance in this run |

The browser suite originally exposed an invalid test PNG checksum. The test now generates a valid PNG, which the real image decoder accepts. The standalone Next output includes `.next/static` and `public`.

## Isolated, running demo database

The V9.2 Compose project is `rentflow-v9-demo`, MySQL 8, bound only to `127.0.0.1:33317`, volume `rentflow-v9-demo_rentflow_mysql_data`. Before migrations, `prisma migrate status` showed all six migrations pending on this new empty volume. All six were then applied successfully; current migration status is **up to date**.

The older local MySQL on port 3307 and its volume were not migrated, seeded, restarted, restored, or deleted. The earlier `rentflow-demo` database on port 33307 is stopped and its volume is retained. Only `rentflow-v9-demo` is used by the application now.

The Web and API are running with these verified URLs:

- Web Admin: `http://127.0.0.1:3000/quan-ly`
- Web home: `http://127.0.0.1:3000`
- API health: `http://127.0.0.1:3001/api/health`
- Swagger: `http://127.0.0.1:3001/swagger`

All four URLs returned HTTP 200 after the app restart. MySQL was not restarted. Backend and Web were restarted against the same database, after which the API still returned the same room, lease, financial records, and image file. Free RAM at final check was about 4.6 GiB of 15.2 GiB visible.

## Real demo data and financial verification

The synthetic owner workflow was created through the authenticated business API, not direct SQL inserts:

- Property **RentFlow Demo House**, address 101 Đường Demo, TP. Hồ Chí Minh.
- Rooms **P101**, **P102**, **P103**, each configured at 3,000,000 VND/month.
- Tenant **Nguyễn Thị Demo**, linked to the existing demo renter login `renter.a@rentflow.test`.
- P101 contract from 2026-10-01 through 2027-10-01, with 3,000,000 VND deposit received.
- Confirmed move-in and move-out handovers; November meter readings: electricity 100→220 kWh, water 20→24 m³.
- November invoice items: rent 3,000,000; electricity 420,000; water 80,000; service 100,000 VND. Total **3,600,000 VND**.
- Confirmed transfer payment **2,000,000 VND**. Debt before deposit settlement: **1,600,000 VND**.
- Deposit settlement: received 3,000,000; deduction 300,000; invoice debt offset 1,600,000; refund **1,100,000 VND**. Final invoice debt is zero.

Read-only Prisma SELECT assertions verified the property/room/tenant/lease foreign-key links, two confirmed handovers, meter row, four invoice items, both confirmed payment records, settlement values, and a real WebP image file. The complete query evidence is produced by `backend/scripts/verify-v9-demo.cjs`.

## Room-image feature

- Owner/staff can upload, view, replace, delete, and select a primary photo through the room gallery. Metadata is stored in MySQL; image bytes are stored as files, not MySQL blobs.
- Image bytes are decoded and format-checked (JPEG/PNG/WebP); original size is capped at 8 MB and 24 megapixels. Images are EXIF-rotated, resized within 1600×1200, converted to WebP, and capped at 2 MB after optimization.
- Room/property authorization applies to every list/view/write route. API integration checks verified outsider isolation. Renter read access is limited to rooms on their lease; upload/delete are OWNER/STAFF only.
- Local images persist in ignored `backend/uploads/rooms`; production Compose provides a dedicated `room_images` named volume at `/app/uploads`.
- The saved P101 image is an explicitly watermarked **TEST FIXTURE — NOT A REAL ROOM PHOTO**. No user-provided room photographs were available, and the public Landing Page still does not list live available rooms.
- Image backup/restore PASS: archived the stored image, extracted it into an isolated temporary folder, and matched SHA-256. Archive: `artifacts/real-demo-v9-2/room-images-backup.tar.gz`.

## Browser evidence

Fourteen screenshots show the actual RentFlow pages rendered by Edge against the running app/database:

1. `01-login.png`
2. `02-dashboard.png`
3. `03-property-list.png`
4. `04-room-list.png`
5. `05-room-detail.png`
6. `06-tenant-list.png`
7. `07-contract.png`
8. `08-handover.png`
9. `09-meter-readings.png`
10. `10-invoice.png`
11. `11-payment.png`
12. `12-debt.png`
13. `13-deposit-settlement.png`
14. `14-tenant-mobile.png`

Files are in `artifacts/real-demo-v9-2/screenshots/`. The mobile image is a 390 px renter view. Screenshots and test-only image fixture are genuine browser/API output; no screen mockups were generated.

## Remaining gaps

- The owner must replace the visibly watermarked test fixture with real P101/P102/P103 photos.
- The public landing page has no live room/photo listing.
- Native Android acceptance on a device/emulator and signed APK/AAB are not verified; the mobile evidence is the responsive renter Web UI.
- SMTP loopback passed, but a real provider/mailbox, HTTPS domain and production deployment are not configured.
- The image archive restore was rehearsed locally. Production database backup/restore and off-host scheduled backup have not been performed.
- Product-owner acceptance is still pending.

## Demo account and safe operation

Use existing seeded role accounts; `owner.a@rentflow.test` is the administrator for this demo property, and `renter.a@rentflow.test` can view the tenant ledger. Their temporary shared demo password is held only in ignored `backend/.env` as `DEMO_PASSWORD`. No credential is stored in this report or Git. Do not reuse it outside this local demo.

Start the existing initialized database and the API/Web without installing packages, building, seeding, or migrating:

```powershell
cd E:\dev\rentflow-upstream
powershell -ExecutionPolicy Bypass -File .\scripts\run-demo.ps1
```

Open `http://127.0.0.1:3000/quan-ly`. Stop safely with:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\stop-demo.ps1
```

Stop preserves the database volume. Do not use `docker compose down -v`.
