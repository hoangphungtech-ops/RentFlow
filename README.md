# RentFlow
RentFlow – Hệ thống quản lý vận hành và minh bạch quy trình thuê trọ
# RentFlow

RentFlow là hệ thống quản lý vận hành thuê trọ, giúp chủ trọ và người thuê quản lý phòng, hợp đồng, thanh toán, chi phí và thông tin thuê trọ một cách minh bạch, hiệu quả và dễ theo dõi.

## Mục tiêu

- Quản lý phòng trọ, căn hộ, khu trọ và tài sản liên quan
- Tạo và theo dõi hợp đồng thuê
- Quản lý người thuê, cọc, tiền thuê và thanh toán
- Theo dõi chi phí vận hành, bảo trì và tiện ích
- Cung cấp dashboard báo cáo doanh thu, nợ, tồn kho và tỷ lệ lấp đầy
- Tăng minh bạch dữ liệu cho cả chủ trọ và người thuê

## Tính năng chính

### 1. Quản lý bất động sản
- Quản lý tòa nhà, khu trọ, phòng trọ
- Thông tin phòng: diện tích, giá thuê, tiện ích, trạng thái
- Quản lý hình ảnh, vị trí, mô tả

### 2. Quản lý người thuê
- Hồ sơ người thuê, CCCD, thông tin liên hệ
- Gắn người thuê vào phòng
- Theo dõi lịch sử thuê, trạng thái cư trú

### 3. Quản lý hợp đồng
- Tạo hợp đồng thuê
- Quản lý thời hạn, tiền cọc, phụ thu, hợp đồng gia hạn
- Cảnh báo hợp đồng sắp hết hạn

### 4. Quản lý thanh toán
- Tạo hóa đơn hàng tháng
- Theo dõi trạng thái thanh toán
- Nhắc nợ, theo dõi nợ quá hạn
- Hỗ trợ thanh toán trực tuyến nếu tích hợp

### 5. Quản lý chi phí vận hành
- Chi phí điện, nước, Internet, vệ sinh, bảo trì
- Phân bổ chi phí theo phòng/khu trọ
- Báo cáo chi phí theo thời gian

### 6. Bảo trì và tiện ích
- Quản lý thiết bị trong phòng
- Tạo yêu cầu sửa chữa
- Theo dõi tiến độ và chi phí bảo trì

### 7. Báo cáo và dashboard
- Doanh thu theo tháng
- Tỷ lệ phòng trống / đã thuê
- Tình trạng nợ
- Tổng chi phí và lợi nhuận

### 8. Phân quyền và thông báo
- Vai trò: Admin, Quản lý, Kế toán, Nhân viên, Người thuê
- Thông báo nhắc nợ, hợp đồng, bảo trì, thanh toán
- Nhật ký hoạt động (audit log)

---

## Công nghệ sử dụng

### Backend
- Node.js
- NestJS
- TypeScript
- PostgreSQL
- Redis
- Prisma ORM

### Frontend Admin
- Next.js
- React
- TypeScript
- Tailwind CSS

### Frontend Người thuê
- Next.js hoặc React Native / Flutter (tùy triển khai)

### DevOps
- Docker
- GitHub Actions
- Nginx
- MinIO / AWS S3 cho lưu trữ file

---

## Kiến trúc hệ thống

```text
Client (Admin / Tenant / Mobile)
        |
        v
API Gateway / Backend (NestJS)
        |
   +----+----------------------+
   |                         |
   v                         v
PostgreSQL               Redis
   |                         |
   v                         v
File Storage             Background Jobs
   |
   v
Notifications / Email / SMS / Payment Integration
```

---

## Cấu trúc thư mục dự án

```text
rentflow/
├── apps/
│   ├── admin/
│   │   ├── src/
│   │   ├── public/
│   │   ├── package.json
│   │   └── README.md
│   ├── tenant/
│   │   ├── src/
│   │   └── package.json
│   └── mobile/
│       ├── app/
│       └── package.json
│
├── services/
│   ├── api/
│   │   ├── src/
│   │   ├── prisma/
│   │   ├── test/
│   │   ├── package.json
│   │   └── README.md
│   ├── worker/
│   └── notifier/
│
├── packages/
│   ├── ui/
│   ├── shared-types/
│   ├── utils/
│   └── eslint-config/
│
├── infra/
│   ├── docker/
│   ├── k8s/
│   └── nginx/
│
├── docs/
│   ├── architecture/
│   ├── requirements/
│   └── deployment/
│
├── scripts/
├── .env.example
├── .gitignore
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
├── README.md
├── LICENSE
└── tsconfig.json
```

---

## Yêu cầu môi trường

- Node.js >= 18
- pnpm >= 8 hoặc npm/yarn
- PostgreSQL >= 14
- Redis >= 7
- Docker (nếu dùng môi trường local)

---

## Cài đặt

### 1. Clone repository

```bash
git clone https://github.com/your-org/rentflow.git
cd rentflow
```

### 2. Cài đặt dependencies

```bash
pnpm install
```

### 3. Cấu hình môi trường

Tạo file `.env` hoặc copy từ `.env.example`:

```bash
cp .env.example .env
```

Ví dụ cấu hình:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/rentflow"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="your-secret-key"
PORT=3000
```

### 4. Khởi chạy database

```bash
pnpm prisma migrate dev
pnpm prisma db seed
```

### 5. Chạy service API

```bash
cd services/api
pnpm dev
```

### 6. Chạy admin

```bash
cd apps/admin
pnpm dev
```

### 7. Chạy tenant portal

```bash
cd apps/tenant
pnpm dev
```

---

## Chạy bằng Docker

```bash
docker-compose -f infra/docker/docker-compose.yml up -d
```

---

## Scripts hữu ích

```bash
pnpm lint
pnpm build
pnpm test
pnpm prisma generate
pnpm prisma migrate dev
```

---

## Các module nghiệp vụ chính

### Users
- Quản lý người dùng
- Phân quyền theo role
- Đăng nhập, refresh token

### Properties
- Tòa nhà, khu trọ, phòng
- Thông tin tiện ích và trạng thái

### Tenants
- Hồ sơ người thuê
- Quản lý thành viên trong phòng

### Contracts
- Hợp đồng thuê
- Cập nhật, gia hạn, kết thúc hợp đồng

### Invoices
- Hóa đơn phòng
- Hóa đơn tiện ích
- Trạng thái thanh toán

### Payments
- Xác nhận thanh toán
- Lịch sử giao dịch
- Cảnh báo nợ

### Expenses
- Chi phí phát sinh
- Theo dõi nhà cung cấp và hóa đơn

### Maintenance
- Yêu cầu bảo trì
- Phân công và xử lý

### Reports
- Báo cáo doanh thu
- Báo cáo chi phí
- Dashboard tổng quan

---

## Quy trình nghiệp vụ gợi ý

### Cho thuê phòng
1. Tạo phòng / khu trọ
2. Cập nhật trạng thái phòng
3. Tạo hồ sơ người thuê
4. Tạo hợp đồng thuê
5. Sinh hóa đơn đầu tiên
6. Gửi nhắc thanh toán

### Thanh toán
1. Hệ thống sinh hóa đơn theo định kỳ
2. Gửi email/SMS/notification
3. Người thuê thanh toán
4. Xác nhận thanh toán
5. Cập nhật báo cáo nợ và doanh thu

### Bảo trì
1. Người thuê hoặc quản lý tạo yêu cầu bảo trì
2. Gán nhân viên xử lý
3. Theo dõi tiến độ
4. Cập nhật chi phí
5. Đóng yêu cầu

---

## Bảo mật

- Mã hóa mật khẩu bằng bcrypt / hash phù hợp
- JWT với refresh token
- RBAC phân quyền theo vai trò
- Kiểm tra input và validation
- Audit log cho thao tác quan trọng
- Rate limiting và bảo vệ API

---

## Roadmap đề xuất

### MVP
- Quản lý phòng và trạng thái
- Người thuê và hợp đồng
- Hóa đơn và thanh toán
- Dashboard báo cáo cơ bản
- Gửi nhắc nợ

### Giai đoạn 2
- Quản lý chi phí
- Hệ thống bảo trì
- Portal người thuê
- Xuất PDF/Excel
- Tích hợp thanh toán online

### Giai đoạn 3
- Mobile app
- Thông báo qua Zalo/SMS/Email
- Tích hợp AI báo cáo, dự đoán nợ
- Multi-property / multi-tenant management

---

## Đóng góp

Mọi đóng góp đều được hoan nghênh. Vui lòng:
1. Fork repository
2. Tạo feature branch
3. Commit thay đổi
4. Tạo pull request mô tả rõ ràng

---

## Giấy phép

Dự án này được cấp phép theo [MIT License](LICENSE).

---

## Liên hệ

- Project: RentFlow
- Email: hello@rentflow.example
- GitHub: https://github.com/your-org/rentflow

---

## Tóm tắt

RentFlow là giải pháp quản lý nhà trọ hiện đại, giúp tối ưu quy trình vận hành, giảm sai sót và nâng cao tính minh bạch cho cả chủ trọ và người thuê. Với kiến trúc modular, dễ mở rộng và phù hợp với nhiều mô hình kinh doanh thuê trọ, ứng dụng này là nền tảng tốt cho việc xây dựng hệ thống quản lý bất động sản chuyên nghiệp.
