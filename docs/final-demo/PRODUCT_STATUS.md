# RentFlow V7 — Trạng thái sản phẩm

Baseline `ee503ae25fce3ff4b850102bac7608cf60fb8d93`. Đối chiếu Git với remote trước khi triển khai. Nâng cấp V7 chỉ bổ sung migration mới và giữ dữ liệu demo V6.

| Product | Trạng thái | Bằng chứng nghiệm thu | Còn thiếu |
|---|---|---|---|
| P01 Database | DONE | MySQL 8.0.46, 5 migration áp được trên database hiện có và database mới. Backup trước migration, restore biệt lập và restart đều đối chiếu đúng tiền. | Backup ngoài máy là việc riêng của production. |
| P02 NestJS Backend | PARTIAL | `backend/src/accounts.ts`, `account-mail.ts`, `swagger-json`. Auth 8/8, API tài chính 13/13, SMTP loopback 1/1, metadata request của 11 endpoint Auth/Accounts, clean build Docker. | SMTP nhà cung cấp chưa được thử. Xử lý bốn cảnh báo cao ở image Prisma CLI migration trước production. |
| P03 Web Admin | DONE | `web/app/quan-ly/`. Edge 8/8 qua MySQL. Đăng nhập, tạo/kích hoạt nhân viên, quyền khu trọ, khóa/mở khóa, đổi mật khẩu, phòng → hợp đồng → hóa đơn → khoản thu → cọc → sổ đối chiếu. Tìm, lọc và lịch sử phòng. | Xác minh email qua nhà cung cấp thuộc gate SMTP của P02. |
| P04 Demo nghiệp vụ | DONE | 3.620.000đ hóa đơn, 2.000.000đ đã thu, 1.620.000đ còn nợ, 1.200.000đ hoàn cọc. Đạt qua hồi quy backend và thao tác Edge. | Người trình bày diễn tập theo kịch bản với nhóm. |
| P05 Android | PARTIAL | `mobile/App.tsx`, `app.config.js`, `eas.json`. Cùng API, SecureStore, xử lý 401 có mã phiên, typecheck, 3/3 test config, Expo Hermes bundle. | SDK/adb, thiết bị, staging HTTPS, application ID, signing, APK/AAB và thử nghiệm Play. |
| P06 Landing Page | DONE | Form gửi thành công qua Edge và lưu MySQL. Ca lỗi mạng giữ dữ liệu để gửi lại. | Domain Internet là gate riêng. |
| P07 QA & Final Release | PARTIAL | Docker clean-install, HTTPS loopback, backup/restore, kiểm thử bảo mật, hướng dẫn Windows, hướng dẫn chủ trọ/người thuê và kịch bản 10–12 phút. | Diễn tập và nghiệm thu trực tiếp, SMTP thật, thiết bị và quy trình ký. |

**Tổng: 4 DONE, 3 PARTIAL.** Các cổng bị chặn được ghi riêng trong [Release Status](../production/RELEASE_STATUS.md). Xem [báo cáo V7](TEST_REPORT_V7.md) và [checklist nghiệm thu](ACCEPTANCE_V7.md).
