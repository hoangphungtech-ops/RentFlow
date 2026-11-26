# Chạy RentFlow V10 demo

## Windows

1. Cài và mở Docker Desktop.
2. Mở PowerShell tại thư mục giải nén.
3. Chạy:

```powershell
powershell -ExecutionPolicy Bypass -File .\RUN-RENTFLOW.ps1
```

Script build stack, tạo database/volume riêng, seed dữ liệu demo, chờ trang đăng nhập và mở trình duyệt.

- Trang đăng nhập: `http://127.0.0.1:32512/login`
- Kiểm tra API các tài khoản: `powershell -ExecutionPolicy Bypass -File .\TEST-RENTFLOW.ps1`
- Dừng ứng dụng, giữ dữ liệu: `powershell -ExecutionPolicy Bypass -File .\STOP-RENTFLOW.ps1`

## Tài khoản

Xem [DEMO_ACCOUNTS.md](DEMO_ACCOUNTS.md). Cả ba tài khoản dùng một mật khẩu demo dùng riêng cho stack cục bộ.
