'use client'

import { useEffect, useState } from 'react'
import { Action, api, field, select } from '../shared'
import type { Overview } from './page'

type Account = Overview['actor'] & { id: string; lockedAt: string | null; active: boolean; emailVerifiedAt: string | null; access: { propertyId: string }[] }
type Invitation = { code: string; expiresAt: string }
const roles: [string, string][] = [['STAFF','Nhân viên'], ['ACCOUNTANT','Kế toán'], ['RENTER','Người thuê']]

export function AccountSettings({ actor, properties, tenants, signedOut }: {
  actor: Overview['actor']; properties: Overview['properties']; tenants: Overview['tenants']; signedOut: (message?: string) => void
}) {
  const [accounts, setAccounts] = useState<Account[]>()
  const [invitation, setInvitation] = useState<Invitation>()
  const [error, setError] = useState('')
  async function refresh() {
    try { setAccounts(await api<Account[]>('accounts')); setError('') }
    catch (failure) { setError((failure as Error).message) }
  }
  useEffect(() => { if (actor.role === 'OWNER') void refresh() }, [actor.role])
  const property = select('propertyId', 'Khu trọ', properties.map(row => [row.id, row.name]))
  return <>
    <section className="card">
      <h2>Hồ sơ cá nhân</h2>
      <p>{actor.fullName} · {actor.email}{actor.username ? ' · ' + actor.username : ''}</p>
      <h2>Bảo mật</h2>
      <Action title="Đổi mật khẩu" fields={[
        field('currentPassword','Mật khẩu hiện tại','password'), field('newPassword','Mật khẩu mới (tối thiểu 12 ký tự)','password'),
        field('confirmPassword','Nhập lại mật khẩu mới','password'),
      ]} button="Đổi mật khẩu" submit={async data => {
        await api('account/password/change', '', data)
        signedOut('Đã đổi mật khẩu. Vui lòng đăng nhập lại.')
      }} />
      <Action title="Đăng xuất thiết bị khác" button="Thu hồi phiên khác" submit={async () => {
        if (!window.confirm('Đăng xuất tất cả thiết bị khác?')) throw new Error('Đã hủy.')
        await api('account/sessions/revoke-others', '', {})
      }} />
    </section>
    {actor.role === 'OWNER' && <section className="card">
      <h2>Tài khoản &amp; phân quyền</h2>
      {error ? <p role="alert">{error}</p> : !accounts && <p role="status">Đang tải tài khoản…</p>}
      {accounts?.length === 0 && <p>Chưa có tài khoản do bạn quản lý.</p>}
      {properties.length > 0 ? <Action title="Tạo tài khoản" fields={[
        field('fullName','Họ tên'), field('username','Tên đăng nhập'), field('email','Email','email'),
        select('role','Vai trò',roles), property,
      ]} button="Tạo tài khoản" submit={async data => {
        const result = await api<{ invitation: Invitation }>('accounts', '', data)
        setInvitation(result.invitation)
        await refresh()
      }} /> : <p>Hãy tạo khu trọ để có thể cấp tài khoản.</p>}
      {invitation && <div className="card"><h3>Mã lời mời một lần</h3>
        <p>Gửi riêng cho người đã xác minh. Mã hết hạn lúc {new Date(invitation.expiresAt).toLocaleString('vi-VN')}.</p>
        <input aria-label="Mã lời mời" readOnly value={invitation.code} onFocus={event => event.target.select()} />
        <button className="ghost" onClick={() => setInvitation(undefined)}>Ẩn mã</button>
      </div>}
      {accounts?.map(account => <details key={account.id}>
        <summary>{account.fullName} · {roles.find(([key]) => key === account.role)?.[1]} · {account.lockedAt ? 'Đã khóa' : account.active ? 'Đang hoạt động' : 'Chờ kích hoạt'}</summary>
        <p>{account.username} · {account.email} · {account.emailVerifiedAt ? 'Email đã xác minh' : 'Email chưa xác minh'}</p>
        {account.role !== 'RENTER' && <p>Khu được cấp quyền: {account.access.map(row => properties.find(p => p.id === row.propertyId)?.name).filter(Boolean).join(', ') || 'Chưa có'}</p>}
        {account.role === 'RENTER' && tenants.length > 0 && <Action title="Liên kết hồ sơ người thuê" fields={[
          select('tenantId', 'Hồ sơ', tenants.map(tenant => [tenant.id, tenant.fullName])),
        ]} submit={async data => {
          if (!window.confirm('Cho phép tài khoản này xem hợp đồng của hồ sơ đã chọn?')) throw new Error('Đã hủy.')
          await api('accounts/' + account.id + '/link-tenant', '', data)
        }} />}
        <Action key={account.id + account.username + account.role + account.fullName + account.email} title="Cập nhật hồ sơ" fields={[
          { ...field('fullName','Họ tên'), value: account.fullName }, { ...field('username','Tên đăng nhập'), value: account.username ?? '' },
          ...(!account.active ? [{ ...field('email','Email','email'), value: account.email }] : []),
          select('role','Vai trò', account.role === 'RENTER' ? roles.filter(([key]) => key === 'RENTER') : roles.filter(([key]) => key !== 'RENTER')),
        ]} submit={async data => { await api('accounts/' + account.id + '/profile', '', data); await refresh() }} />
        <Action title="Quản lý truy cập" fields={[select('action','Thao tác', [
          account.lockedAt ? ['UNLOCK','Mở khóa tài khoản'] : ['LOCK','Khóa tài khoản'],
          ['REVOKE','Thu hồi các phiên'],
          ...(!account.active && !account.lockedAt ? [['INVITE','Cấp lại lời mời'] as [string, string]] : []),
        ])]} submit={async data => {
          if (!window.confirm('Xác nhận thao tác với ' + account.fullName + '?')) throw new Error('Đã hủy.')
          const result = await api<{ invitation?: Invitation }>('accounts/' + account.id + '/control', '', data)
          if (result.invitation) setInvitation(result.invitation)
          await refresh()
        }} />
      </details>)}
    </section>}
  </>
}
