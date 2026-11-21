'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Action, api, field } from '../shared'

export default function RecoveryPage() {
  const [mode, setMode] = useState('request')
  const [feedback, setFeedback] = useState('')
  useEffect(() => {
    const requested = new URLSearchParams(location.search).get('mode')
    if (requested === 'activate' || requested === 'reset') setMode(requested)
  }, [])
  return <main className="shell">
    <Link href="/quan-ly">Về trang đăng nhập</Link>
    <h1>Khôi phục và kích hoạt tài khoản</h1>
    <div className="actions">{[['request','Quên mật khẩu'],['reset','Có mã khôi phục'],['activate','Có mã lời mời']].map(([key, title]) =>
      <button key={key} className="ghost" aria-pressed={mode === key} onClick={() => { setMode(key); setFeedback('') }}>{title}</button>)}</div>
    {mode === 'request' ? <Action key={mode} title="Yêu cầu khôi phục" fields={[field('email','Email','email')]} button="Gửi yêu cầu" submit={async data => {
      const result = await api<{ message: string }>('auth/forgot-password', '', data)
      setFeedback(result.message)
    }} /> : <Action key={mode} title={mode === 'activate' ? 'Kích hoạt tài khoản' : 'Đặt lại mật khẩu'} fields={[
      field('code', 'Mã một lần', 'password'), field('newPassword', 'Mật khẩu mới', 'password'),
      field('confirmPassword', 'Nhập lại mật khẩu mới', 'password'),
    ]} submit={async data => {
      await api(mode === 'activate' ? 'auth/activate' : 'auth/reset-password', '', data)
      setFeedback('Mật khẩu đã được lưu. Bạn có thể đăng nhập.')
    }} />}
    {feedback && <p role="status">{feedback}</p>}
  </main>
}
