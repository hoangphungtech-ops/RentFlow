# Trạng thái phát hành RentFlow V10

Branch: `feat/phung-rentflow-v10-rbac-20261125`.

Đã triển khai thêm enum ADMIN, API đăng ký người thuê, cổng role, tin phòng có kiểm duyệt, yêu cầu thuê, ảnh phòng, yêu cầu bảo trì, và chứng từ chỉ số công tơ. Tạo trang đăng nhập chung và cổng người thuê, quản trị hệ thống, quản lý khu trọ. Seed V10 sử dụng MySQL demo riêng.

Build backend và web đã đạt. Đã chạy 12 kiểm tra tài khoản/phân quyền và đều PASS. Bản demo còn đang chạy trong phiên thực thi tại đây.

ZIP one-command đã tạo và kiểm tra cấu trúc giải nén. Chưa hoàn tất 36 trường hợp kiểm thử, 20 screenshot, kiểm thử Chrome, hoặc chạy Windows/Docker. Cloud Browser không kết nối được tới loopback của môi trường nên chưa mở được màn hình cho người dùng xem. Lệnh git push và GitHub connector đều trả 403/thiếu thông tin xác thực, nên branch hiện chỉ có trong workspace.
