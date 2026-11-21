# Báo cáo kiểm thử RentFlow

**Commit V4** `62a72437c62ba3fe8122ff137dab18c8d0f35888`. Hồi quy sau V5 ghi tại [báo cáo V5](../production/TEST_REPORT.md).

**Môi trường** Windows, Node.js 24.18.0, Docker 28.5.1, MySQL 8.0.46, Prisma 6.19.3, Next.js 16.4.6, Microsoft Edge headless.

## Tái hiện

Khởi động demo có seed như runbook. Các test ghi dữ liệu giả lập mới vào database demo. Chạy lần lượt các lệnh sau để tránh ngắt kết nối trong lúc kiểm thử trình duyệt.

| Ký hiệu | Lệnh |
|---|---|
| B | `npm.cmd --prefix backend test` |
| W | `npm.cmd --prefix web test` |
| D | `powershell -ExecutionPolicy Bypass -File .\scripts\test-db-persistence.ps1` |
| H | `powershell -ExecutionPolicy Bypass -File .\scripts\health-check.ps1` |
| G | `git -c core.whitespace=-blank-at-eof diff --cached --check`, kiểm tra Git index, mẫu bí mật và file ignore |
| M | `npm.cmd --prefix mobile run typecheck` và `npm.cmd --prefix mobile run build` |

| ID | Input | Expected | Actual | Trạng thái | Bằng chứng |
|---|---|---|---|---|---|
| RF01 | Chủ A đọc/ghi khu B; chủ B đọc R101 khu A | Không xuất hiện trong danh sách, 404 khi gọi ID | Danh sách đúng phạm vi, 404 | PASS | B |
| RF02 | Renter B đọc R101, renter A đọc R101, phiên trống | 404, 200, 401 | Đúng ba kết quả | PASS | B |
| RF03 | Nhân viên tạo khu/phát hóa đơn; kế toán quyết toán | 403 | 403 | PASS | B |
| RF04 | Hai hợp đồng nháp cùng phòng, kích hoạt đồng thời | Một hợp đồng active | Một ACTIVE, một DRAFT | PASS | B |
| RF05 | Hai người trong phòng sức chứa một | 409 | 409 | PASS | B |
| RF06 | Chỉ số âm và chỉ số giảm | 400 và 409 | 400 và 409 | PASS | B |
| RF07 | Đổi giá điện 3.500 → 9.000 sau phát hành | Snapshot 3.500, tổng 3.620.000 | Hai giá trị giữ nguyên | PASS | B |
| RF08 | Thuê 3.000.000, điện 120 × 3.500, nước 5 × 20.000 và dịch vụ 100.000 | Tổng 3.620.000, kỳ trùng 409 | 3.620.000 và 409 | PASS | B |
| RF09 | Khoản chờ 200.000 trên hóa đơn mẫu và khoản chờ 2.000.000 trên hóa đơn test | Dư nợ giữ nguyên | Dư nợ mẫu 1.620.000, test trước xác nhận 3.620.000 | PASS | B |
| RF10 | Xác nhận khoản 2.000.000 | Đã thu 2.000.000, còn 1.620.000 | Hai giá trị đúng, đảo tăng nợ lại 3.620.000 | PASS | B |
| RF11 | Hai request đồng thời cùng khóa và hai lệnh xác nhận đồng thời | Một khoản thu, dư nợ 1.620.000 ở cả hai phản hồi | Cùng ID, dư nợ 1.620.000 | PASS | B |
| RF12 | Cọc 2.000.000, khấu trừ 1.800.000 và bù 500.000 | 409 | 409, phương án hợp lệ hoàn 1.200.000 | PASS | B |
| RF13 | Gửi lại quyết toán bù 500.000 | 409, một giao dịch bù cọc | 409, đúng một giao dịch, nợ 1.120.000 sau bù | PASS | B |
| RF14 | Restart container MySQL demo | Hóa đơn, cọc và số bản ghi giữ nguyên | JSON trước/sau giống nhau, MySQL 8.0.46 | PASS | D |
| RF15 | Admin và renter gọi API Next proxy, 360/768/1366 px | Hiển thị dữ liệu MySQL, không tràn ngang | Hóa đơn, chỉ số, công nợ và hoàn cọc đúng; tìm phòng hoạt động | PASS | B, W, H |
| RF16 | Chạy trên thiết bị/emulator Android | Đăng nhập và đọc MySQL qua REST | Máy kiểm thử thiếu Android SDK/adb, chưa có thiết bị | BLOCKED | M xác minh bundle riêng |
| RF17 | Gửi form dùng thử ở Landing Page | HTTP 201 và lead lưu trong DB | HTTP 201 trên Edge; API trả ID truy vấn được trong Prisma | PASS | B, W |
| RF18 | Kiểm tra snapshot Git và đầu ra chạy demo | File cấu hình thật ngoài Git, không thấy giá trị mật khẩu hay token trong phạm vi kiểm tra | Cấu hình thật được bỏ qua, log seed chỉ in mã lỗi khi thất bại | PASS | G |
| RF19 | Đưa Edge offline khi gửi form rồi online và gửi lại | Báo mất kết nối, giữ dữ liệu, gửi lại thành công | Lỗi và giữ nguyên họ tên, sau đó HTTP 201 | PASS | W |
| RF20 | Tạo phòng và hồ sơ, kích hoạt, bàn giao, ghi chỉ số, phát hành, thu, quyết toán | Hoàn 1.200.000; phòng trở thành trống | API đi hết luồng, kết quả đúng | PASS | B |

Trong lượt chụp ảnh, bài thử Edge 768px chạy trùng thời điểm restart MySQL và timeout đăng nhập. Các lần xác minh giao diện được chạy khi MySQL khỏe. Thử trực tiếp với người dùng và APK thiết bị vẫn chưa có bằng chứng.
