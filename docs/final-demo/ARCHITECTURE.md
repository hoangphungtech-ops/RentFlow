# Kiến trúc

```mermaid
flowchart LR
  A[Chủ trọ / nhân viên / kế toán] --> W[Next.js]
  T[Người thuê trên trình duyệt điện thoại] --> W
  L[Khách xem Landing Page] --> W
  W -->|REST /api| N[NestJS]
  N --> S[Session guard và quyền theo khu / hợp đồng]
  S --> M[Nghiệp vụ thuê phòng và tài chính]
  M -->|Prisma| D[(MySQL 8)]
```

```mermaid
erDiagram
    USER ||--o{ SESSION : opens
    USER ||--o{ PROPERTY : owns
    USER ||--o{ PROPERTY_ACCESS : receives
    PROPERTY ||--o{ PROPERTY_ACCESS : scopes
    PROPERTY ||--o{ ROOM : contains
    PROPERTY ||--o{ TENANT : registers
    PROPERTY ||--o{ UTILITY_RATE : prices
    ROOM ||--o{ METER_READING : records
    ROOM ||--o{ LEASE : has
    LEASE ||--o{ LEASE_TENANT : includes
    TENANT ||--o{ LEASE_TENANT : occupies
    LEASE ||--o{ HANDOVER : documents
    LEASE ||--o{ INVOICE : bills
    INVOICE ||--o{ INVOICE_ITEM : snapshots
    INVOICE ||--o{ PAYMENT : allocates
    LEASE ||--o| SETTLEMENT : closes
```

Nghiệp vụ dùng một backend, một MySQL. MySQL áp dụng các khóa duy nhất cho phòng, kỳ chỉ số, hóa đơn còn hiệu lực, khóa yêu cầu thanh toán và quyết toán. Kích hoạt hợp đồng, xác nhận thanh toán và chốt trả phòng dùng giao dịch Serializable.

Điện và nước tính theo chênh lệch chỉ số. Phí dịch vụ cố định theo tháng. Hóa đơn dùng đơn giá hiệu lực đầu kỳ, lưu snapshot chỉ số và đơn giá. Làm tròn từng dòng VND theo half-up và cộng bằng Decimal. Tiền cọc thực nhận trừ khấu trừ và bù nợ, sau đó khóa số liệu quyết toán. Khoản bù nợ ghi thành một giao dịch đã xác nhận có phương thức bù cọc.
