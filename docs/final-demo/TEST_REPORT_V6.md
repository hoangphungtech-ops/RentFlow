# RentFlow V6 — Báo cáo kiểm thử

Môi trường Windows với Docker Desktop, MySQL 8.0.46, NestJS, Next.js và Edge headless. Nâng cấp từ `01724c7`; dump MySQL trước migration được giữ ngoài Git. Đã áp migration `20261121200000_account_management` lên dữ liệu V5, không chạy lại seed.

| ID | Kết quả | Bằng chứng |
|---|---|---|
| ADMIN-01, 03, 17 | PASS | Username chữ hoa/thường, mật khẩu sai trả 401, không có trường hash trong phản hồi, cookie HttpOnly, SameSite Strict, đăng xuất thu hồi. |
| ADMIN-02 | PASS | CLI từ chối provisioning ở production, chạy lại local giữ thông tin đăng nhập. |
| ADMIN-04–07 | PASS | Owner tạo STAFF, mã kích hoạt một lần. Trùng username khác hoa thường trả 409. STAFF không cấp OWNER. Owner khác không khóa hoặc gán khu cho tài khoản mới của chủ khác. |
| ADMIN-08–10 | PASS | Đổi mật khẩu API và Web, sai mật khẩu cũ/không khớp/yếu đều bị từ chối, mật khẩu cũ và hai phiên cũ không còn dùng được. |
| ADMIN-11–13 | PASS qua CLI | Phản hồi quên mật khẩu giống nhau cho email có/không có tài khoản. Mã hết hạn hoặc đã dùng bị từ chối. CLI tạo mã ra file riêng, reset thu hồi phiên cũ. SMTP chưa xác minh. |
| ADMIN-14–15 | PASS | Khóa chặn cả phiên hiện có và đăng nhập. Mở khóa hoạt động. Thu hồi khu cập nhật yêu cầu sau. Đổi vai trò thu hồi phiên. |
| ADMIN-16 | PASS | Unit test limiter chuyển 30 yêu cầu và trả 429 kèm Retry-After ở yêu cầu tiếp theo. |
| ADMIN-18 | PARTIAL | Web đã gọi API chung. Android cùng endpoint và build bundle thành công, chưa kiểm thử thiết bị thật. |
| ADMIN-19 | PASS | Sáu tài khoản mẫu V5 đăng nhập bằng email trong hồi quy API. |
| ADMIN-20 | PASS | MySQL có bốn migration; hợp đồng, hóa đơn, khoản thu và cọc cũ đối chiếu thành công. Dữ liệu giữ nguyên trong lượt restart. |

## Lệnh và hồi quy

- `npm.cmd --prefix backend run test:accounts` đạt **8/8**.
- `npm.cmd --prefix backend test` đạt **13/13**. Hóa đơn 3.620.000đ, đã xác nhận 2.000.000đ, còn nợ 1.620.000đ. Quyết toán hoàn 1.200.000đ và từ chối bù nợ lặp. Form đăng ký dùng thử lưu được vào MySQL.
- `npm.cmd --prefix web test` đạt **7/7**. Edge thử ở 360, 768 và 1366 px, gồm chủ trọ tạo nhân viên, kích hoạt, đăng nhập và đổi mật khẩu qua UI. Các thao tác thử mật khẩu dùng tài khoản tổng hợp, giữ nguyên mật khẩu demo theo cấu hình ban đầu.
- `powershell -ExecutionPolicy Bypass -File .\scripts\test-db-persistence.ps1` đạt RF14.
- Backend, Next.js production build và health check đạt. `npm.cmd --prefix mobile run typecheck` và `npm.cmd --prefix mobile run build` xuất Hermes bundle Android; APK/AAB ký và thiết bị chưa xác minh.

## Nâng cấp và rollback

Migration thêm cột nullable cho tài khoản cũ, giữ nguyên hash và quyền hiện hữu, có dump trước khi deploy. Khi lỗi, ưu tiên sửa tiến trên schema bổ sung. API V5 không hiểu khóa phiên và trạng thái mới, nên không mở lại cho người dùng bằng API V5 trên dữ liệu tài khoản đã chuyển đổi. Nếu cần quay lại, giữ bản sao V6 để đối chiếu và kiểm tra phục hồi snapshot V5 trên MySQL biệt lập trước khi chuyển lưu lượng. Dữ liệu phát sinh sau snapshot phải được đối chiếu trước quyết định chuyển.
- Android Hermes bundle V6 local: `index-12df4cec7fe092dd0025450b15851ef7.hbc`. SHA-256 `c060384321d1eced992920a6f075769536011635286dcfb61c792a8466f7f914`.
- Docker V6 qua HTTPS local đạt 6/6 URL. Fresh MySQL áp đủ bốn migration, MySQL private, production bootstrap không có tài khoản demo. Image Web build bằng Compose. Do npm registry chậm ở bước cài backend, hai image API/migration được build offline từ mã V6 trên lớp phụ thuộc Linux V5. Đã đối chiếu manifest ngoài scripts và lockfile trùng nhau. Lượt cài mới toàn bộ phụ thuộc backend qua registry chưa được xác minh.
