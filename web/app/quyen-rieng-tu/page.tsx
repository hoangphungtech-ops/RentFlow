import Link from 'next/link'

export default function Privacy() {
  return <main className="shell">
    <Link href="/" className="brand">RentFlow</Link>
    <h1>Quyền riêng tư của RentFlow</h1>
    <p>RentFlow xử lý dữ liệu để quản lý việc thuê phòng và để người thuê đối chiếu các khoản phải trả.</p>
    <h2>Dữ liệu được sử dụng</h2>
    <p>Tài khoản gồm tên, email và mật khẩu được băm. Chủ trọ có thể ghi thông tin liên hệ, hợp đồng, bàn giao, điện nước, hóa đơn, thanh toán và cọc. Form dùng thử nhận thông tin liên hệ do bạn nhập.</p>
    <h2>Ai được xem dữ liệu</h2>
    <p>Chủ trọ và người được cấp quyền xử lý dữ liệu theo khu trọ. Người thuê xem các hợp đồng mà mình tham gia. Hệ thống sử dụng đơn vị vận hành hạ tầng nếu được triển khai trên dịch vụ lưu trữ.</p>
    <h2>Lưu giữ và yêu cầu xóa</h2>
    <p>Bạn có thể gửi yêu cầu đã xác minh bằng mật khẩu. Đơn vị vận hành cần kiểm tra hồ sơ và nghĩa vụ lưu giữ chứng từ trước khi xử lý. Hợp đồng và chứng từ có thể phải giữ lại khi có căn cứ áp dụng.</p>
    <p>Bản này mô tả chức năng hiện tại. Thời hạn lưu giữ, đơn vị vận hành và quy trình phản hồi cần được xác nhận trước khi cung cấp dịch vụ công khai.</p>
    <p><Link href="/xoa-tai-khoan">Yêu cầu xóa tài khoản</Link> · <a href="mailto:hoangphung.tech@gmail.com">Liên hệ dự án</a></p>
  </main>
}
