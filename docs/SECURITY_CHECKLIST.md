# Kiểm tra an toàn V10 demo

- [x] Seed chỉ hoạt động khi bật cờ demo và trỏ tới database `rentflow_v10_demo`.
- [x] Seed từ chối `NODE_ENV=production` và `PUBLIC_ORIGIN`.
- [x] Tài khoản đăng ký công khai luôn nhận role RENTER, bỏ qua role do client gửi.
- [x] Session web dùng HttpOnly cookie, SameSite Strict, hết hạn sau 8 giờ.
- [x] Các API V10 bắt buộc session ở backend.
- [x] Đã xác minh các vai trò khác bị chặn khỏi API trái quyền với HTTP 403.
- [x] Khu trọ quản lý giới hạn theo property owner/access scope.
- [x] Database MySQL và volume upload của demo có tên riêng trong Compose.
- [ ] Chưa chạy kiểm tra cấu hình Docker Compose trên Docker Desktop.
- [ ] Chưa có kiểm thử trình duyệt tự động hoặc ảnh chụp giao diện trong lần chạy này.
