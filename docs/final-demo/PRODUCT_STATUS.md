# RentFlow V4.0 — Product Status

**Kết luận nghiệm thu** RENTFLOW — PARTIAL / NOT READY

**Commit V4 đã xác minh trên GitHub** `62a72437c62ba3fe8122ff137dab18c8d0f35888`. V5 có trạng thái riêng trong [Release Status](../production/RELEASE_STATUS.md).

**Baseline** `53a64f2` từ `origin/feat/vu-foundation`. Git sau fetch không tìm thấy `fcdd89e3ed0396d2443ec163f047258d9d2d2743`. OLD CODE NOT AVAILABLE. Migration gốc được giữ và theo sau bằng migration bổ sung trên nhánh `feat/phung-rentflow-final-demo`.

| Mã | Trạng thái | Chức năng đã có và nguồn | Build / kiểm thử / bằng chứng | Phần tiếp theo |
|---|---|---|---|---|
| P01 Database | DONE | Schema, migration bổ sung, seed hai chủ và hai khu, cấu hình MySQL, runbook. `backend/prisma/`, `docker-compose.yml` | Prisma generate và apply 2 migrations; MySQL 8.0.46; RF14 xác nhận dữ liệu giữ nguyên sau restart | Diễn tập phục hồi bản sao trước triển khai thực |
| P02 Backend | PARTIAL | NestJS, guard, scope, hóa đơn, thanh toán, cọc, audit và Swagger. `backend/src/`, `backend/test/` | TypeScript build; 12/12 API integration trên MySQL thật, health và Swagger HTTP 200 | Bổ sung quy trình cấp/khôi phục tài khoản và schema request trong Swagger |
| P03 Web Admin | PARTIAL | Dashboard, CRUD tạo/cập nhật phòng, hồ sơ thuê, hợp đồng và bàn giao, điện nước, thanh toán, cọc. `web/app/quan-ly/` | Next.js production build; Edge chạy đăng nhập, tìm phòng và mở form phát hành với API thật | Kiểm thử đầy đủ thao tác nghiệp vụ bằng trình duyệt và bổ sung lọc/lịch sử theo phòng |
| P04 Integrated Demo | DONE | Luồng API tạo phòng đến quyết toán, hai mẫu R101 và R110. `backend/test/integration.test.cjs`, `backend/prisma/seed.ts` | RF01–13, RF20; hóa đơn 3.620.000, thu 2.000.000, nợ 1.620.000; hoàn cọc 1.200.000, bù nợ đúng một lần | Chạy diễn tập thuyết trình trực tiếp |
| P05 Android / Mobile | PARTIAL | Web người thuê và mã nguồn React Native/Expo dùng cùng API. `web/app/quan-ly/`, `mobile/` | Edge đạt 360, 768, 1366 px; Android thiết bị và APK chưa kiểm thử | Dùng máy có thiết bị/SDK để chạy RF16 |
| P06 Landing Page | DONE | Trang giới thiệu, ảnh sổ từ sản phẩm, liên hệ và form dùng thử ghi MySQL. `web/app/page.tsx`, `web/app/trial.tsx`, `backend/src/rental.ts` | Browser submit HTTP 201; RF17 kiểm chứng bản ghi lead thật, RF19 phục hồi sau mất mạng | Đo mức hoàn thành form khi có người dùng thực |
| P07 Final Release | PARTIAL | README, vận hành, báo cáo, kiến trúc/UML, kịch bản, dàn ý, phản biện, checklist. `docs/final-demo/`, `scripts/` | Build, health và tự động hóa có bằng chứng trong báo cáo test | Trình diễn trực tiếp, đánh giá người dùng và chốt phạm vi phát hành |

Tổng cộng **3 DONE, 4 PARTIAL, 0 NOT DONE, 0 BLOCKED cấp sản phẩm**. Android trên thiết bị (RF16) là **BLOCKED**. Đánh giá ba tác vụ với người thuê thật là **NOT VERIFIED**.

## Gates

| Gate | Kết quả |
|---|---|
| 0 Audit | PASS. Kiểm tra Git và chọn baseline Vũ |
| 1 Foundation | PASS. Migration, seed, API/Swagger và Web health chạy |
| 2 Core Business | PASS cho luồng demo tự động từ hợp đồng đến phát hành và thu tiền |
| 3 Financial Integrity | PASS cho cách ly quyền, tính tiền, cạnh tranh xác nhận và quyết toán |
| 4 Web UX | PARTIAL. Responsive và luồng đọc/landing đã kiểm chứng, các thao tác admin còn cần duyệt sâu |
| 5 Android & Landing | PARTIAL. Landing đã chạy, Android thiết bị chưa xác minh |
| 6 Full Demo | PASS cho kịch bản tự động trên MySQL, NOT VERIFIED cho buổi trình diễn trực tiếp |
| 7 Final Delivery | PARTIAL. Tài liệu kỹ thuật có, nghiệm thu phát hành và buổi trình diễn chưa hoàn tất |

Chi tiết đầu vào, kỳ vọng, kết quả và lệnh trong [Test Report](TEST_REPORT.md). Các giới hạn trong [Release Checklist](RELEASE_CHECKLIST.md).
