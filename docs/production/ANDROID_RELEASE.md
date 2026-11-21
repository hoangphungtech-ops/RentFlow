# Android release V8

RentFlow giữ version 1.0.0 và versionCode 1. `vn.rentflow.tenant` là định danh local hiện có. Chủ ứng dụng cung cấp `RENTFLOW_ANDROID_PACKAGE` cho từng môi trường trước khi ký. Kiểm tra versionCode với Play Console trước khi phát hành. Expo SDK 58 dùng React Native 0.88, compile API 37 và target API 36. [Expo SDK 58](https://docs.expo.dev/versions/v58.0.0/) · [Google Play target API](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en-AU)

## Profile, origin và ký

| Môi trường | Cấu hình | Đầu ra |
|---|---|---|
| Dev native | Emulator dùng `http://10.0.2.2:3000` khi bật riêng `RENTFLOW_ANDROID_DEV_HTTP=1`. Thiết bị với adb reverse có thể dùng loopback. | Development build. |
| Staging | EAS profile `internal`, environment `preview`, origin HTTPS và application ID được duyệt. | APK phân phối nội bộ. |
| Production | EAS profile `production`, environment `production`, origin HTTPS và application ID Play được duyệt. | AAB cho Play Console. |

Cấu hình `EXPO_PUBLIC_API_ORIGIN` và `RENTFLOW_ANDROID_PACKAGE` trong đúng EAS environment. Hai giá trị này xuất hiện trong cấu hình ứng dụng và không chứa bí mật. Profile phát hành bắt buộc HTTPS và dùng credential remote do chủ dự án quản lý, kể cả khi cờ dev HTTP được đặt. Liên kết với dự án EAS hiện hữu đã được chủ ứng dụng phê duyệt. [Cấu hình EAS](https://docs.expo.dev/eas/json/) · [Biến môi trường EAS](https://docs.expo.dev/eas/environment-variables)

Từ thư mục `mobile`, người đã được cấp quyền chạy:

```powershell
eas build --platform android --profile internal
eas build --platform android --profile production
```

Dùng credential ký do chủ tài khoản quản lý. Xác nhận APK với `apksigner verify --print-certs <apk>`, AAB với `bundletool validate --bundle <aab>` và `jarsigner -verify <aab>`. Đối chiếu application ID, versionCode, target SDK, fingerprint chứng chỉ và checksum SHA-256 với bản ghi phát hành. Khóa ký và file credential giữ ngoài Git. [Expo internal distribution](https://docs.expo.dev/build/internal-distribution/)

## Cài APK và kiểm tra chung backend

1. Lấy URL APK nội bộ từ build do nhóm sở hữu, tải trên điện thoại thật và kiểm tra SHA-256 theo bản ghi phát hành. Cho phép cài từ nguồn đó trên điện thoại khi được yêu cầu, rồi mở APK để cài. Với máy có SDK, `adb install -r <apk>` là cách thay thế. Một bản đã cài cùng ID phải có chữ ký tương thích.
2. Dùng trình duyệt điện thoại mở endpoint health trên staging HTTPS. Qua Web Admin của cùng origin, tạo tài khoản thuê thử, kích hoạt và liên kết đúng hợp đồng. Đăng nhập app và đối chiếu mã phòng, người thuê và kỳ hóa đơn.
3. Từ Web Admin, báo và xác nhận khoản thu cho hóa đơn thử. Làm mới Android và đối chiếu cùng số tiền còn nợ. Thử tài khoản ngoài khu để xác nhận giới hạn quyền. Dùng dữ liệu giả lập được phép.
4. Thử tắt mạng, mở lại app, đổi mật khẩu và đăng xuất. Phiên cũ phải bị từ chối và giao diện phải quay về đăng nhập. Ghi model, phiên bản Android, application ID, SHA artifact, origin và kết quả từng bước.
5. Dùng AAB ở track Internal Testing trước triển khai rộng. Ghi nguồn APK/AAB và kết quả cài thật vào checklist nghiệm thu.

**Tình trạng hiện tại** Build JavaScript local và kiểm tra cấu hình được ghi trong [Test Report V8](../final-demo/TEST_REPORT_V8.md). Cần dự án EAS và quyền ký đã phê duyệt, staging HTTPS và thiết bị thật để nghiệm thu APK/AAB và `ANDROID_DEVICE_READY`.
