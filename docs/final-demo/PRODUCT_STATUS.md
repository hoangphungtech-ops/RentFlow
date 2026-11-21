# RentFlow V6 — Trạng thái sản phẩm

Baseline V5: `01724c7c3866964ad0891eea397149c71f71eab4`. V6 bổ sung tài khoản và quản lý phiên. Migration cũ được giữ; MySQL demo đã được sao lưu trước nâng cấp.

| Product | Trạng thái | Phạm vi và bằng chứng | Điều kiện còn thiếu |
|---|---|---|---|
| P01 Database & MySQL | DONE | `backend/prisma/`. MySQL 8.0, migration V6 bổ sung username nullable, trạng thái, chủ quản lý và mã một lần. Test hồi quy đối chiếu dữ liệu cũ. | Sao lưu ngoài máy cho môi trường production. |
| P02 NestJS Backend | PARTIAL | `backend/src/accounts.ts`, `auth.ts`, `operator.ts`. API đăng nhập, phiên, tạo/kích hoạt, đổi/reset, khóa, vai trò và liên kết người thuê. `npm.cmd --prefix backend run test:accounts` và `npm.cmd --prefix backend test`. | SMTP chưa có cấu hình. Khôi phục có xác minh bằng CLI. |
| P03 Web Admin | PARTIAL | `web/app/quan-ly/`, `web/app/khoi-phuc/`. Giao diện tài khoản, hồ sơ, mật khẩu và cấp lời mời; Edge E2E qua API thật. | Đổi email tài khoản hoạt động thực hiện qua CLI xác minh. Cần nghiệm thu tiếp với người dùng. |
| P04 Integrated Business Demo | DONE | `backend/test/integration.test.cjs`. Hóa đơn 3.620.000đ, đã thu 2.000.000đ, nợ 1.620.000đ, hoàn cọc 1.200.000đ và chống bù nợ lặp. | Buổi diễn tập trình bày với nhóm. |
| P05 Android App | PARTIAL | `mobile/App.tsx`. Username/email, đổi mật khẩu, phiên hết hạn, SecureStore và dịch vụ thuê hiện hữu. Typecheck và Expo export. | APK/AAB ký, thiết bị thật, HTTPS Internet và kênh recovery tự động. |
| P06 Landing Page | DONE | `web/app/page.tsx` và form dùng thử. Kiểm thử trình duyệt gửi form, API lưu MySQL và xử lý lỗi mạng. | Domain công khai thuộc mốc triển khai riêng. |
| P07 QA & Release | PARTIAL | `docs/final-demo/TEST_REPORT_V6.md`, hướng dẫn tài khoản, bộ kiểm thử API, Edge, Docker và health. | Nghiệm thu thiết bị, SMTP và triển khai Internet. |

Các mốc online, thiết bị và Play được theo dõi trong [Release Status](../production/RELEASE_STATUS.md). Xem [Hướng dẫn tài khoản](DEMO_ACCOUNTS.md) và [Báo cáo V6](TEST_REPORT_V6.md).
