# Google Play checklist

- [x] Xác minh hướng dẫn hiện hành cho app mới điện thoại yêu cầu target Android 16, API 36 trở lên. [Google Play target API](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en-AU)
- [ ] Xác nhận application ID, chủ tài khoản và chứng thư upload. Kiểm tra AAB chính thức từ pipeline.
- [ ] Điền privacy URL, deletion URL, Data Safety, permissions, content rating, target audience, ads và support. Xác nhận hành vi SDK trong binary.
- [ ] Cấp tài khoản review người thuê riêng trong staging có hợp đồng giả, hóa đơn và cọc. Cung cấp hướng dẫn và credential qua Play Console.
- [ ] Internal Testing cài từ Play, thu thập crash và ghi kết quả. Theo loại tài khoản, Closed Testing có thể yêu cầu 12 người opt-in liên tục 14 ngày với tài khoản cá nhân tạo sau 13/11/2023. [Yêu cầu kiểm thử tài khoản cá nhân](https://support.google.com/googleplay/android-developer/answer/14151465)
- [ ] Xin quyền production, xác minh duyệt, chỉ lên lịch công khai sau khi chủ tài khoản phê duyệt.
