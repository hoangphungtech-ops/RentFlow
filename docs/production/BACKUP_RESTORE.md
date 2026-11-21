# Sao lưu và khôi phục

- Chạy `sh deploy/backup.sh` từ cron mỗi ngày và trước migration. Dump dùng transaction nhất quán, file nén với quyền hạn chế. Dùng thư mục riêng và tài khoản quản trị tin cậy.
- Mã hóa bản sao tại đích và sao chép ra ngoài VPS. Xác nhận chủ sở hữu, quyền truy cập, vòng đời bản sao, RPO/RTO và cơ chế cảnh báo theo điều kiện triển khai thật.
- Kiểm tra `gzip -t`. Tạo container/schema MySQL 8 biệt lập, chuyển dump vào `mysql` của môi trường đó qua stdin và tài khoản phục hồi. Kiểm tra số migration, mẫu hợp đồng, dư nợ, khoản thu và quyết toán. Ghi thời gian và kết quả.
- Raw dump có thể chứa dữ liệu cá nhân. Chỉ dùng dữ liệu giả khi diễn tập công khai. Không khôi phục vào production đến khi phân tích dữ liệu phát sinh sau thời điểm backup và được người phụ trách duyệt.

Di?n t?p local ng?y 21/11/2026 d?ng `mysqldump` t? MySQL demo v? ph?c h?i v?o m?t container MySQL 8 tmpfs. B?n gi? tr? ??i chi?u kh?p. L?ch sao l?u ngo?i VPS v? ph?c h?i t? kho l?u tr? th?t ch?a ???c ch?y.
