# Prompt tổng — RentFlow quản lý nhà trọ minh bạch

> Hãy hoàn thiện RentFlow thành một sản phẩm quản lý nhà trọ cho chủ trọ Việt Nam và người thuê. Một ứng dụng có hai cổng dùng chung nghiệp vụ và dữ liệu. Cổng Quản trị–Quản lý dành cho chủ trọ, nhân viên và kế toán theo quyền. Cổng Người dùng cho phép khách tìm phòng và người thuê đã có hợp đồng sử dụng các chức năng tương ứng.
>
> ## 1. Nền tảng và phạm vi
>
> Đọc repository hoangphungtech-ops/RentFlow và kiểm tra nhánh test-11-24 trước khi sửa mã. Giữ các luồng V9 đã kiểm thử, đặc biệt là phân quyền theo khu, hợp đồng, hóa đơn, hủy hóa đơn có lý do, điều chỉnh công tơ, đơn giá chốt, đối soát, cọc và PDF A4. Tích hợp trên nhánh riêng. Chạy thử với MySQL và dữ liệu demo riêng. Chỉ cập nhật main khi được phép ghi và toàn bộ kiểm thử đạt.
>
> Dựng hai cổng với React, Tailwind CSS và Lucide Icons. Cổng quản trị có sidebar và header, màu xanh lá trên nền slate nhạt. Cổng người dùng ưu tiên điện thoại và mở mặc định vào Hóa đơn cho người đã thuê. Khách tìm phòng có thể đi thẳng vào Trang chủ. Bản thuyết trình phải có một file HTML độc lập để mở offline và có công tắc chuyển cổng.
>
> ## 2. Cổng Quản trị–Quản lý
>
> - Tổng quan có bốn thẻ doanh thu xác nhận trong tháng, tỷ lệ lấp đầy, hóa đơn chưa thanh toán và sự cố mở. Có biểu đồ doanh thu sáu tháng, hoạt động mới nhất và danh sách việc cần xử lý mở thẳng hồ sơ. Tính từ dữ liệu truy cập được, dùng giờ Việt Nam. Định nghĩa doanh thu theo thời điểm xác nhận tiền thực nhận.
> - Quản lý theo khu vực → cụm (tùy chọn) → đường → số nhà/hẻm → phòng. Dùng Bình Thạnh và ba cụm mẫu tại Phú Nhuận để thuyết trình. Hiện tổng số phòng, phòng trống và công nợ. Bấm phòng để xem chi tiết, bấm tiền nợ để mở bảng hóa đơn đã lọc.
> - Chốt điện nước theo kỳ. Hiển thị người thuê và chỉ số đầu kỳ khóa, nhập chỉ số cuối kỳ, tính số tiêu thụ, xem thumbnail ảnh điện và nước. Ảnh ghi nhận thời điểm cung cấp và người thực hiện. Kiểm tra chỉ số cuối kỳ không nhỏ hơn đầu kỳ. Phát hành hóa đơn từ đơn giá đã chốt và chống tạo trùng.
> - Hóa đơn có tổng tiền, đã thu, còn nợ, hạn trả và trạng thái. Sổ chi tiết hiện hợp đồng, chỉ số, đơn giá, ảnh, lịch sử thanh toán và PDF A4. Giữ hóa đơn đã hủy để kiểm toán và loại khỏi công nợ. Chỉ giảm nợ sau khi người có quyền xác nhận tiền thực nhận.
> - Yêu cầu thuê phòng cho phép duyệt, từ chối, nhắn tin và gửi lịch hẹn. Bảo trì cho phép tiếp nhận, cập nhật tiến độ và hoàn thành. Hệ thống thật lưu lịch sử các thay đổi quan trọng.
>
> ## 3. Cổng Người dùng
>
> - Trang chủ cho phép lọc phòng theo khu vực, xem giá, vị trí và trạng thái. Người dùng gửi yêu cầu xem hoặc đặt phòng, theo dõi phản hồi và xác nhận. Quản trị có thể gửi đề nghị lịch xem để người dùng đồng ý hoặc từ chối. Trên máy chủ thật, giữ chỗ có thời hạn và chặn xác nhận trùng trong giao dịch cơ sở dữ liệu.
> - Hóa đơn hiện tiền phòng, dịch vụ, công thức điện nước, ảnh công tơ kèm ngày giờ và hạn thanh toán. Thanh toán trên bản demo mở QR minh họa theo phòng, kỳ, số tiền. Bản thật dùng thông tin tài khoản nhận hợp lệ và hỗ trợ đối soát với giao dịch ngân hàng. Luồng báo đã chuyển dùng trạng thái chờ đối soát.
> - Hợp đồng hiện phòng, thời hạn, cọc đã xác nhận và bảng phí theo thỏa thuận. Nhân viên chỉ xem theo trách nhiệm. Người thuê chỉ truy cập hóa đơn, ảnh và hợp đồng thuộc mình.
> - Báo sự cố nhận danh mục, mô tả và ảnh/video, sau đó hiển thị tiến độ Đã tiếp nhận → Đang sửa chữa → Hoàn thành.
>
> ## 4. Thứ tự triển khai
>
> 1. Hoàn thiện tổng quan theo cơ sở và nối với API V9.
> 2. Nối quy trình chỉ số, ảnh bằng chứng, hóa đơn, in PDF và đối soát. Giữ định danh ảnh, quyền đọc và nhật ký khi chỉnh sửa.
> 3. Thêm yêu cầu xem/đặt phòng hai chiều, kiểm tra quyền và tránh giữ chỗ đồng thời.
> 4. Thêm bảo trì và hoàn thiện trải nghiệm điện thoại. Tích hợp VietQR thật sau khi có thông tin nhận tiền và quy trình đối soát đã kiểm thử.
>
> ## 5. Tiêu chí bàn giao
>
> Trình diễn được ba luồng liên thông trên hai cổng: ghi chỉ số → phát hành → khách xem ảnh → báo chuyển → chủ trọ đối soát, khách gửi yêu cầu → quản trị phản hồi → khách xác nhận, người thuê báo sự cố → chủ trọ cập nhật → khách đọc tiến độ. Chạy kiểm thử ở 360, 768 và 1366 px. Bàn giao ảnh chụp thật từ trình duyệt, kết quả kiểm thử và mô tả môi trường. Ghi rõ phần chạy dữ liệu mẫu và phần dùng MySQL/API thật.
