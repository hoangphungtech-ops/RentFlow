'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Action, api, field } from '../shared'

type RequestStatus = { status: string; requestedAt: string; reviewedAt: string | null }

export default function DeletionPage() {
  const [token, setToken] = useState('')
  const [ready, setReady] = useState(false)
  const [request, setRequest] = useState<RequestStatus | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    const saved = sessionStorage.getItem('rentflow-session') ?? ''
    setToken(saved)
    setReady(true)
    if (saved) api<{ request: RequestStatus | null }>('account/deletion-request', saved).then(result => setRequest(result.request)).catch(failure => setError(failure.message))
  }, [])
  return <main className="shell">
    <Link href="/quyen-rieng-tu">Quyền riêng tư</Link>
    <h1>Yêu cầu xóa tài khoản</h1>
    <p>RentFlow lưu yêu cầu để người phụ trách xác minh hồ sơ và thông báo kết quả. Các chứng từ phải lưu giữ được kiểm tra trước khi xử lý.</p>
    {!ready && <p role="status">Đang tải…</p>}
    {ready && !token && <Action title="Xác minh tài khoản" fields={[field('email','Email','email'),field('password','Mật khẩu','password')]} button="Đăng nhập" submit={async data => {
      const result = await api<{ token: string }>('login','',data)
      sessionStorage.setItem('rentflow-session', result.token)
      setToken(result.token)
      api<{ request: RequestStatus | null }>('account/deletion-request', result.token).then(result => setRequest(result.request)).catch(failure => setError(failure.message))
    }} />}
    {error && <p role="alert" className="error">{error} <Link href="/quan-ly">Quản lý phiên đăng nhập</Link></p>}
    {request && <p role="status">Trạng thái · {request.status === 'PENDING' ? 'Đang chờ xem xét' : request.status}</p>}
    {token && !request && <Action title="Gửi yêu cầu" fields={[field('password','Nhập lại mật khẩu','password')]} button="Gửi yêu cầu" submit={async values => {
      setRequest(await api<RequestStatus>('account/deletion-request', token, values))
      setError('')
    }} />}
  </main>
}
