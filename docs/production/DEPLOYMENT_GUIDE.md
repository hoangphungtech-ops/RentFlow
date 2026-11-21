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
