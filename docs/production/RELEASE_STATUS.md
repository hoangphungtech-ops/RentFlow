# RentFlow V8 — Trạng thái phát hành

| Mốc | Trạng thái | Bằng chứng hoặc điều kiện còn thiếu |
|---|---|---|
| LOCAL_READY | PASS | Startup Windows, Docker clean-install, HTTPS loopback, MySQL 8 và đủ 5 migration. API 13/13, Auth 8/8, SMTP loopback 1/1, Edge 8/8 và RF14 persistence PASS. |
| FINAL_DEMO_READY | PARTIAL | Có dữ liệu và checklist demo 10–12 phút. Nhóm cần diễn tập và ghi kết quả trực tiếp. |
| ONLINE_READY | BLOCKED | Cần hạ tầng triển khai, domain/DNS, TLS công khai, cấu hình SMTP nhà cung cấp và hộp thư thử. |
| ANDROID_DEVICE_READY | BLOCKED | Cần APK, điện thoại Android và staging HTTPS dùng chung với Web Admin để cài và đối chiếu luồng người thuê. |
| PLAY_BUILD_READY | BLOCKED | Target API 36, cấu hình EAS APK/AAB đã kiểm tra. Cần application ID production đã duyệt, dự án EAS và quyền ký để tạo AAB. |
| PLAY_PUBLISHED | BLOCKED | Cần Play Console, AAB ký, hoàn thành quy trình kiểm thử/xét duyệt áp dụng và URL công khai. |

Kết quả SMTP loopback và giao nhận qua nhà cung cấp được ghi riêng. CLI recovery là phương án vận hành hiện có. Nhóm ghi ngày, người tham gia và kết quả người dùng thử trong checklist. Cần phê duyệt chính sách riêng tư và thời gian lưu dữ liệu trước khi phát hành công khai.

[Báo cáo kiểm thử V8](../final-demo/TEST_REPORT_V8.md) · [Checklist nghiệm thu](../final-demo/ACCEPTANCE_V8.md) · [Android release](ANDROID_RELEASE.md) · [Security checklist](SECURITY_CHECKLIST.md)
