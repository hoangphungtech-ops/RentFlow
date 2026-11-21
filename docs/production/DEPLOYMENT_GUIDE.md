# Triển khai VPS

Cần VPS Linux được ủy quyền, Docker + Compose, DNS thật, SSH, và thư mục lưu backup có quyền hạn chế. Clone đúng nhánh và kiểm tra Git SHA. Tạo file môi trường riêng ngoài repository theo `deploy/.env.production.example`. Dùng password mạnh khác nhau, URL của tài khoản ứng dụng trỏ đến `mysql:3306/rentflow`, mã hóa URL password nếu cần. Đặt quyền file 600.

```sh
export RENTFLOW_ENV_FILE=/etc/rentflow/production.env
export RENTFLOW_BACKUP_DIR=/var/backups/rentflow
export RENTFLOW_RELEASE="$(git rev-parse --short=12 HEAD)"
sh deploy/release.sh
```

Release build hai image versioned, chờ MySQL khỏe, tạo dump, áp migration rồi khởi động dịch vụ. Dùng clone mới hoặc thư mục release riêng để giữ checkout và image revision trước. Xác minh web và API bằng curl từ ngoài VPS trước khi nhận dữ liệu thật. API health chỉ xác nhận kết nối DB.

Tạo tài khoản đầu tiên bằng lệnh operator đọc JSON từ stdin qua TTY ở máy tin cậy. Chuyển password riêng mỗi tài khoản bằng kênh riêng. Không seed V4 lên production. Dùng `docker compose ... exec -T api node dist/src/operator.js create`, với JSON `email, fullName, role, password`; file tạm nếu dùng phải giới hạn quyền và không lưu trong repo.

## Rollback

Nếu migration tương thích ngược, đặt `RENTFLOW_RELEASE` về SHA đã lưu và chạy `docker compose --env-file "$RENTFLOW_ENV_FILE" -p rentflow-production -f deploy/compose.production.yml up -d --no-build api web edge`. Kiểm tra health và dữ liệu. Nếu migration không tương thích, dừng ghi để chọn forward fix hoặc restore sang môi trường riêng, xác định chênh lệch sau backup trước khi chuyển dịch vụ.

## Kiểm thử image trước VPS

Build image với `RENTFLOW_RELEASE=local-build-check` và cấu hình tổng hợp bằng `docker compose -f deploy/compose.production.yml build api web migrate`. Trên Windows, `python scripts/test-production-local.py` dùng các image này để kiểm tra HTTPS qua CA nội bộ trên loopback, rồi dừng container. Kiểm tra DNS và ACME trên VPS là bước riêng.

## SMTP V7

Đặt `SMTP_HOST`, `SMTP_FROM`, `SMTP_PORT` và cặp `SMTP_USER`/`SMTP_PASSWORD` nếu máy chủ yêu cầu xác thực. Dùng file môi trường riêng. Port 465 dùng TLS ngay khi kết nối. Các port khác yêu cầu STARTTLS. Giữ mặc định xác minh chứng chỉ.

Quên mật khẩu qua SMTP chỉ tự gửi cho tài khoản đã xác minh email. Yêu cầu trả thông báo chung và gửi ở nền, có giới hạn theo IP và thời gian chờ theo tài khoản đã xác minh. Tiến trình hiện chưa có hàng đợi bền vững; nếu gửi thất bại, dùng lại form hoặc quy trình CLI. Đổi email yêu cầu mật khẩu hiện tại và mã chứng minh quyền nhận thư ở địa chỉ mới. Mã không xuất hiện trong phản hồi. Sau khi xác nhận, các phiên bị thu hồi.

Để kiểm tra trước khi mở cho người dùng, chạy test loopback, sau đó gửi tới địa chỉ thử do nhóm sở hữu bằng SMTP thật. Xác minh địa chỉ gửi, TLS, nhận email và thu hồi phiên. [Cấu hình SMTP Nodemailer](https://nodemailer.com/smtp)

## Cấu hình SMTP V8

Đặt riêng `SMTP_HOST` và `SMTP_PORT`, không ghép URL hoặc credentials vào host. Chọn `SMTP_SECURITY=auto` cho mặc định TLS ở port 465 và STARTTLS ở các port khác. Dùng `tls` để yêu cầu TLS ngay khi kết nối hoặc `starttls` khi nhà cung cấp chỉ định nâng cấp kết nối. `SMTP_FROM` là địa chỉ gửi đã xác minh. Đặt đồng thời `SMTP_USER` và `SMTP_PASSWORD` nếu nhà cung cấp yêu cầu. Nhập trực tiếp vào cấu hình bí mật của máy vận hành. [SMTP transport](https://nodemailer.com/smtp)

Chạy `npm.cmd --prefix backend run test:smtp` với MySQL demo hoặc dùng [bộ test biệt lập V8](../final-demo/TEST_REPORT_V8.md). SMTP loopback chỉ dùng trong test local. Khi chuyển sang nhà cung cấp, kiểm tra nhận mã trong hộp thư thử do nhóm quản lý. Kiểm tra giới hạn tần suất, hết hạn, dùng lại mã và thu hồi phiên sau reset. Nếu chưa có SMTP hoặc giao nhận lỗi, người vận hành vẫn có luồng CLI đã xác minh trong [hướng dẫn tài khoản](../final-demo/DEMO_ACCOUNTS.md).
