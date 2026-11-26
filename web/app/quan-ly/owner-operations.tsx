'use client'

import { useEffect, useState } from 'react'
import { api, vnd } from '../shared'

type Metrics = {
    year: number
  currentMonth: number
  yearlyRevenue: string
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
  const [selectedYear, setSelectedYear] = useState('')
  const [history, setHistory] = useState<Metrics>()
  const [historyError, setHistoryError] = useState('')
  useEffect(() => {
    let active = true
    void api<Metrics>('v10/owner/operations').then(data => { if (active) setMetrics(data) })
      .catch(failure => { if (active) setError(failure.message) })
    return () => { active = false }
  }, [])
  useEffect(() => {
    if (!metrics || !selectedYear || Number(selectedYear) === metrics.year) return
    let active = true
    void api<Metrics>('v10/owner/operations?year=' + encodeURIComponent(selectedYear))
      .then(data => { if (active) setHistory(data) })
      .catch(failure => { if (active) setHistoryError(failure.message) })
    return () => { active = false }
  }, [selectedYear, metrics?.year])
  const historical = !!metrics && !!selectedYear && Number(selectedYear) !== metrics.year
  const chartMetrics = historical ? (history?.year === Number(selectedYear) ? history : undefined) : metrics
  const latest = metrics?.months.find(
    row => Number(row.period.slice(-2)) === metrics.currentMonth
  )

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
      <section className="card owner-revenue-card">
        <div className="revenue-heading">
          <div><h2>Doanh thu 12 tháng</h2><small className="muted">Các khoản thu đã xác nhận · VNĐ</small></div>
          <label className="revenue-year-select">
            <select aria-label="Năm doanh thu" disabled={!metrics} value={selectedYear || String(metrics?.year ?? '')}
              onChange={event => { setHistory(undefined); setHistoryError(''); setSelectedYear(event.target.value) }}>
              {!metrics && <option value="">Đang tải</option>}
              {metrics && Array.from({ length: Math.max(1, metrics.year - 1999) }, (_, i) => metrics.year - i)
                .map(year => <option key={year} value={year}>Năm {year}</option>)}
            </select>
          </label>
        </div>
        <div className="yearly-revenue">
          <p>Tổng doanh thu năm {selectedYear || metrics?.year || '—'}</p>
          <strong>{chartMetrics ? vnd(chartMetrics.yearlyRevenue) : '—'}</strong>
        </div>
        {historical && historyError && <p role="alert">{historyError}</p>}
        {!chartMetrics && !historyError && !error && <p role="status">Đang tải doanh thu…</p>}
        {chartMetrics && <RevenueChart data={chartMetrics} currentYear={metrics?.year} />}
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


function RevenueChart({ data, currentYear }: { data: Metrics; currentYear?: number }) {
  const amounts = data.months.map(row => Number(row.total))
  const peak = Math.max(0, ...amounts)
  const rough = (peak || 4000000) / 4
  const unit = Math.pow(10, Math.floor(Math.log10(rough)))
  const step = ( [1, 2, 2.5, 5, 10].find(value => value * unit >= rough) ?? 10 ) * unit
  const max = step * 4
  const compact = new Intl.NumberFormat('vi-VN', { notation: 'compact', maximumFractionDigits: 1 })
  const left = 65, bottom = 174, top = 20, width = 640, plotHeight = bottom - top
  const spacing = width / 12
  return <>
    <div className="revenue-chart-scroll">
      <svg className="revenue-svg" viewBox="0 0 720 205" role="img" aria-label={'Biểu đồ doanh thu năm ' + data.year}>
        {[0, 1, 2, 3, 4].map(i => {
          const y = bottom - i * plotHeight / 4
          return <g key={i}>
            <text x={left - 9} y={y + 4} textAnchor="end" className="revenue-tick">{compact.format(i * step)}</text>
          </g>
        })}
        {data.months.map((row, i) => {
          const amount = Number(row.total)
          const month = Number(row.period.slice(-2))
          const x = left + (i + .5) * spacing
          const height = Math.max(2, Math.max(0, amount) / max * plotHeight)
          const current = data.year === currentYear && month === data.currentMonth
          return <g key={row.period} className="revenue-column">
            <title>{`Tháng ${month}/${data.year}: ${vnd(row.total)}`}</title>
            <rect x={x - 17} y={bottom - height} width={34} height={height} rx={Math.min(3, height / 2)} fill={current ? '#167354' : '#a6d8c5'} />
            <text x={x} y={bottom - height - 6} textAnchor="middle" className="revenue-tick">{compact.format(amount)}</text>
            <text x={x} y={bottom + 18} textAnchor="middle" className="revenue-tick">T{month}</text>
          </g>
        })}
      </svg>
    </div>
    <div className="revenue-legend"><span><i className="revenue-swatch current" />Tháng hiện tại</span><span><i className="revenue-swatch" />Các tháng khác</span></div>
  </>
}
