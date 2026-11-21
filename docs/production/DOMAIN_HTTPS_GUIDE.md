# Domain và HTTPS

RentFlow dùng một domain HTTPS. Đặt bản ghi A đến IPv4 của VPS. Chỉ đặt AAAA nếu VPS truy cập được qua IPv6. Cấu hình firewall để cho phép TCP 80/443, giới hạn SSH cho quản trị, giữ MySQL và các cổng nội bộ khỏi Internet. Caddy lấy và gia hạn chứng chỉ bằng cổng 80/443. Giữ volume Caddy qua các lần nâng cấp.

Kiểm tra từ ngoài LAN bằng `curl -fsS https://<domain>/api/health` và mở trang quản trị, quyền riêng tư, xóa tài khoản. Cấu hình Android dùng chính origin đã kiểm tra. Domain thực tế chưa được cấp cho lượt này.
