'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Action, api, ApiError, field } from '../shared'

export default function Login() {
  const router = useRouter()
  const [registering, setRegistering] = useState(false)
  return <main className="portal-login">
    <section className="portal-intro">
      <span className="portal-logo">RF</span>
      <p>RENTFLOW</p>
      <h1>Quản lý nhà trọ minh bạch</h1>
      <p>Tìm phòng, đối chiếu hóa đơn và vận hành khu trọ trong cùng một hệ thống.</p>
    </section>
    <section className="portal-login-form">
      <h2>{registering ? 'Tạo tài khoản người thuê' : 'Chào mừng trở lại'}</h2>
      <Action key={String(registering)} title={registering ? 'Đăng ký RentFlow' : 'Đăng nhập RentFlow'} button={registering ? 'Tạo tài khoản' : 'Đăng nhập'}
        fields={registering ? [field('fullName', 'Họ và tên'), field('email', 'Email', 'email'), field('password', 'Mật khẩu từ 12 ký tự', 'password')] : [field('identifier', 'Email hoặc tên đăng nhập'), field('password', 'Mật khẩu', 'password')]}
        submit={async data => {
          if (registering) await api('auth/register', '', data)
          await api('login', '', registering ? { identifier: data.email, password: data.password } : data)
          try {
            const { portal } = await api<{portal: string}>('v10/me')
            router.replace('/' + portal + '/dashboard')
          } catch (error) {
            if (error instanceof ApiError && error.status === 401) {
              throw new Error('Máy chủ chưa nhận được phiên đăng nhập. Hãy thử lại trong tab RentFlow và kiểm tra trình duyệt cho phép cookie của trang.')
            }
            throw error
          }
        }} />
      <div className="portal-links"><button className="ghost" onClick={() => setRegistering(!registering)}>{registering ? 'Quay lại đăng nhập' : 'Đăng ký người thuê'}</button><Link href="/khoi-phuc">Quên mật khẩu?</Link></div>
    </section>
  </main>
}
