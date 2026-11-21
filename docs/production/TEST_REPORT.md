# Báo cáo kiểm thử V5

| ID | Môi trường và thao tác | Kết quả |
|---|---|---|
| V5-01 | Windows, demo Compose, Prisma migration deploy | 3 migration trên MySQL 8.0.46, app build và health 200 |
| V5-02 | `npm.cmd --prefix backend test` qua Next và MySQL | 13/13. Scope owner, staff và renter, concurrency, công nợ, cọc và lưu trial |
| V5-03 | PR01 qua API và CLI trên MySQL | Sai mật khẩu 401, gửi lặp cùng request, đọc trạng thái theo account, CLI xóa profile tài khoản thử và thu hồi phiên |
| V5-04 | `npm.cmd --prefix web test` trên Edge | 6/6. Trang renter 360/768/1366 px, Web Admin, mất mạng và retry form |
| V5-05 | `docker compose ... config --quiet` | Cấu hình tổng hợp được chấp nhận, domain thật chưa có |
| V5-06 | `npm.cmd --prefix mobile run typecheck` và `npm.cmd --prefix mobile run build` | Typecheck và bundle Android pass |
| V5-07 | Cài APK lên máy thật, truy cập chung qua Internet | BLOCKED, cần APK ký, thiết bị và staging HTTPS |
| V5-08 | AAB và Play Console | BLOCKED, cần app ID được xác nhận, signing và tài khoản |
| V5-09 | `npm audit --omit=dev` backend | Phát hiện 4 cảnh báo cao liên quan Prisma CLI/config, phương án sửa npm báo cần Prisma 7.10.1. Dockerfile tách migration và runtime, cần xác minh dependency runtime image và xử lý trước production |

Case tài chính kế thừa [Test Report V4](../final-demo/TEST_REPORT.md). Không có dữ liệu người dùng thật. Bài kiểm thử liên thông cần chạy ở staging theo thứ tự Web phát hành → Android thấy hóa đơn → Web xác nhận thanh toán → Android cập nhật → đối chiếu MySQL.
