# Android release

RentFlow, version 1.0.0, versionCode 1. `vn.rentflow.tenant` là định danh phát triển trong app.json. EAS release bắt buộc `RENTFLOW_ANDROID_PACKAGE` do chủ tài khoản xác nhận và `EXPO_PUBLIC_API_ORIGIN` là public HTTPS. Expo SDK 58, target 36, compile 37. Android chặn cleartext bằng build properties. Kiểm tra manifest từ artifact ký trước khi chấp nhận cấu hình.

`mobile/eas.json` có profile internal (APK) và production (AAB). Sau khi chủ tài khoản cho phép sử dụng EAS/Play và xác nhận package, cấp môi trường theo profile, chạy `eas build --platform android --profile internal` và `eas build --platform android --profile production`. Xác nhận APK bằng `apksigner verify --print-certs`; kiểm tra AAB bằng bundletool và jarsigner; đối chiếu application ID, version code và SHA chứng chỉ upload. Lưu upload key và khôi phục theo quy trình chủ tài khoản. APK/AAB chưa tạo.

Chạy cài đặt APK và test đăng nhập, liên thông, lỗi mạng, phiên mở lại, đăng xuất và dữ liệu tách biệt. Chỉ nâng versionCode sau khi xác minh Play Console chưa dùng code đó.

[Expo SDK 58](https://docs.expo.dev/versions/v58.0.0/)

## Bằng chứng build local

Expo export Android tạo Hermes bundle `index-d0e7105aa275bd2178d6d122dea26fe5.hbc`. SHA-256 `a68369af1b793ce304e1fd827580d1b737d891c71fdf8e23e68f0d4cb05b289f`. Typecheck và config introspect đạt. Bundle chưa gắn môi trường release.

## Môi trường API Android V7

- Dev native trên emulator dùng `http://10.0.2.2:3000` khi bật riêng `RENTFLOW_ANDROID_DEV_HTTP=1`. Thiết bị dùng USB với adb reverse có thể dùng `127.0.0.1`. Cờ này chỉ áp dụng khi tạo bản native development. Dùng staging HTTPS khi thử qua Wi-Fi.
- Staging dùng một origin HTTPS có chứng chỉ tin cậy. Kiểm tra API và người thuê mẫu trước khi mở cho tester.
- Profile APK internal và AAB production đòi origin HTTPS và application ID được cấp. Cờ dev HTTP bị bỏ qua ở chế độ release. Bước kiểm thử thực tế cần SDK/thiết bị hoặc dịch vụ build được ủy quyền và cấu hình ký do chủ tài khoản quản lý.
