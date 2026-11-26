# Ma trận quyền RentFlow V10

| Hành động | USER / RENTER | ADMIN | MANAGER / OWNER |
|---|---:|---:|---:|
| Xem cổng người thuê | Có | Từ chối | Từ chối |
| Tìm phòng đã duyệt và còn trống | Có | Từ chối | Từ chối |
| Gửi yêu cầu xem hoặc thuê | Có | Từ chối | Từ chối |
| Xem hợp đồng và hóa đơn của mình | Có, theo tenant scope | Từ chối | Theo khu trọ được sở hữu |
| Gửi yêu cầu bảo trì trong hợp đồng của mình | Có | Từ chối | Từ chối |
| Xem tất cả tài khoản và duyệt tin | Từ chối | Có | Từ chối |
| Duyệt đơn đăng ký chủ trọ | Từ chối | Có | Từ chối |
| Quản lý phòng, yêu cầu thuê, bảo trì trong khu trọ | Từ chối | Từ chối | Có, theo property scope |
| Chốt chỉ số kèm ảnh công tơ | Từ chối | Từ chối | Chủ sở hữu hoặc nhân viên được cấp quyền |

API kiểm tra session và role ở backend. Phạm vi khu trọ của OWNER được giới hạn bằng ownerId. Các thao tác chốt chỉ số, duyệt tin, duyệt yêu cầu và cập nhật bảo trì ghi audit log khi thay đổi dữ liệu.
