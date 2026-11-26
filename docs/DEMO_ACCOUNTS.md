# Tài khoản demo RentFlow V10

Ba tài khoản đã được tạo trong cơ sở dữ liệu riêng `rentflow_v10_demo` và đăng nhập thành công bằng API thật.

| Quyền giao diện | Email | Vai trò backend | Trạng thái kiểm tra |
|---|---|---|---|
| USER | `user.demo@rentflow.test` | RENTER | Đăng nhập 200, API người thuê 200 |
| ADMIN | `admin.demo@rentflow.test` | ADMIN | Đăng nhập 200, API quản trị 200 |
| MANAGER | `manager.demo@rentflow.test` | OWNER | Đăng nhập 200, API quản lý 200 |

Mật khẩu chung cho cả ba tài khoản là `RentFlow2511Demo!`.

Dữ liệu chỉ dành cho môi trường demo. Seed V10 yêu cầu cờ `RENTFLOW_V10_DEMO=1`, database tên `rentflow_v10_demo`, và từ chối chạy khi có `PUBLIC_ORIGIN` hoặc môi trường production.
