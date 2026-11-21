# Android Expo

Ứng dụng dành cho người thuê dùng REST API RentFlow để tra hợp đồng, hóa đơn, thanh toán, công nợ, quyết toán cọc và thông báo. Website /quan-ly vẫn là trải nghiệm chính chạy ngay trong trình duyệt điện thoại.

Sao chép `.env.example` thành `.env` và đặt `EXPO_PUBLIC_API_ORIGIN` bằng địa chỉ HTTPS của backend hoặc HTTPS proxy cùng API mà điện thoại truy cập được. `127.0.0.1` trên điện thoại là chính điện thoại. Biến `EXPO_PUBLIC_API_ORIGIN` chỉ chứa URL và được đóng gói vào client.

```powershell
npm.cmd ci
npm.cmd run typecheck
npm.cmd run build
```

`npm.cmd run build` xuất bundle Android vào `dist/`. Để chạy trên thiết bị với Expo Go tương thích SDK 58, dùng `npm.cmd start` và mở QR phát triển. Trạng thái thiết bị và APK được ghi trong báo cáo kiểm thử.
