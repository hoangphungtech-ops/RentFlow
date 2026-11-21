# Quy trình yêu cầu xóa

Người thuê chọn Yêu cầu xóa tài khoản trong Android để mở trang `/xoa-tai-khoan`, hoặc đi trực tiếp từ website. Người dùng đăng nhập và nhập lại mật khẩu. API ghi một yêu cầu per account và cho phép tra trạng thái. Tại môi trường vận hành, quản trị được ủy quyền dùng `node dist/src/operator.js list-deletion`.

1. Kiểm tra hồ sơ và xác định căn cứ giữ chứng từ, người chịu trách nhiệm và kênh phản hồi. Soạn phản hồi có thông tin dữ liệu được xóa và phần phải giữ.
2. Chạy `node dist/src/operator.js close-renter` đọc JSON `userId, reviewerId, disposition, evidence` trên stdin. `ERASED` áp dụng nếu chưa có hồ sơ hợp đồng. `RETAINED_RECORDS` yêu cầu lý do có căn cứ khi hợp đồng phải giữ. `evidence` là mã tham chiếu xử lý và không chứa mật khẩu hay thông tin liên hệ.
3. CLI thu hồi phiên, xóa thông báo và hồ sơ rời, bỏ liên kết định danh người thuê và đổi thông tin tài khoản sang định danh lưu vết. Hợp đồng được giữ theo phần đã xác minh. Cơ sở dữ liệu giữ yêu cầu và audit tối thiểu. Cần hoàn thiện luồng xóa khi hồ sơ có hợp đồng cần xóa toàn phần và xử lý riêng tài khoản vận hành.
4. Người vận hành gửi kết quả qua kênh đã xác minh, ghi bằng chứng chuyển giao và kiểm tra vòng đời bản sao lưu. Luồng thông báo vận hành chưa được diễn tập với người dùng thật.

[Chính sách xóa tài khoản Google Play](https://support.google.com/googleplay/android-developer/answer/18265346)
