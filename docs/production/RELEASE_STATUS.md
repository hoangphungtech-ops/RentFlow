# Trạng thái phát hành RentFlow

| Mốc | Trạng thái | Bằng chứng hoặc điều kiện còn thiếu |
|---|---|---|
| LOCAL_READY | PASS | MySQL 8.0.46, NestJS, Next.js, 3 migration, health 200, API 13/13, Edge 6/6 |
| ONLINE_READY | BLOCKED | Chưa có VPS, domain, cấu hình DNS thật và quyền triển khai. Compose được kiểm tra riêng |
| ANDROID_DEVICE_READY | BLOCKED | Có mã nguồn, typecheck, Android JS bundle. Chưa có thiết bị/SDK và API HTTPS thật |
| PLAY_BUILD_READY | BLOCKED | Target cấu hình 36, version 1.0.0 (1), chưa xác nhận application ID production, chưa có signing/APK/AAB |
| PLAY_INTERNAL_TESTING | BLOCKED | Chưa có AAB ký, Play Console hoặc quyền tổ chức tester |
| PLAY_CLOSED_TESTING | BLOCKED | Chưa xác định loại tài khoản và điều kiện closed testing thực áp dụng |
| PLAY_PRODUCTION_APPROVED | BLOCKED | Chưa gửi duyệt |
| PLAY_PUBLISHED | BLOCKED | Chưa có URL công khai của Google Play |

Runtime, công nợ và quyền đã chạy trên dữ liệu giả lập trong MySQL thật. Quyền riêng tư vẫn là dự thảo. Luồng xóa người thuê được kiểm thử API và CLI với tài khoản thử, việc duyệt quy định giữ dữ liệu và quy trình phản hồi có chủ sở hữu vẫn cần xác minh. Báo cáo thiết bị, Internet và Play tách riêng trong [Test Report](TEST_REPORT.md).
