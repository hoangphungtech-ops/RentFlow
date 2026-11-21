# Vận hành demo

## Cấu hình

1. Mở Docker Desktop. Kiểm tra Linux engine bằng `docker info`.
2. Sao chép `.env.example` thành `.env` và `backend/.env.example` thành `backend/.env` nếu chưa có. Giữ file thật ngoài Git.
3. Đặt `MYSQL_ROOT_PASSWORD` và `MYSQL_PASSWORD` khác nhau. Đặt cùng mật khẩu ứng dụng vào URL của `DATABASE_URL` và mã hóa URL nếu mật khẩu có ký tự dành riêng. Cổng mặc định là 33307. Khi đổi cổng, cập nhật cả hai file. Đặt `DEMO_PASSWORD` tối thiểu 12 ký tự nếu chạy seed.
4. Chạy `powershell -ExecutionPolicy Bypass -File .\scripts\start-demo.ps1 -Seed`. Bỏ `-Seed` sau khi đã nạp dữ liệu. Seed dành cho DB demo và cập nhật mật khẩu của tài khoản mẫu khi chạy lại.
5. Dùng `powershell -ExecutionPolicy Bypass -File .\scripts\health-check.ps1` để kiểm tra MySQL gián tiếp qua API, Swagger, Web và API proxy.
6. Dừng bằng `powershell -ExecutionPolicy Bypass -File .\scripts\stop-demo.ps1`. Compose giữ volume. Dùng `-SkipInstall` nếu đã chạy npm ci trên cả hai package và lockfile vẫn giống lúc cài.

Compose dùng project `rentflow-demo`, một MySQL 8 và volume riêng so với Compose baseline. Sao lưu dữ liệu cũ trước khi lập kế hoạch nhập vào môi trường mới. Thay đổi mật khẩu trong file môi trường của volume đã khởi tạo cần đi cùng thao tác đổi mật khẩu trong MySQL.

## Khi dùng MySQL 8 sẵn có

Tạo database demo và tài khoản MySQL có quyền migration trên database đó. Trỏ backend/.env đến database demo. Sau khi cấu hình, các bước tương ứng của script là:

```powershell
cd backend
npm.cmd ci
.\node_modules\.bin\prisma.cmd generate
.\node_modules\.bin\prisma.cmd migrate deploy
npm.cmd run build
npm.cmd run seed
npm.cmd start
```

Trong cửa sổ khác mở thư mục `web` và chạy `npm.cmd ci`, `npm.cmd run build`, `npm.cmd start -- --hostname 127.0.0.1`. Web mặc định proxy đến `http://127.0.0.1:3001`. Có thể đặt `RENTFLOW_API_ORIGIN` trước khi build cho địa chỉ backend khác.

## Sao lưu và phục hồi

- Dùng một tài khoản sao lưu riêng có quyền cần thiết để tạo bản dump nhất quán với `mysqldump --single-transaction --no-tablespaces`. Nhập mật khẩu qua prompt hoặc file tùy chọn giới hạn quyền truy cập.
- Giữ dump ở nơi bảo mật. Kiểm tra phục hồi trên schema hoặc máy chủ thử nghiệm riêng trước khi áp dụng thay đổi dữ liệu. Đối chiếu số bản ghi, hóa đơn, thanh toán và quyết toán.
- Chạy `prisma migrate deploy` trên bản sao demo trước khi phát hành. Khi phát hiện lỗi, dừng ghi dữ liệu và dùng bản sao lưu đã kiểm tra để chuẩn bị phương án phục hồi.
