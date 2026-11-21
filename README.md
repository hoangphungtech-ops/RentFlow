# RentFlow

RentFlow quản lý phòng trọ, người ở, hợp đồng, bàn giao, điện nước, hóa đơn, thanh toán và tiền cọc. Người thuê dùng cùng website trên điện thoại để xem Sổ đối chiếu thuê trọ.

## Chạy demo trên Windows

Cần Node.js 22 trở lên, npm và Docker Desktop với Linux engine. Tạo `.env` và `backend/.env` từ các file mẫu. Dùng mật khẩu riêng cho MySQL root, tài khoản ứng dụng và tài khoản demo. Xem cách cấu hình và vận hành trong [runbook](docs/final-demo/RUNBOOK.md).

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-demo.ps1 -Seed
```

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

## Bàn giao

- [Trạng thái P01–P07](docs/final-demo/PRODUCT_STATUS.md)
- [Kiến trúc](docs/final-demo/ARCHITECTURE.md)
- [Báo cáo kiểm thử](docs/final-demo/TEST_REPORT.md)
- [Báo cáo bảo mật](docs/final-demo/SECURITY_REPORT.md)
- [Kịch bản trình bày và phản biện](docs/final-demo/DEMO_AND_DEFENSE.md)
- [Giới hạn và checklist bản phát hành](docs/final-demo/RELEASE_CHECKLIST.md)

## Production v? Google Play

- [Tr?ng th?i ph?t h?nh](docs/production/RELEASE_STATUS.md)
- [Tri?n khai VPS](docs/production/DEPLOYMENT_GUIDE.md)
- [Android Release](docs/production/ANDROID_RELEASE.md)
- [Google Play checklist](docs/production/GOOGLE_PLAY_CHECKLIST.md)
