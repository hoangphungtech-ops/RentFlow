# RentFlow V8 — Báo cáo kiểm thử

Baseline `4bf2e47f17110746645252defa8dcd8b46db65eb`. Windows, Node.js 24, MySQL 8.0 và Edge headless. Kiểm tra Git và fetch trước khi thay đổi. Chỉ dùng dữ liệu giả lập cho các tài khoản tạo thêm trong kiểm thử. Các migration đã áp giữ nguyên.

## Bản vá và bằng chứng đã thu được

| Phạm vi | Kết quả |
|---|---|
| Prisma CLI | Audit baseline có 4 high. Override `deepmerge-ts@8.0.0`, `effect@3.22.1` dưới `@prisma/config`, giữ Prisma 6.19.3. `npm audit` và `npm audit --omit=dev` cho lockfile V8 đều trả 0. Lockfile SHA-256 `8030dd3d6155c634f525026be55d7e1935fdd6d228ee537222b193b993f4e4d7`. |
| Candidate biệt lập | `python scripts/test-release-candidate.py --offline` PASS. `npm ci` cài sạch backend/web, Prisma validate/generate và 5 migration áp thành công trên MySQL tmpfs mới. Cả hai bản build đạt. API 13/13, Auth 8/8, SMTP loopback 1/1, Edge 8/8 và audit 0. |
| Docker | Clean build `api`, `web` và `migrate` với lockfile candidate PASS. Migration image có đúng hai bản vá và Prisma 6.19.3. API runtime không chứa Prisma CLI. Smoke HTTPS loopback xác nhận 5 migration, MySQL private, production từ chối `testadmin` với 401 và cookie session có Secure, HttpOnly, SameSite=Strict. |
| Startup Windows | `start-demo.ps1 -SkipInstall` PASS trên database demo hiện hữu, không seed. Sau khi cài lockfile V8, `npm ls` xác nhận đúng hai bản vá và Prisma generate, 5 migration, NestJS/Next.js build đều đạt. Lần khởi động lại dưới tải build song song hết thời gian chờ readiness. Kiểm tra lại bằng `health-check.ps1 -Attempts 10` đạt cả 4 URL. |
| API tài chính và phân quyền | PASS 13/13 trên MySQL demo. Có test chặn owner khác khu và người thuê đọc lịch sử phòng, chống xác nhận khoản thu trùng và chống bù trừ cọc trùng. |
| Auth | PASS 8/8 trên MySQL demo. `testadmin` đăng nhập bằng mật khẩu hiện hữu. Các ca kiểm tra vòng đời tài khoản, audit, rate limit, CLI recovery và thu hồi phiên đều đạt. |
| SMTP loopback | PASS 1/1 trên MySQL thật sau khi khởi động MySQL demo. Đối chiếu xác minh email, mã một lần, mã hết hạn, cooldown theo tài khoản, thu hồi phiên cũ và đăng nhập bằng mật khẩu mới. Lần chạy trước khi khởi động demo timeout ở kiểm tra readiness. |
| Edge | PASS 8/8 khi chạy riêng với MySQL demo. Bao phủ 360/768/1366 px, kích hoạt nhân viên, đăng nhập, phòng đến quyết toán cọc và form landing gửi lại. Ca nghiệp vụ ban đầu timeout do click chi tiết trước khi sổ cập nhật. Test nay đợi dòng thanh toán hoặc quyết toán mới xuất hiện. Hai lượt Edge chạy chồng có lỗi tiến trình trình duyệt. |
| Persistence | RF14 PASS sau khi restart MySQL demo. Dữ liệu trước và sau giống nhau. MySQL 8.0.46, hóa đơn 3.620.000đ, đã thu 2.000.000đ, nợ 1.620.000đ, hoàn cọc 1.200.000đ. Bốn URL health/Swagger/Web vẫn đạt. |
| Android npm | Audit 3 moderate → 0 sau override `minimatch@11.0.1` dưới Expo fingerprint. Clean install 455 packages, config 4/4, Expo fingerprint, introspect compile API 37 / target API 36 và typecheck đều PASS. Metro tạo Android Hermes bundle SHA-256 `a2ad55a1870d3ec4b5f11aa06907092b1cca7447425dd1118f82615e66277f1d`. |
| Backup/restore | PASS. Dump MySQL hiện hữu được phục hồi vào MySQL 8 tmpfs riêng. Có đủ 5 migration và số tiền 3.620.000đ, 2.000.000đ, 1.620.000đ và 1.200.000đ. Dump nằm ngoài Git. |
| Thiết bị và artifact | BLOCKED. Không thấy SDK/adb hoặc APK/AAB trong đường dẫn đã kiểm tra. Chưa có EAS project/signing đã được cấp quyền và chưa cài trên thiết bị thật. |
| SMTP nhà cung cấp | BLOCKED. Chưa có cấu hình provider thực và hộp thư staging đã được cấp. Duy trì CLI fallback. |
| Nghiệm thu người dùng | NOT VERIFIED. Nhóm sẽ ghi riêng kết quả diễn tập và người dùng thử trong checklist. |

## Lệnh tái hiện

- `python scripts/test-release-candidate.py` dùng bản sao backend/web và database MySQL tmpfs bind vào loopback. Các mật khẩu trong lượt này sinh riêng cho test. Chạy Prisma validate, generate, migrate deploy, seed trên DB thử, build và ba bộ API, Auth, SMTP cùng Edge. Flag `--resolve-lock` chỉ dùng khi thay đổi dependency backend. Lockfile chỉ được chép về workspace sau khi các suite và audit đạt.
- `powershell -ExecutionPolicy Bypass -File .\scripts\start-demo.ps1` khởi động demo Windows hiện có. Bỏ tùy chọn `-Seed` khi nâng cấp dữ liệu hiện hữu.
- `npm.cmd --prefix backend run test:smtp` dùng máy chủ SMTP loopback với tài khoản synthetic. `docs/production/DEPLOYMENT_GUIDE.md` mô tả cấu hình provider thực.
- `npm.cmd --prefix mobile test`, `npm.cmd --prefix mobile run typecheck`, `npm.cmd --prefix mobile run build` kiểm tra cấu hình và bundle JavaScript cho Android.

[Chi tiết advisory](../production/SECURITY_CHECKLIST.md) · [Checklist nghiệm thu V8](ACCEPTANCE_V8.md)
