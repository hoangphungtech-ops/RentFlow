# RentFlow V9.2 — Trạng thái sản phẩm

Workspace `E:\dev\rentflow-upstream`, branch `codex/v9-stable-demo`, baseline commit `7939838c27a07b94f061c52dbfab246a93864d5b`. Trạng thái dưới đây được đối chiếu với ứng dụng đang chạy và MySQL biệt lập `rentflow-v9-demo` trên `127.0.0.1:33317`.

| Sản phẩm | Trạng thái | Bằng chứng và điều kiện còn thiếu |
|---|---|---|
| P01 MySQL database | PASS | MySQL 8 healthy; volume riêng `rentflow-v9-demo_rentflow_mysql_data`; sáu migrations up to date. SELECT kiểm tra quan hệ và tài chính sau khi khởi động lại Backend/Web. Không restart MySQL. |
| P02 NestJS Backend | PASS | Build PASS; candidate API 14/14, auth 8/8, SMTP loopback 1/1; health và Swagger HTTP 200. SMTP nhà cung cấp thật chưa cấu hình. |
| P03 Web Admin | PASS | Next build PASS; browser suite 8/8; Edge đã mở và thao tác được; responsive 360/390/768/1366 px không tràn ngang. Ảnh phòng có upload, xem, thay, xóa, ảnh đại diện, phân quyền và lưu file bền vững. |
| P04 Nghiệp vụ thuê | PASS | Dữ liệu `RentFlow Demo House` được tạo qua API: 3 phòng, người thuê, hợp đồng, hai bàn giao, chỉ số, hóa đơn, thanh toán, công nợ và quyết toán. MySQL khớp UI/API; hóa đơn 3.600.000đ, thu 2.000.000đ, bù cọc 1.600.000đ, khấu trừ 300.000đ, hoàn 1.100.000đ. |
| P05 Android | PARTIAL | Tenant web đã mở ở 390 px và xem hợp đồng/hóa đơn/công nợ; responsive 360/390/768/1366 px. Native Android chưa cài/chạy trên thiết bị hoặc emulator; APK/AAB chưa được nghiệm thu. |
| P06 Landing Page | PARTIAL | Landing page và form dùng được; chưa có danh sách phòng/ảnh phòng công khai lấy trực tiếp từ MySQL. Chưa cấu hình SMTP thật. |
| P07 QA, vận hành và bàn giao | PARTIAL | 14 ảnh chụp thật, kiểm tra tài chính, restart Backend/Web và backup/restore ảnh đã có bằng chứng. Chưa diễn tập backup/restore database production, triển khai VPS/domain, SMTP thật hoặc nghiệm thu của chủ sản phẩm. |

**4 PASS, 3 PARTIAL.**

## Ảnh phòng

- API có upload/list/view/replace/set-primary/delete. JPEG, PNG và WebP được kiểm tra bằng nội dung thực; giới hạn ảnh nguồn 8 MB và 24 MP; chuẩn hóa, xoay EXIF, thu nhỏ tối đa 1600×1200 và lưu WebP không quá 2 MB.
- MySQL giữ metadata; file nằm ngoài DB trong `backend/uploads/rooms`. Production Compose dùng named volume `/app/uploads`.
- Các route yêu cầu phiên đăng nhập và phạm vi khu trọ. Người thuê chỉ xem phòng thuộc hợp đồng của mình; chỉ OWNER/STAFF được ghi ảnh. Candidate API kiểm tra phân quyền và thao tác ảnh.
- Ảnh trên phòng P101 là fixture có watermark **TEST FIXTURE — NOT A REAL ROOM PHOTO** vì chưa có ảnh thật do người dùng cung cấp. Chưa dùng ảnh Internet làm ảnh trọ.
- Đã tạo archive ảnh và restore vào thư mục tạm; SHA-256 trùng với file đang lưu. Database production/backup ngoài máy chưa diễn tập.

## Chạy demo hiện tại

Từ `E:\dev\rentflow-upstream`:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\run-demo.ps1
```

Mở Web Admin tại `http://127.0.0.1:3000/quan-ly`, Swagger tại `http://127.0.0.1:3001/swagger`. Khi kết thúc:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\stop-demo.ps1
```

Stop script dừng ứng dụng và MySQL, giữ nguyên volume. Không dùng `docker compose down -v`.

Xem [báo cáo nghiệm thu V9.2](REAL_DEMO_V9_2_REPORT.md) và [báo cáo release V9](FINAL_V9_REPORT.md). Ảnh thật nằm trong `artifacts/real-demo-v9-2/screenshots/`.
