# RENTFLOW V9 — Kế hoạch hoàn thiện theo nhu cầu người dùng Việt Nam

> Nền tảng đánh giá: GitHub branch `test-11-24`, commit `6b5fc76`, 25/11/2026. Đây là kiểm tra source và tài liệu, **không phải nghiệm thu runtime trên máy người dùng**.

## Nguồn so sánh các nhánh

| Nhánh | Quyết định | Lý do |
|---|---|---|
| feat/phung-rentflow-final-demo | Không merge lại | Là ancestor của test-11-24 |
| feat/vu-foundation | Không merge lại | Là ancestor của test-11-24 |
| feat/vu-billing-and-ui | Không merge lại | Là ancestor của test-11-24 |
| feat/vu-admin-ui | Không merge lại | Là ancestor của test-11-24 |
| feat/hieu-backend | Chỉ tham khảo, kiểm tra từng tính năng | Không chung Git ancestor, schema/Prisma, endpoints và phiên đăng nhập khác; merge nguyên nhánh không an toàn |

## Ý tưởng từ nhánh Hiếu: chọn lọc, không sao chép nguyên module

- **Mời người thuê một lần, có hạn sử dụng**: hướng tiếp cận tốt. V9 đã có account activation với mã băm và thời hạn, cần đối chiếu luồng thực tế rồi mới bổ sung trải nghiệm chia sẻ lời mời, không làm hai cơ chế song song.
- **Chống ghi nhận thu tiền trùng/idempotency**: nhánh Hiếu có `Idempotency-Key`, nhưng V9 đã dùng `requestKey` và ràng buộc chống trùng. Việc tiếp theo là test hai request đồng thời và retry khi mất mạng, không tạo bảng thanh toán thứ hai.
- **Biên nhận chuyển khoản/ảnh minh chứng**: có ích khi người thuê báo chuyển khoản, cần phát triển tương thích API V9, kiểm tra quyền theo invoice/lease của từng khu, giới hạn file, kiểm tra nội dung thật, giữ an toàn dữ liệu.
- **Audit**: V9 đã có audit cơ bản; nên bổ sung trang xem lịch sử thao tác theo quyền (ai sửa chỉ số, hủy hóa đơn, đảo thu, chốt cọc).
- **Lưu ý bảo mật**: KHÔNG chuyển `scripts/backup.ps1` từ nhánh Hiếu sang V9 vì file đó có mật khẩu MySQL root viết cứng và đường dẫn máy cố định. Dùng backup với thông tin xác thực trong môi trường bảo mật.

## Phần được chuẩn bị trong bản vá UX này

1. Tìm phòng/tên khu **không dấu**, ví dụ `phong quan 3` có thể tìm `Phòng Quận 3`.
2. Tìm người thuê không dấu để chọn người lập hợp đồng nhanh hơn.
3. Dashboard: thẻ `Quá hạn` và **danh sách cần đối chiếu** gồm phòng, kỳ hóa đơn, tiền còn thiếu, hạn trả, mở sổ bằng một click.
4. Không sửa hợp đồng, tính tiền, phân quyền, DB/migration, Docker hay .env.

## P0 — Bắt buộc trước demo ổn định

- Kiểm thử toàn bộ nghiệp vụ tạo khu/phòng → thuê → bàn giao → điện nước → hóa đơn → báo thanh toán → kế toán xác nhận → chốt cọc.
- Trường hợp Việt Nam: giá VND không có phần lẻ, mã phòng không trùng trong khu, kỳ điện/nước, chỉ số mới >= cũ, đổi người thuê giữa kỳ, chốt công nợ, sai khác số thu, đảo giao dịch có lý do.
- Tách `PENDING` và `CONFIRMED`; **không** tự xác nhận chuyển khoản chỉ vì người thuê bấm `Đã chuyển`.
- Sao lưu DB + ảnh phòng và diễn tập phục hồi trên môi trường **riêng**, không dùng dữ liệu thật để thử nghiệm.
- Ghi nhận test trên máy chạy V9, không suy từ báo cáo của workspace khác.

## P1 — Tính năng Việt Nam hữu ích

- Danh sách việc cần làm hằng ngày: hóa đơn quá hạn, hợp đồng sắp hết, phòng trống, khoản chờ xác nhận.
- Bộ lọc khu trọ/phòng/người thuê có dấu/không dấu, trạng thái và số điện thoại; thao tác được trên điện thoại.
- Trang phòng trống công khai có ảnh thật, giá, phí khác, địa chỉ khu vực, đặt lịch xem phòng; ẩn phòng đã thuê.
- VietQR tĩnh hoặc động để *hỗ trợ thao tác chuyển tiền*; phải đối soát giao dịch ngân hàng trước khi xác nhận, tránh giả ảnh chuyển khoản.
- Mẫu hóa đơn dễ đọc, in/PDF tiếng Việt; nêu rõ chỉ số cũ/mới, đơn giá, cọc, nợ; gửi nhắc bằng kênh người dùng đồng ý.
- Nhật ký thao tác theo vai trò chủ trọ / nhân viên / kế toán, hạn chế lộ dữ liệu giữa các khu.

## P2 — Chuẩn bị chạy thật

- SMTP nhà cung cấp thật, domain + HTTPS, giám sát lỗi và bảo mật thông tin định danh.
- Thử Android trên điện thoại thật và kiểm tra build có chữ ký; không coi web responsive là đã phát hành Android.
- Backup ngoài máy, thử phục hồi, quy trình hoàn tác khi migration thay đổi schema.
- Nghiệm thu với chủ trọ Việt Nam ở các quy mô 5, 20, 100+ phòng: thao tác không kỹ thuật, mất mạng, đổi người thuê, chuyển khoản thiếu/dư, điện/nước bất thường.

## Tiêu chí nghiệm thu UX mới

- Gõ `phong` tìm được `Phòng`, `dang` tìm được `Đặng`, `quan 3` tìm được `Quận 3`.
- Dashboard chỉ tính công nợ còn lại > 0, quá hạn khi ngày hạn nhỏ hơn ngày hiện tại theo múi giờ Việt Nam.
- Nút `Xem sổ` mở đúng hợp đồng; không tự ghi nhận đã thu hoặc phát thông báo.
- Web build và test PASS trên commit đề xuất; test lại cả Desktop và 360px mobile.
