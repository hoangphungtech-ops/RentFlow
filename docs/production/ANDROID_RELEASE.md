# Android release

RentFlow, version 1.0.0, versionCode 1. `vn.rentflow.tenant` là định danh phát triển trong app.json. EAS release bắt buộc `RENTFLOW_ANDROID_PACKAGE` do chủ tài khoản xác nhận và `EXPO_PUBLIC_API_ORIGIN` là public HTTPS. Expo SDK 58, target 36, compile 37. Android chặn cleartext bằng build properties. Kiểm tra manifest từ artifact ký trước khi chấp nhận cấu hình.

`mobile/eas.json` có profile internal (APK) và production (AAB). Sau khi chủ tài khoản cho phép sử dụng EAS/Play và xác nhận package, cấp môi trường theo profile, chạy `eas build --platform android --profile internal` và `eas build --platform android --profile production`. Xác nhận APK bằng `apksigner verify --print-certs`; kiểm tra AAB bằng bundletool và jarsigner; đối chiếu application ID, version code và SHA chứng chỉ upload. Lưu upload key và khôi phục theo quy trình chủ tài khoản. APK/AAB chưa tạo.

Chạy cài đặt APK và test đăng nhập, liên thông, lỗi mạng, phiên mở lại, đăng xuất và dữ liệu tách biệt. Chỉ nâng versionCode sau khi xác minh Play Console chưa dùng code đó.

[Expo SDK 58](https://docs.expo.dev/versions/v58.0.0/)

## B?ng ch?ng build local

Expo export Android t?o bundle Hermes `index-dcf01f4f7a7957e78d204daf5b5a4ecd.hbc`. SHA-256 `10bc2bca0775d6bec61c0098c5880cacebfc9bfc60fb4ba72c2f6197a0426be8`. K?t qu? typecheck v? ki?m tra c?u h?nh n?m trong b?o c?o V5. Bundle ch?a g?n m?i tr??ng release.
