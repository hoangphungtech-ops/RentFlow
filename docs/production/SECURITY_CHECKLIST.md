# Security checklist

- [x] API xác thực phiên, phân quyền khu trọ và giới hạn ledger theo hợp đồng.
- [x] Cấu hình sản xuất tách DB private, dùng mật khẩu do vận hành đặt, CORS theo origin HTTPS, tắt Swagger công khai.
- [x] Handler giới hạn theo IP cho login, form và yêu cầu xóa. Một instance, lưu trạng thái giới hạn trong bộ nhớ.
- [x] Android thiết kế lưu bearer trong SecureStore và giữ dữ liệu tài chính trong bộ nhớ. Kiểm thử thiết bị còn thiếu.
- [ ] Xác minh TLS thật, cấu hình proxy và logging trên VPS.
- [ ] Duyệt kết quả npm audit runtime, xử lý cảnh báo vượt ngưỡng.
- [ ] Xác nhận phương án khôi phục tài khoản, xóa tài khoản, vận hành backup ngoài máy và giám sát theo lịch.
- [ ] Chạy kiểm thử web/Android liên thông qua Internet bằng tài khoản thật đã cấp trong staging.
