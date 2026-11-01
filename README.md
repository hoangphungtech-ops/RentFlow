
# RentFlow

Đồ án RentFlow: hệ thống quản lý khu trọ (khu trọ, phòng, hợp đồng, hóa đơn, thanh toán).
Repo này hiện có phần nền tảng: môi trường Docker (MySQL, Redis), cơ sở dữ liệu cho tài khoản, phân quyền theo khu trọ và nhật ký kiểm toán (Prisma), cùng các sơ đồ thiết kế.

## Công nghệ

- Frontend: Next.js 15
- Backend: NestJS + Swagger (kiến trúc Modular Monolith)
- ORM: Prisma 7
- Cơ sở dữ liệu: MySQL 8.0, Redis 7 (chạy bằng Docker)

## Yêu cầu

- Git
- Docker Desktop (trên Windows cần bật WSL 2)
- Node.js 22 hoặc 24

## Chạy môi trường phát triển

1. Clone repo và vào thư mục dự án.
2. Tạo file môi trường cho Docker (PowerShell):

   ```powershell
   copy .env.example .env
   ```

   Mở `.env` và đổi các mật khẩu `change_me`. Không commit file `.env`.
3. Khởi động MySQL và Redis:

   ```powershell
   docker compose up -d
   docker compose ps
   ```

   Hai container `rentflow-mysql` và `rentflow-redis` phải ở trạng thái **healthy**. Lần đầu có thể mất 1 đến 2 phút để tải image.
4. Cấp quyền cho `prisma migrate dev` (làm một lần, nhập `MYSQL_ROOT_PASSWORD` khi được hỏi):

   ```powershell
   docker exec -it rentflow-mysql mysql -u root -p -e "GRANT ALL PRIVILEGES ON *.* TO 'rentflow'@'%'; FLUSH PRIVILEGES;"
   ```

   Nếu sau này chạy `docker compose down -v` thì quyền này mất, cần chạy lại.
5. Cài thư viện và tạo bảng cho backend:

   ```powershell
   cd backend
   npm install
   copy .env.example .env
   ```

   Mở `backend\.env`, điền mật khẩu **trùng với `MYSQL_PASSWORD`** trong `.env` ở thư mục gốc. MySQL trong Docker được mở ở cổng **3307** trên máy (không dùng 3306 để tránh trùng với MySQL cài sẵn). Sau đó:

   ```powershell
   npx prisma migrate dev
   npx prisma generate
   ```

### Dừng và bật lại

```powershell
docker compose stop     # tắt tạm, dữ liệu còn
docker compose start    # bật lại
docker compose down     # gỡ container, dữ liệu vẫn còn (nằm trong volume)
```

Chỉ dùng `docker compose down -v` khi muốn **xóa sạch dữ liệu**.

## Cấu trúc thư mục

```
rentflow/
├─ docker-compose.yml
├─ .env.example
├─ backend/
│  ├─ prisma/            schema.prisma và các migration
│  └─ .env.example
└─ docs/
   ├─ diagrams/          file draw.io gốc
   └─ images/            ảnh sơ đồ (kiến trúc, use case, class)
```

## Cơ sở dữ liệu (phần tài khoản và phân quyền)

Bốn bảng: `User`, `Role`, `UserPropertyAccess`, `AuditLog`. Mọi cột id và khóa ngoại dùng `CHAR(36)` (UUID).

- `User.email` và `Role.name` là duy nhất.
- Cặp `(userId, propertyId)` trong `UserPropertyAccess` là duy nhất.
- `AuditLog.actorId` trỏ tới `User.id` với `ON DELETE RESTRICT`: không xóa được tài khoản đã có nhật ký (ngưng tài khoản bằng cột `status`).

## Lỗi thường gặp

- **docker-desktop ở trạng thái Stopped hoặc `docker run` bị treo:** đợi Docker Desktop hiện "Engine running", hoặc khởi động lại Docker Desktop và chạy `wsl --shutdown`.
- **Cổng 3306 bị chiếm (XAMPP hoặc MySQL cài sẵn):** dự án dùng cổng 3307. Kiểm tra bằng `netstat -ano | findstr :3307`.
- **PowerShell báo "running scripts is disabled" khi chạy `npm`:** chạy một lần `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`.
- **Prisma báo thiếu quyền tạo shadow database:** chạy lại lệnh `GRANT` ở bước 4.
- **Prisma báo lỗi xác thực (Access denied):** mật khẩu trong `backend\.env` khác mật khẩu MySQL đang giữ. MySQL chỉ đọc mật khẩu ở lần khởi tạo đầu tiên; nếu đã đổi mật khẩu, chạy `docker compose down -v` rồi `docker compose up -d` (mất dữ liệu thử).
- **Không có lệnh `prisma migrate`:** bạn đã cài nhầm Prisma 8 tiền phát hành. Luôn cài bằng `npm install prisma@7 --save-dev`.

## Tài liệu

- Sơ đồ thiết kế: thư mục `docs/`.
- Báo cáo trên Confluence: (điền đường dẫn).