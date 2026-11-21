# RentFlow V7 — Báo cáo kiểm thử

Baseline `ee503ae25fce3ff4b850102bac7608cf60fb8d93`. Môi trường Windows, Edge headless, MySQL 8.0.46 và Docker Desktop Linux. Dump trước V7 được giữ ngoài Git. Migration mới thêm loại mã EMAIL và địa chỉ đích cho mã xác minh, giữ dữ liệu V6 và không chạy seed.

| Hạng mục | Kết quả và lệnh |
|---|---|
| Auth và phân quyền | PASS 8/8 với `npm.cmd --prefix backend run test:accounts`. Username, khóa/mở khóa, giới hạn vai trò, thu hồi quyền, mã CLI, thu hồi phiên, rate limit. |
| Xác minh email và SMTP loopback | PASS 1/1 với `npm.cmd --prefix backend run test:smtp`. SMTP TCP local nhận thư thực từ API. Sai mật khẩu và mã của người dùng khác bị từ chối, địa chỉ mới chỉ có hiệu lực sau khi xác nhận. Reset chỉ gửi cho địa chỉ đã xác minh, mã dùng một lần và phiên cũ bị thu hồi. |
| SMTP nhà cung cấp | BLOCKED. Chưa có máy chủ, địa chỉ gửi xác minh và hộp thư thử để chứng minh giao nhận Internet. CLI fallback đạt. |
| Backend và tài chính | PASS 13/13 với `npm.cmd --prefix backend test`. Giữ cách ly khu trọ, chốt đơn giá, idempotency và bù nợ. |
| Edge | PASS 8/8 với `npm.cmd --prefix web test`, trên 360/768/1366 px. Lượt đầu FAIL tại nhãn bộ lọc và lần lặp quyền khu trọ khi form chưa cập nhật. Đã sửa nhãn, cập nhật danh sách quyền và khóa form khi đang gửi. Lượt cuối đạt toàn luồng tài khoản và nghiệp vụ. |
| Swagger và persistence | PASS. Swagger JSON có 11 request schema nhóm Auth/Accounts. RF14 giữ đủ bốn số tiền và số bản ghi sau restart. Web, API và Swagger health 200 sau restart. |
| Docker clean install | PASS. `docker compose -f deploy/compose.production.yml build --no-cache api web migrate` chạy npm ci từ lockfile và build ba image. `python scripts/test-production-local.py` qua HTTPS nội bộ đạt 6/6 URL, với MySQL mới áp đủ năm migration và không mở cổng ra host. |
| Backup/restore | PASS. Phục hồi dump trước V7 vào MySQL biệt lập trên tmpfs. Khớp tổng hóa đơn 3.620.000đ, đã thu 2.000.000đ, nợ 1.620.000đ và hoàn cọc 1.200.000đ. |
| Android | PASS 3/3 cấu hình với `npm.cmd --prefix mobile test`, typecheck và Expo export. SDK 58.0.26, React Native 0.88.1, SecureStore 58.0.3, build-properties 58.0.12, target 36. Không tìm thấy SDK/adb trong các đường dẫn đã kiểm tra. APK/AAB và thiết bị thật BLOCKED. |
| Phụ thuộc | `npm audit` báo 4 cảnh báo cao trong chuỗi Prisma CLI. Runtime Docker loại `prisma`, `@prisma/config`, `effect` và `deepmerge-ts`. Image migration vẫn cần phương án nâng cấp và kiểm thử riêng. |

Hermes bundle V7 local `index-c6260dbef2a1b58b8f1baa77bff977af.hbc`, SHA-256 `fb2f94829fa3825efdf005a577130fd5dcb1fd789431f6f2f478274816383dde`.

[GitHub Advisory cho deepmerge-ts](https://github.com/advisories/GHSA-ggr8-5vv4-36mx) · [GitHub Advisory cho effect](https://github.com/advisories/GHSA-7589-6fvf-x4pw)

Smoke bảo mật bổ sung đạt trên stack production biệt lập: bootstrap không tạo `testadmin`, API từ chối fixture demo đưa vào database với HTTP 401, tài khoản thuê tổng hợp nhận cookie Secure, HttpOnly và SameSite Strict. Kiểm tra Git không tìm thấy bí mật local hoặc file ký/build Android trong thay đổi.
