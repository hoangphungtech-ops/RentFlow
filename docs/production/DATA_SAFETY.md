# Data Safety — bản nháp

| Dữ liệu | Sử dụng | Lưu ở đâu |
|---|---|---|
| Tên, email, ID tài khoản | Đăng nhập và hiển thị hợp đồng | MySQL |
| Người thuê, hợp đồng, liên hệ | Quản lý hợp đồng và xác định phạm vi | MySQL |
| Hóa đơn, thanh toán thủ công, cọc | Sổ đối chiếu | MySQL |
| Token phiên | Xác thực | Bản băm ở MySQL, bản bearer trong SecureStore |
| Yêu cầu xóa và audit | Xác minh, xử lý và theo dõi | MySQL |

Mã nguồn Android chưa tích hợp quảng cáo, phân tích bên thứ ba, thanh toán trực tuyến hoặc quyền vị trí. Kiểm tra lại các dependency, permission manifest, nhà cung cấp hosting, phiên bản release và luồng dữ liệu trước khi khai báo chính thức. Khoản tiền thuê/cọc là giao dịch ngoài đời thực. Nếu thêm thuê bao tính năng số, đánh giá Play Billing theo sản phẩm và thị trường.
