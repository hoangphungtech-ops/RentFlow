# RentFlow V10 · Sáu cổng làm việc

Bản này dùng các nghiệp vụ V9 ở mốc 24/11, lấy bố cục demo 25/11 làm mẫu và giữ hệ thống phân quyền ở bản V10 ngày 26/11. Sáu cổng dùng chung trang đăng nhập và tổ chức menu theo vai trò. Bộ lọc cơ sở chỉ hiển thị địa chỉ thuộc phạm vi tài khoản.

## Chạy bằng PowerShell

Mở Docker Desktop để Docker Engine sẵn sàng. Giải nén ZIP và chạy lệnh dưới đây trong thư mục RentFlow.

```powershell
powershell -ExecutionPolicy Bypass -File .\RUN-RENTFLOW.ps1
```

Script build API và web, áp dụng migration, seed MySQL demo và mở trình duyệt tại `http://127.0.0.1:32512/login`. Dừng bằng `powershell -ExecutionPolicy Bypass -File .\STOP-RENTFLOW.ps1`. Cơ sở dữ liệu demo được lưu trong volume Docker.

| Cổng | Tài khoản |
|---|---|
| Người thuê | testnguoidung |
| Chủ trọ | testchutro |
| Quản lý | testquanly |
| Quản trị hệ thống | testadmin |
| Nhân viên | testnhanvien |
| Kế toán | testketoan |

Mật khẩu chung khi dùng cấu hình demo mặc định là `Demo@2026!`. Đăng xuất trước khi thử vai trò khác.

## Kiểm thử lại

Có thể chạy `TEST-RENTFLOW.ps1` để kiểm tra nhanh API. Bộ Playwright đầy đủ nằm ở `web/test/rbac-all.cjs`. Từ thư mục `web`, cài phụ thuộc bằng `npm ci` và cài trình duyệt bằng `npx playwright-core install chromium`.

```powershell
$env:DEMO_PASSWORD = 'Demo@2026!'
$env:RENTFLOW_TEST_ORIGIN = 'http://127.0.0.1:32512'
node test/rbac-all.cjs
```

Đặt thêm `RENTFLOW_FULL_UI=1` để chạy các ca tạo phòng, đặt lịch, phát hành hóa đơn và ghi nhận khoản thu. Chỉ bật chế độ này trên database demo mới vì các ca kiểm thử tạo nghiệp vụ mẫu. Đặt `RENTFLOW_SCREENSHOTS` thành đường dẫn thư mục nếu muốn lưu ảnh. Cần `pdfinfo` để xác nhận PDF đúng một trang A4.

Bản bàn giao đã chạy Next.js, NestJS, Prisma, MySQL và Chromium trên Linux đám mây. Docker Desktop và PowerShell Windows cần xác nhận trên máy đích. Xem ảnh chụp và log trong thư mục `docs/full-ui-evidence` đi kèm ZIP.

Sau khi đăng nhập bằng `testnguoidung`, cổng mở ở **Tìm phòng phù hợp**. Có thể thử tìm `studio an binh` và lọc **Còn trống**, rồi mở ảnh hoặc gửi yêu cầu. Mục **Trao đổi** hiển thị tin nhắn theo từng yêu cầu và dùng chung dữ liệu với chủ trọ hoặc quản lý được phân công. Khi chuyển tài khoản trên cùng trình duyệt, đăng xuất trước rồi đăng nhập bằng tài khoản mới. Tài khoản demo cũ `manager.demo@rentflow.test` có quyền OWNER. Dùng `testquanly` để thử cổng MANAGER.
