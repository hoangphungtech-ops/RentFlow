# Kịch bản trình bày 10–12 phút

| Phút | Tác vụ | Bằng chứng trên màn hình |
|---|---|---|
| 0–1 | Nêu khó khăn khi theo dõi phòng, điện nước, cọc | Landing Page |
| 1–2 | Trình bày Next.js, NestJS, Prisma và MySQL | Swagger và sơ đồ kiến trúc |
| 2–5 | Đăng nhập chủ A, xem phòng R101, mở hợp đồng và bàn giao | R101 đang thuê, biên bản nhận đã xác nhận |
| 5–7 | Mở hóa đơn R101 và lịch sử thanh toán | Tiền phòng 3.000.000đ, điện 420.000đ, nước 100.000đ, dịch vụ 100.000đ, đã xác nhận 2.000.000đ, còn 1.620.000đ |
| 7–9 | Đăng nhập người thuê trên màn hình hẹp, mở **Xem cách tính** rồi **Xem quyết toán** ở R110 | Điện từ 100 lên 220 với giá 3.500đ. Hoàn cọc 1.200.000đ, sau sửa chữa 300.000đ và bù nợ 500.000đ |
| 9–10 | Trình bày tài khoản chủ B và ca quyền người thuê khác | Các khu tách biệt và API trả 404 với hợp đồng ngoài phạm vi |
| 10–12 | Trình bày bằng chứng chạy xuyên suốt, giới hạn phát hành | Test report, Product Status, Release Checklist |

Để thực hành từ đầu, tạo một phòng trống và hồ sơ thuê trong khu A. Lập hợp đồng từ tháng 10/2026, kích hoạt, lập và xác nhận biên bản nhận phòng. Ghi kỳ 2026-11 với điện 100 → 220, nước 20 → 25. Nhập giá thuê 3.000.000đ và tiền cọc thỏa thuận 2.000.000đ để có thể đối chiếu số mẫu. Phát hành hóa đơn, báo chuyển khoản 2.000.000đ, quan sát công nợ, rồi xác nhận thu. Ghi nhận cọc thực thu. Lập và xác nhận biên bản trả. Chốt khoản sửa chữa 300.000đ, bù nợ 500.000đ vào hóa đơn vừa tạo và xem hoàn 1.200.000đ.

## Đánh giá người dùng

| Tác vụ | Kết quả quan sát cần ghi | Trạng thái người dùng thật |
|---|---|---|
| Tìm căn cứ điện | Chỉ đúng hai chỉ số, lượng tiêu thụ và đơn giá | NOT VERIFIED |
| Tìm khoản đã trả và còn nợ | Nêu được 2.000.000đ, 1.620.000đ và trạng thái khoản chờ | NOT VERIFIED |
| Giải thích hoàn cọc | Nêu được tiền thực nhận, hai khoản trừ và số hoàn | NOT VERIFIED |

Khi có người thử, ghi thời gian, tỷ lệ hoàn thành, bước vướng và số lần cần trợ giúp.

## Dàn ý trình bày và câu hỏi phản biện

1. **Bài toán và người dùng.** Chủ trọ tra đơn giá, tiền nợ và cọc trong một chỗ. Người thuê mở website trên điện thoại.
2. **So với Excel.** Dữ liệu hóa đơn lưu căn cứ theo kỳ, có quyền truy cập theo hợp đồng và có lịch sử thao tác.
3. **Vì sao modular monolith.** Các bước tài chính thay đổi dữ liệu liên quan trong một giao dịch và chỉ cần vận hành một API.
4. **Hóa đơn tính thế nào.** Lấy đơn giá đầu kỳ, lưu snapshot, làm tròn từng dòng Decimal và cộng tổng.
5. **Chống thu tiền hai lần.** Một khóa yêu cầu trên mỗi hóa đơn và giao dịch Serializable khi xác nhận. Khoản chờ giữ nguyên dư nợ.
6. **Chống xung đột hợp đồng.** Kiểm tra sức chứa và hợp đồng đang giữ phòng lúc kích hoạt. Ngày hết hạn không tự trả phòng.
7. **Người thuê đọc được gì.** Truy vấn ledger ràng buộc tenant user thuộc hợp đồng. Tài khoản ngoài phạm vi nhận 404.
8. **Tiền cọc có căn cứ gì.** Thực nhận, biên bản trả, lý do khấu trừ và hóa đơn được bù xuất hiện cùng quyết toán.
9. **Mất kết nối xử lý thế nào.** Form báo lỗi và giữ dữ liệu đang nhập. Gửi lại khoản thu dùng cùng khóa cho cùng dữ liệu trong phiên thao tác.
10. **Trước khi triển khai thực.** Rà soát bảo mật, TLS, vận hành sao lưu và vòng đời tài khoản.
