# Bảo mật RentFlow V8

## Phạm vi audit trước khi vá

| Dòng npm audit | Phạm vi bị ảnh hưởng | Hành động |
|---|---|---|
| `deepmerge-ts` | < 8.0.0, CVE-2026-40345, cạn stack trong thao tác hợp nhất dữ liệu đệ quy | Ghim 8.0.0 riêng dưới `@prisma/config`. [Advisory](https://github.com/advisories/GHSA-ggr8-5vv4-36mx) |
| `effect` | ≤ 3.22.0, CVE-2026-121707, ReDoS ở regex từ schema template literal | Ghim 3.22.1 riêng dưới `@prisma/config`. [Advisory](https://github.com/advisories/GHSA-7589-6fvf-x4pw) |
| `@prisma/config` | Cảnh báo lan truyền từ hai dependency trên | Kiểm tra cây cài đặt và npm audit với lockfile mới. |
| `prisma` | Cảnh báo lan truyền qua `@prisma/config` | Giữ Prisma và Prisma Client cùng 6.19.3 trong lần vá này. |

Hai advisory trực tiếp tạo bốn dòng high trong audit baseline. Chuỗi này nằm trong toolchain Prisma CLI và image migration. API runtime dùng Prisma Client sinh sẵn, loại CLI và chuỗi dependency trên. Phương án npm gợi ý nâng Prisma 7.10.1 là thay đổi major. Phương án V8 là override hẹp, sau đó thử clean install, validate, generate, migration và hồi quy trên database biệt lập. Khi upstream Prisma cung cấp cấu hình đã vá tương thích với dự án, có thể gỡ override sau một vòng hồi quy tương đương.

Android có ba dòng moderate trước bản vá, lan từ `minimatch` qua `@expo/fingerprint` tới Expo. V8 ghim `minimatch@11.0.1` dưới fingerprint và giữ Expo SDK 58. Kiểm tra lại cây dependency, build bundle và công cụ fingerprint. [Advisory minimatch](https://github.com/advisories/GHSA-g3hv-75wg-m249)

## Checklist kiểm tra

- [x] Ràng buộc phân quyền API với khu trọ và hợp đồng. Kiểm tra truy cập phòng, lịch sử phòng và ledger giữa các vai trò.
- [x] Có cơ chế thu hồi phiên, giới hạn IP và cooldown cho khôi phục email. SMTP production yêu cầu TLS/STARTTLS, kiểm tra chứng chỉ và dùng biến môi trường.
- [x] Production chặn tài khoản demo. Web dùng cookie HttpOnly, Secure và SameSite Strict khi cấu hình production. Android dùng SecureStore.
- [ ] Xác minh SMTP nhà cung cấp, TLS công khai và logging trên hạ tầng do chủ dự án cấp.
- [ ] Xác minh backup định kỳ ngoài máy, diễn tập sự cố và liên thông Web/Android trên staging.

Xem phạm vi và kết quả audit thực tế trong [Test Report V8](../final-demo/TEST_REPORT_V8.md). Audit phụ thuộc npm và các ca hồi quy đã chọn chỉ phản ánh những phạm vi được kiểm tra.
