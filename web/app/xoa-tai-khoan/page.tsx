'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Action, api, ApiError, field } from '../shared'

type RequestStatus = { status: string; requestedAt: string; reviewedAt: string | null }

export default function DeletionPage() {
  const [signedIn, setSignedIn] = useState(false)
  const [ready, setReady] = useState(false)
  const [request, setRequest] = useState<RequestStatus | null>(null)
  const [error, setError] = useState('')
  async function refresh() {
    try {
      setRequest((await api<{ request: RequestStatus | null }>('account/deletion-request')).request)
      setSignedIn(true)
    } catch (failure) {
      if (!(failure instanceof ApiError && failure.status === 401)) setError((failure as Error).message)
    } finally { setReady(true) }
  }
  useEffect(() => { void refresh() }, [])
  return <main className="shell">
    <Link href="/quyen-rieng-tu">Quyền riêng tư</Link>
    <h1>Yêu cầu xóa tài khoản</h1>
    <p>RentFlow lưu yêu cầu để người phụ trách xác minh hồ sơ và thông báo kết quả. Các chứng từ phải lưu giữ được kiểm tra trước khi xử lý.</p>
    {!ready && <p role="status">Đang tải…</p>}
    {ready && !signedIn && <Action title="Xác minh tài khoản" fields={[field('identifier','Tên đăng nhập hoặc email'),field('password','Mật khẩu','password')]} button="Đăng nhập" submit={async data => {
      await api('login', '', data)
      await refresh()
    }} />}
    {error && <p role="alert" className="error">{error} <Link href="/quan-ly">Quản lý phiên đăng nhập</Link></p>}
    {request && <p role="status">Trạng thái · {request.status === 'PENDING' ? 'Đang chờ xem xét' : request.status}</p>}
    {signedIn && !request && <Action title="Gửi yêu cầu" fields={[field('password','Nhập lại mật khẩu','password')]} button="Gửi yêu cầu" submit={async values => {
      setRequest(await api<RequestStatus>('account/deletion-request', '', values))
      setError('')
    }} />}
  </main>
}
