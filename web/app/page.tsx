import Image from 'next/image'
import Link from 'next/link'
import ledger from '../public/so-doi-chieu-r101.png'
import { Trial } from './trial'

export default function Home() {
  return <>
    <header className="mast"><Link href="/" className="brand">RentFlow</Link><Link className="button ghost" href="/quan-ly">Đăng nhập</Link></header>
    <main className="landing">
      <section className="hero"><div>
        <p className="eyebrow">QUẢN LÝ NHÀ TRỌ</p>
        <h1>Quản lý phòng trọ, rõ từng khoản.</h1>
        <p className="lede">Theo dõi phòng, hợp đồng, điện nước và công nợ. Người thuê có thể mở điện thoại để đối chiếu hóa đơn và tiền cọc.</p>
        <a className="button" href="#dung-thu">Đăng ký dùng thử</a>
      </div><aside className="hero-aside"><h2>Sổ đối chiếu thuê trọ</h2>
        <ul><li>Chỉ số và đơn giá theo từng kỳ</li><li>Thanh toán chờ và đã xác nhận</li><li>Căn cứ khấu trừ và tiền hoàn cọc</li></ul>
      </aside></section>
      <section className="tiles">
        <article><h2>Phòng & hợp đồng</h2><p>Xem tình trạng từng phòng, người đang ở và biên bản bàn giao.</p></article>
        <article><h2>Hóa đơn & công nợ</h2><p>Phát hành hóa đơn từ chỉ số điện nước và theo dõi số tiền còn phải thu.</p></article>
        <article><h2>Trả phòng & tiền cọc</h2><p>Đối chiếu tiền thực nhận, chi phí khấu trừ, bù nợ và số tiền hoàn.</p></article>
      </section>
      <section className="product-preview">
        <h2>Hóa đơn mẫu phòng R101</h2>
        <Image src={ledger} alt="Sổ đối chiếu RentFlow hiển thị công nợ, cách tính điện nước và lịch sử xác nhận thanh toán của hóa đơn mẫu R101" sizes="(max-width: 768px) 100vw, 960px" />
      </section>
      <section id="dung-thu"><Trial /></section>
    </main>
    <footer className="mast"><strong>RentFlow</strong><Link href="/quyen-rieng-tu">Quyền riêng tư</Link><a href="mailto:hoangphung.tech@gmail.com">Liên hệ nhóm RentFlow</a></footer>
  </>
}
