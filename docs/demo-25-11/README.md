# RentFlow — Demo 25/11/2026

Bản tổng hợp từ `test-11-24` và các thay đổi RentFlow V9.3, gồm trang chọn luồng demo, dữ liệu mẫu, hình minh chứng và PDF hóa đơn A4.

## Chạy một lệnh

Cần Docker Desktop đang chạy ở chế độ Linux containers, Internet cho lần tải ảnh container và dependency đầu tiên, cùng cổng 32511 còn trống. Mở PowerShell tại thư mục đã giải nén.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\RUN-RENTFLOW-25-11.ps1
```

Trình duyệt mở tại [Demo RentFlow](http://127.0.0.1:32511/demo/index.html).

| Mục | Thao tác | Dữ liệu |
| --- | --- | --- |
| User, Admin và Quản lý | Tìm phòng → gửi yêu cầu → duyệt → xác nhận. Admin thêm khu/phòng và ảnh. Ba vai trò xem ảnh và trạng thái phòng. | Demo trong trình duyệt |
| RentFlow V9 | Tổng quan, đối chiếu công nợ, ghi và sửa chỉ số, hủy và phát hành lại hóa đơn, in PDF A4. | Next.js, NestJS, MySQL |
| Điện nước, QR và bảo trì | Thử ảnh công tơ, báo chuyển khoản và theo dõi yêu cầu sửa chữa. | Demo trong trình duyệt, QR minh họa |

Tài khoản mẫu và mật khẩu được ghi trên trang chọn luồng. Compose dùng cổng web loopback 32511 và volume riêng của project `rentflow-2511-demo`. Cơ sở dữ liệu không mở cổng ra máy chủ. Các mật khẩu trong Compose dành riêng cho dữ liệu mẫu.

Để dừng demo và giữ dữ liệu, dùng `docker compose -f compose.demo-25-11.yml stop`.

## Kết quả kiểm thử và minh chứng

- [Kiểm thử V9.3 và ảnh giao diện](../improvements/V9_3_RUNTIME.md)
- [User xác nhận đặt phòng](RentFlow_User_XacNhan.jpg)
- [Admin duyệt yêu cầu](RentFlow_Admin_Duyet.jpg)
- [Quản lý xem khu vực](RentFlow_QuanLy_KhuVuc.jpg)
- [Phòng mới AB201 và ảnh ở cổng User](RentFlow_AB201_PhongMoi.jpg)
- [Đối soát khoản thu qua MySQL](RentFlow_MySQL_DoiSoat.jpg)
- [PDF hóa đơn A4](rentflow-hoa-don-a4.pdf)
- [Prompt và phạm vi tích hợp](Prompt_Tong_RentFlow.md)
