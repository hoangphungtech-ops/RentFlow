# Sao lưu và khôi phục

- Chạy `sh deploy/backup.sh` từ cron mỗi ngày và trước migration. Script tạo `*.sql.gz` dùng transaction nhất quán và `*-uploads.tar.gz` từ volume ảnh; cả hai archive có quyền hạn chế. Dùng thư mục riêng và tài khoản quản trị tin cậy.
- Mã hóa bản sao tại đích và sao chép ra ngoài VPS. Xác nhận chủ sở hữu, quyền truy cập, vòng đời bản sao, RPO/RTO và cơ chế cảnh báo theo điều kiện triển khai thật.
- Kiểm tra `gzip -t`. Tạo container/schema MySQL 8 biệt lập, chuyển dump vào `mysql` của môi trường đó qua stdin và tài khoản phục hồi. Kiểm tra số migration, mẫu hợp đồng, dư nợ, khoản thu và quyết toán. Ghi thời gian và kết quả.
- Raw dump có thể chứa dữ liệu cá nhân. Chỉ dùng dữ liệu giả khi diễn tập công khai. Không khôi phục vào production đến khi phân tích dữ liệu phát sinh sau thời điểm backup và được người phụ trách duyệt.
- Khôi phục cả hai archive bằng `RESTORE_CONFIRM=YES sh deploy/restore.sh <database.sql.gz> <uploads.tar.gz>`. Script tạo backup rollback mới trước, dừng API trong thời gian khôi phục và thay nội dung volume ảnh; kiểm tra đích và bản backup trước khi xác nhận.

Diễn tập local ngày 21/11/2026 dùng `mysqldump` từ MySQL demo và phục hồi vào một container MySQL 8 trên tmpfs. Bốn giá trị đối chiếu khớp. Lịch sao lưu ngoài VPS và phục hồi từ kho lưu trữ thật chưa được chạy.
