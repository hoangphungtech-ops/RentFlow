# Tài khoản demo và quản lý truy cập

## Chuẩn bị chủ trọ local

Sau khi cấu hình MySQL demo, chạy `powershell -ExecutionPolicy Bypass -File .\scripts\start-demo.ps1` từ thư mục gốc. Với database demo mới hoàn toàn, chỉ dùng tùy chọn `-Seed` nếu cần tạo dữ liệu mẫu V5. Khi nâng cấp từ V5, chạy lệnh mặc định để giữ tài khoản và dữ liệu hiện hữu.

Sao chép `backend/.env.admin-demo.example` thành `backend/.env.admin-demo`. Đặt `DEMO_ADMIN_EMAIL` thành một email riêng cho tài khoản và nhập `DEMO_ADMIN_PASSWORD` do người phụ trách cung cấp. Bảo vệ file bằng quyền truy cập của người dùng local. Tài khoản mẫu dùng tên đăng nhập `testadmin`. Từ thư mục gốc, chạy:

```powershell
npm.cmd --prefix backend run provision:demo-admin
```

Lệnh chỉ chạy với database tương ứng địa chỉ loopback, từ chối chế độ production và giữ mật khẩu nếu tài khoản demo đã tồn tại. Lần tạo đầu tiên cấp một khu trọ riêng cho chủ trọ này. Các tài khoản mẫu V5 tiếp tục dùng email và cấu hình hiện hữu.

## Tạo và giới hạn tài khoản

1. Mở [Web Admin](http://127.0.0.1:3000/quan-ly). Đăng nhập bằng username hoặc email.
2. Mở **Cài đặt → Tài khoản & phân quyền**, chọn vai trò Nhân viên, Kế toán hoặc Người thuê. Chọn khu trọ thuộc sở hữu.
3. Xác minh người nhận qua kênh tin cậy. Chuyển mã một lần riêng tư. Mở **Kích hoạt tài khoản**, nhập mã và đặt mật khẩu tối thiểu 12 ký tự. Lời mời hết hạn sau 24 giờ.
4. Dùng **Phân quyền theo khu trọ** để gán hoặc thu hồi quyền nhân viên và kế toán. Với người thuê, chọn **Liên kết hồ sơ người thuê** để nối tài khoản với hồ sơ hiện hữu trong khu của mình. Hồ sơ đã liên kết với tài khoản khác sẽ bị từ chối.
5. Trong chi tiết tài khoản có trạng thái, cập nhật tên/username, đổi vai trò Nhân viên ↔ Kế toán, khóa/mở khóa và thu hồi phiên. Email đang chờ kích hoạt có thể sửa và cấp lại lời mời. Email tài khoản hoạt động dùng quy trình xác minh bên dưới.

## Mật khẩu và phiên

Trong **Cài đặt → Bảo mật**, nhập mật khẩu hiện tại, mật khẩu mới và xác nhận. Đăng nhập lại bằng mật khẩu mới. Kiểm tra trình duyệt hoặc điện thoại dùng phiên cũ nhận HTTP 401 ở `/api/account/me`. Nút **Thu hồi phiên khác** giữ phiên hiện tại và thu hồi các phiên còn lại. Khóa tài khoản, đổi vai trò và đặt lại mật khẩu thu hồi phiên của tài khoản liên quan. Web dùng cookie HttpOnly. Android dùng Bearer qua SecureStore.

## Khôi phục có xác minh

Form **Quên mật khẩu?** nhận email, ghi yêu cầu khi phù hợp và trả thông báo chung. Người vận hành được ủy quyền dùng CLI trên host tin cậy, với cấu hình MySQL riêng và JSON qua stdin. Khi thao tác local, thêm `--env-file=.env` trước đường dẫn script từ thư mục backend.

- `node dist/src/operator.js list-recovery` hiển thị danh sách yêu cầu cho người vận hành. Xác minh danh tính của người yêu cầu qua kênh đã thiết lập.
- `node dist/src/operator.js issue-reset` nhận `userId`, `evidence` (mã tham chiếu xác minh) và `outputFile` (đường dẫn chưa tồn tại trong thư mục có quyền truy cập riêng). CLI ghi mã một lần vào file này. Chuyển mã qua kênh đã xác minh rồi xóa file theo quy trình vận hành.
- Người nhận mở **Có mã khôi phục**, nhập mã và mật khẩu mới. Mã hết hạn sau 20 phút. Mã đã dùng hoặc bị thay thế sẽ bị từ chối.
- `node dist/src/operator.js verify-email` nhận `userId`, `email` và `evidence`. Chỉ chạy sau khi xác minh quyền sở hữu địa chỉ mới. Thao tác cập nhật email và thu hồi phiên, mã cũ.

SMTP tự động cần cấu hình và kiểm thử riêng. Trước khi lên Internet, sử dụng cơ sở dữ liệu production riêng và cấp tài khoản thật. Tài khoản demo V6 có cờ riêng và bị chặn đăng nhập trong chế độ production; dữ liệu mẫu V5 chỉ được nạp ở môi trường demo.
