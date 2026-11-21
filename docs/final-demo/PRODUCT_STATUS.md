# RentFlow V8 — Trạng thái sản phẩm

Baseline V7 `4bf2e47f17110746645252defa8dcd8b46db65eb`. Giữ nguyên các migration đã áp và dữ liệu MySQL demo.

| Sản phẩm | Trạng thái | Bằng chứng và điều kiện còn thiếu |
|---|---|---|
| P01 Database | DONE | Khôi phục backup vào MySQL 8 biệt lập, đối chiếu đủ 5 migration và 4 số tiền mẫu. |
| P02 NestJS Backend | PARTIAL | Prisma 6.19.3, audit đầy đủ và runtime đều 0. API 13/13, Auth 8/8 và SMTP loopback 1/1 trên MySQL. Giao nhận email qua SMTP nhà cung cấp BLOCKED. |
| P03 Web Admin | DONE | Edge 8/8 trên MySQL demo, gồm các kích thước 360/768/1366 px, tài khoản nhân viên, phân quyền và luồng phòng đến quyết toán. |
| P04 Demo nghiệp vụ | DONE | Bản restore xác nhận hóa đơn 3.620.000đ, thu 2.000.000đ, còn nợ 1.620.000đ, hoàn cọc 1.200.000đ. |
| P05 Android | PARTIAL | Expo config 4/4, target API 36, typecheck và Hermes PASS. APK/AAB đã ký và cài thiết bị thật BLOCKED. |
| P06 Landing Page | DONE | Edge V8 xác nhận form giữ dữ liệu khi mất mạng, gửi lại và lưu trong MySQL. HTTPS loopback chạy trên Docker V8. |
| P07 QA & Final Release | PARTIAL | Docker clean-build, HTTPS loopback, backup/restore và checklist V8. Nhóm còn phải diễn tập và ký nghiệm thu trực tiếp. |

**4 DONE, 3 PARTIAL.** [Báo cáo kiểm thử V8](TEST_REPORT_V8.md) · [Nghiệm thu V8](ACCEPTANCE_V8.md) · [Các cổng phát hành](../production/RELEASE_STATUS.md) · [Bằng chứng V7](TEST_REPORT_V7.md)
