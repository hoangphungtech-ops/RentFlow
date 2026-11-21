# Báo cáo kiểm thử V5

**Commit triển khai** `853aac751e4b3bc050aded0d948e4b05b222ddf8`. Commit tiếp theo có mã smoke và rà soát giao diện tiếng Việt.

| ID | Môi trường và thao tác | Kết quả |
|---|---|---|
| V5-01 | Windows, Compose demo, Prisma migration deploy | 3 migration trên MySQL 8.0.46, app build và health 200 |
| V5-02 | `npm.cmd --prefix backend test` qua Next và MySQL | 13/13. Phân quyền, concurrency, công nợ, cọc và lưu trial |
| V5-03 | PR01 qua API và CLI trên MySQL | Sai mật khẩu 401, gửi lặp cùng request, đọc trạng thái theo tài khoản, CLI xử lý tài khoản thử và thu hồi phiên |
| V5-04 | `npm.cmd --prefix web test` trên Edge | 6/6. Giao diện người thuê ở 360/768/1366 px, Web Admin, mất mạng và retry form |
| V5-05 | `docker compose ... config --quiet` và `caddy validate` | Cấu hình tổng hợp hợp lệ. Ba image Linux API, Web và migration build thành công |
| V5-06 | Typecheck, Expo export Android và Expo config introspect | Bundle Android và cấu hình target 36 xác minh; mode release từ chối localhost HTTP |
| V5-07 | Cài APK lên máy thật, truy cập chung qua Internet | BLOCKED, cần APK ký, thiết bị và staging HTTPS |
| V5-08 | AAB và Play Console | BLOCKED, cần app ID được xác nhận, signing và tài khoản |
| V5-09 | `npm audit --omit=dev` và kiểm tra Docker runtime | 4 cảnh báo cao ở Prisma CLI/config. Docker runtime có Prisma Client và không resolve được prisma, @prisma/config, effect, deepmerge-ts. Cảnh báo còn ở image migration |
| V5-10 | Dump MySQL demo, restore vào MySQL 8 biệt lập trên tmpfs | PASS. Khớp tổng hóa đơn 3.620.000đ, đã thu 2.000.000đ, nợ 1.620.000đ, hoàn cọc 1.200.000đ |
| V5-11 | 8 POST yêu cầu xóa không có phiên từ loopback | 6 × HTTP 401, 2 × HTTP 429 có Retry-After |
| V5-12 | `python scripts/test-production-local.py` trên loopback, CA nội bộ Caddy, DB riêng | HTTPS 200 ở Landing, quyền riêng tư, xóa tài khoản và API health. MySQL không xuất cổng ra host, 3 migration được áp lên DB biệt lập |

Case tài chính kế thừa [Test Report V4](../final-demo/TEST_REPORT.md). Dữ liệu thử đều giả lập. Bài kiểm thử liên thông cần chạy trên staging theo thứ tự Web phát hành → Android thấy hóa đơn → Web xác nhận thanh toán → Android cập nhật → đối chiếu MySQL.
