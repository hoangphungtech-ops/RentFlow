# Báo cáo bảo mật

- Phiên bearer ngẫu nhiên 256 bit, lưu SHA-256 phía server, thời hạn tám giờ, đăng xuất xóa phiên. Mật khẩu dùng scrypt với salt ngẫu nhiên.
- Guard kiểm tra phiên ở backend. Chủ trọ bị giới hạn khu sở hữu, nhân viên và kế toán theo bảng cấp quyền, người thuê theo thành viên hợp đồng. Nhân viên ghi chỉ số và biên bản, kế toán xử lý hóa đơn và xác nhận thanh toán, chủ trọ chốt quyết toán.
- Các thay đổi tài chính và thao tác quản lý quan trọng ghi audit trong cùng giao dịch. Mật khẩu demo đọc từ cấu hình ngoài Git. API chỉ trả thông tin người dùng được chọn.
- Compose mở MySQL trên loopback và API demo dùng loopback. Tài khoản MySQL ứng dụng có quyền trên schema RentFlow riêng.

## Trước khi mở cho người dùng thực

Triển khai TLS, giới hạn đăng nhập và form công khai, đăng nhập bằng cookie HttpOnly với kiểm soát CSRF hoặc mô hình phiên được thẩm định, cấp và khôi phục tài khoản, luân chuyển bí mật, sao lưu theo lịch. Bổ sung theo dõi bất thường, kiểm tra lưu trữ dữ liệu cá nhân và kế hoạch phản ứng sự cố. Browser demo lưu bearer trong sessionStorage và hạn chế xuất API ra Internet.
