# Báo cáo kiểm thử RentFlow V10

Ngày chạy: 26/11/2026.

## Build và runtime

- Backend TypeScript build: PASS.
- Web Next.js production build: PASS.
- Prisma migrate deploy trên MySQL 8.0, database biệt lập `rentflow_v10_demo`: PASS, 7 migrations.
- Seed demo gồm ba quyền, khu trọ, phòng có ảnh, hợp đồng và hóa đơn: PASS.
- API NestJS khởi động và đăng ký đầy đủ route V10: PASS.

## Kiểm thử đã chạy

| Kiểm tra | Kết quả |
|---|---|
| USER đăng nhập và nhận portal đúng | PASS, HTTP 200 |
| ADMIN đăng nhập và nhận portal đúng | PASS, HTTP 200 |
| MANAGER đăng nhập và nhận portal đúng | PASS, HTTP 200 |
| Tài khoản vào API cổng được cấp | PASS, HTTP 200 cho cả 3 |
| Gọi chéo API không được cấp | PASS, HTTP 403 cho cả 3 |
| Mật khẩu sai | PASS, HTTP 401 |
| Chưa đăng nhập gọi API cần session | PASS, HTTP 401 |
| Tự gửi role ADMIN khi đăng ký | PASS, bị từ chối HTTP 400 |

**Tổng: 12 PASS, 0 FAIL.**

Đây là kiểm thử tài khoản và phân quyền. Chưa chạy đủ bộ 36 tình huống trong master prompt, chưa chạy kiểm thử trình duyệt đầu cuối, và chưa có 20 ảnh chụp màn hình. Cloud Browser không kết nối được tới web server trong môi trường thực thi, vì vậy không ghi nhận ảnh giao diện như đã chụp.

Docker không được cài trong môi trường kiểm thử này. Compose và các script Windows đã tạo, nhưng chưa được chạy trên Docker Desktop/Windows.
