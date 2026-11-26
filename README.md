# RentFlow

RentFlow quản lý phòng trọ, người ở, hợp đồng, bàn giao, điện nước, hóa đơn, thanh toán và tiền cọc. Người thuê dùng cùng website trên điện thoại để xem Sổ đối chiếu thuê trọ.

## Demo tổng hợp 25/11

Mở Docker Desktop, sau đó chạy lệnh dưới đây từ thư mục RentFlow đã giải nén.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\RUN-RENTFLOW-25-11.ps1
```

Trang demo mở cổng ba vai trò, RentFlow V9 trên MySQL và bản minh họa điện nước, QR, bảo trì. [Hướng dẫn và minh chứng](docs/demo-25-11/README.md).

## Chạy demo trên Windows

Cần Node.js 22 trở lên, npm và Docker Desktop với Linux engine. Tạo `.env` và `backend/.env` từ các file mẫu. Dùng mật khẩu riêng cho MySQL root, tài khoản ứng dụng và tài khoản demo. Xem cách cấu hình và vận hành trong [runbook](docs/final-demo/RUNBOOK.md).

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-demo.ps1
```

Chỉ thêm `-Seed` khi khởi tạo một database demo mới cần dữ liệu mẫu V5.

- Landing Page tại [localhost:3000](http://127.0.0.1:3000/).
- Web Admin và người thuê tại [localhost:3000/quan-ly](http://127.0.0.1:3000/quan-ly).
- API health tại [localhost:3001/api/health](http://127.0.0.1:3001/api/health).
- Swagger tại [localhost:3001/swagger](http://127.0.0.1:3001/swagger).

| Vai trò | Email mẫu |
|---|---|
| Chủ khu A | owner.a@rentflow.test |
| Chủ khu B | owner.b@rentflow.test |
| Nhân viên khu A | staff.a@rentflow.test |
| Kế toán khu A | accountant.a@rentflow.test |
| Người thuê có hợp đồng mẫu | renter.a@rentflow.test |
| Người thuê ngoài phạm vi | renter.b@rentflow.test |

Mật khẩu của tài khoản mẫu do người chạy đặt trong `DEMO_PASSWORD` tại `backend/.env`. Nếu dùng chung máy demo, chuyển mật khẩu qua kênh riêng.

## Điều hành và đối chiếu hóa đơn

- **Tổng quan** hiển thị công nợ, phòng trống, hóa đơn quá hạn, khoản chờ xác nhận và hợp đồng sắp hết hạn trong 30 ngày theo giờ Việt Nam. Chọn một mục để mở đúng hóa đơn hoặc hợp đồng.
- **Hóa đơn & thanh toán** hiển thị tổng tiền, số đã thu, số còn nợ và trạng thái. Chủ trọ hoặc kế toán trong phạm vi khu có thể xem hóa đơn đã hủy. Hóa đơn đã hủy được giữ lại để đối chiếu và không tính vào công nợ.
- Sau khi hủy hóa đơn chưa có khoản thu đang chờ hoặc đã xác nhận, người có quyền có thể điều chỉnh chỉ số điện nước kèm lý do rồi phát hành hóa đơn mới. **In / Lưu PDF** xuất riêng hóa đơn được chọn.

[Xem ảnh giao diện và kết quả kiểm thử thực tế](docs/improvements/V9_3_RUNTIME.md).

## Bàn giao

- [Tài khoản demo và quản lý truy cập V6](docs/final-demo/DEMO_ACCOUNTS.md)
- [Hướng dẫn sử dụng RentFlow](docs/final-demo/USER_GUIDE.md)
- [Checklist nghiệm thu V7](docs/final-demo/ACCEPTANCE_V7.md)
- [Trạng thái P01–P07](docs/final-demo/PRODUCT_STATUS.md)
- [Thiết kế và hướng dẫn baseline](docs/final-demo/BASELINE_README.md)
- [Kiến trúc](docs/final-demo/ARCHITECTURE.md)
- [Báo cáo kiểm thử](docs/final-demo/TEST_REPORT.md)
- [Báo cáo bảo mật](docs/final-demo/SECURITY_REPORT.md)
- [Kịch bản trình bày và phản biện](docs/final-demo/DEMO_AND_DEFENSE.md)
- [Giới hạn và checklist bản phát hành](docs/final-demo/RELEASE_CHECKLIST.md)

## Production và Google Play

- [Trạng thái phát hành](docs/production/RELEASE_STATUS.md)
- [Triển khai VPS](docs/production/DEPLOYMENT_GUIDE.md)
- [Android Release](docs/production/ANDROID_RELEASE.md)
- [Google Play checklist](docs/production/GOOGLE_PLAY_CHECKLIST.md)

## RentFlow V10 demo ba quyền

Bản demo V10 bổ sung một trang đăng nhập chung và các cổng USER, ADMIN, MANAGER. Để chạy trên Windows bằng Docker Desktop, xem [hướng dẫn demo V10](docs/DEMO_GUIDE.md), rồi chạy `powershell -ExecutionPolicy Bypass -File .\\RUN-RENTFLOW.ps1`. Cấu hình dùng database và volume riêng cho `rentflow-v10-phung-demo`.

Tài khoản đã được xác minh qua API có tại [docs/DEMO_ACCOUNTS.md](docs/DEMO_ACCOUNTS.md). Kết quả kiểm tra chi tiết ở [docs/TEST_REPORT_V10.md](docs/TEST_REPORT_V10.md). Kiểm tra quyền ở [docs/RBAC_MATRIX.md](docs/RBAC_MATRIX.md).

## Demo phân quyền với 15 tài khoản

Xem [tài khoản, sáu cổng và hướng dẫn kiểm thử](docs/RBAC_ALL_ACCOUNTS.md) để chạy bản V10 mở rộng.
