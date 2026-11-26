# RentFlow V10 · Sáu cổng, 15 tài khoản

Nhánh `feat/phung-rentflow-v10-rbac-all-accounts-20261126` kế thừa nền 25/11 commit `570f9855d838f56417f4dc1e3b39acbef21cf094` và giữ các tính năng V10 đã tích hợp.

| Cổng | Tên đăng nhập demo | Vai trò |
|---|---|---|
| Người thuê | testnguoidung, testnguoidung2 | RENTER |
| Chủ trọ | testchutro, testchutro2 | OWNER |
| Quản lý | testquanly, testquanly2 | MANAGER |
| Quản trị hệ thống | testadmin | ADMIN |
| Nhân viên | testnhanvien | STAFF |
| Kế toán | testketoan | ACCOUNTANT |

Có thể dùng thêm hậu tố `@rentflow.test`. Sáu tài khoản V9 vẫn đăng nhập bằng email cũ. Mật khẩu mặc định của cơ sở dữ liệu demo mới là `RentFlow2511Demo!`. Seed RBAC kiểm tra tên database, môi trường, va chạm định danh và giữ mật khẩu hiện hữu.

## Chạy trên Windows

Mở Docker Desktop rồi chạy `powershell -ExecutionPolicy Bypass -File .\RUN-RENTFLOW.ps1` từ thư mục giải nén. Script chạy MySQL, migration, seed, NestJS và Next.js, sau đó mở trang đăng nhập. Dừng với `STOP-RENTFLOW.ps1`.

## Kiểm tra lại với Playwright

Tại thư mục `web`, chạy `npm ci` và cài trình duyệt bằng `npx playwright-core install chromium`. Đặt biến môi trường DEMO_PASSWORD theo mật khẩu demo. Chạy `node test/rbac-all.cjs`. Có thể đặt RENTFLOW_TEST_ORIGIN, RENTFLOW_BROWSER_EXECUTABLE và RENTFLOW_SCREENSHOTS để đổi địa chỉ, chọn Chromium có sẵn và xuất ảnh.

Kết quả và ảnh từ môi trường MySQL demo nằm trong `docs/screenshots/rbac-all`. Kịch bản gồm 15 lượt đăng nhập, chặn vào cổng sai, cách ly khu trọ và hợp đồng, hạn chế tài chính của nhân viên, giao việc, tiến độ bảo trì, đăng xuất và trang đăng nhập 360px.

Docker Desktop chưa được kiểm chứng trong môi trường Linux đám mây. Đã chạy stack Next.js, NestJS, Prisma và MySQL trực tiếp.
