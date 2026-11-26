'use client'

import { useEffect, useState } from 'react'
import { api, vnd } from '../shared'

type Metrics = {
  months: { period: string; total: string }[]
  openRepairs: number
  recent: {
    id: string; status: string; amount: string; confirmedAt: string | null; createdAt: string
    invoice: { lease: { room: { roomCode: string } } }
  }[]
}

export function OwnerOperations({ occupied, total, available, unpaid, balance, onOpen }: {
  occupied: number; total: number; available: number; unpaid: number; balance: number
  onOpen: (tab: string, status?: string, debtOnly?: boolean) => void
}) {
  const [metrics, setMetrics] = useState<Metrics>()
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    void api<Metrics>('v10/owner/operations').then(data => { if (active) setMetrics(data) })
      .catch(failure => { if (active) setError(failure.message) })
    return () => { active = false }
  }, [])
  const latest = metrics?.months.at(-1)
  const peak = Math.max(1, ...(metrics?.months.map(row => Number(row.total)) ?? []))
  return <>
    <p className="rental-subtitle">Theo dõi thu chi, tình trạng phòng và việc cần xử lý.</p>
    {error && <p role="alert">{error}</p>}
    <div className="tiles owner-metrics">
      <article><h2>Doanh thu tháng</h2><strong>{latest ? vnd(latest.total) : '—'}</strong>
        <button className="ghost metric-link" onClick={() => onOpen('Hóa đơn & thanh toán')}>Xem khoản thu</button></article>
      <article><h2>Tỷ lệ lấp đầy</h2><strong>{occupied}/{total} phòng</strong>
        <p>{available} phòng còn trống</p><button className="ghost metric-link" onClick={() => onOpen('Khu trọ & phòng', 'AVAILABLE')}>Xem phòng trống</button></article>
      <article><h2>Hóa đơn chưa thanh toán</h2><strong>{unpaid}</strong>
        <p>{vnd(balance)} còn phải thu</p><button className="ghost metric-link" onClick={() => onOpen('Hóa đơn & thanh toán', '', true)}>Xem hóa đơn còn nợ</button></article>
      <article><h2>Sự cố cần xử lý</h2><strong>{metrics?.openRepairs ?? '—'}</strong>
        <button className="ghost metric-link" onClick={() => onOpen('Bảo trì')}>Xem bảo trì</button></article>
    </div>
    <div className="owner-panels">
      <section className="card"><h2>Doanh thu sáu tháng</h2>
        <p className="muted">Các khoản thu đã xác nhận · VNĐ</p>
        {metrics && <ol className="owner-bars">{metrics.months.map(row => <li key={row.period}>
          <small>{new Intl.NumberFormat('vi-VN', { notation: 'compact' }).format(Number(row.total))}</small>
          <span aria-label={vnd(row.total)} className="owner-bar" style={{ height: Math.max(0, Math.round(Number(row.total) / peak * 92)) + 'px' }} />
          <small>Thg {Number(row.period.slice(-2))}</small>
        </li>)}</ol>}
      </section>
      <section className="card"><h2>Hoạt động gần đây</h2>
        {!metrics && !error && <p role="status">Đang tải hoạt động…</p>}
        {metrics && metrics.recent.length === 0 && <p>Chưa có giao dịch.</p>}
        <ul className="owner-activity">{metrics?.recent.map(row => <li key={row.id}>
          <strong>{row.status === 'CONFIRMED' ? 'Đã xác nhận thực nhận' : 'Khoản thu chờ xác nhận'}</strong>
          <small>{row.invoice.lease.room.roomCode} · {vnd(row.amount)} · {new Date(row.confirmedAt ?? row.createdAt).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</small>
        </li>)}</ul>
      </section>
    </div>
  </>
}
