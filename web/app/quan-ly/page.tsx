'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { Action, api, field, select, vnd } from '../shared'
import { AdminForms } from './forms'

type Person = { id: string; fullName: string; propertyId: string }
type Room = { id: string; roomCode: string; status: string; baseRentPrice: string; maxOccupants: number }
type Lease = { id: string; roomId: string; room: { roomCode: string; propertyId: string }; rentAmount: string; startDate: string; endDate: string; status: string; depositAgreed: string; depositReceived: string; tenants: { representative: boolean; tenant: { fullName: string } }[] }
type Payment = { id: string; method: string; status: string; amount: string }
type Item = { id: string; description: string; meterStart: string | null; meterEnd: string | null; quantity: string; snapshotUnitPrice: string; lineTotal: string }
type Invoice = { id: string; leaseId: string; billingPeriod: string; dueDate: string; totalAmount: string; paidAmount: string; remainingAmount: string; status: string }
type Ledger = Lease & {
  invoices: (Invoice & { items: Item[]; payments: Payment[] })[]
  handovers: { kind: string; date: string; condition: string; inventory: string; electric: string; water: string; notes: string | null; confirmedAt: string | null }[]
  settlement: { received: string; deduction: string; debtOffset: string; refund: string; reason: string; invoiceId?: string } | null
}
export type Overview = {
  actor: { fullName: string; role: string }; tenants: Person[]; leases: Lease[]; invoices: Invoice[];
  properties: { id: string; name: string; address: string; rooms: Room[]; utilityRates: { id: string; serviceName: string; unitPrice: string; unit: string; effectiveFrom: string }[] }[];
  notifications: { id: string; message: string }[]
}
export type Write = (path: string, body: Record<string, unknown>) => Promise<void>
const date = (value: string) => new Date(value).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
const labels: Record<string, string> = { AVAILABLE: 'Trống', OCCUPIED: 'Đang thuê', MAINTENANCE: 'Bảo trì', ACTIVE: 'Đang thuê', DRAFT: 'Nháp', EXPIRED: 'Hết hạn', TERMINATED: 'Đã trả phòng', CASH: 'Tiền mặt', TRANSFER: 'Chuyển khoản', DEPOSIT: 'Bù cọc', PENDING: 'Chờ xác nhận', CONFIRMED: 'Đã xác nhận', REVERSED: 'Đã đảo' }

export default function Dashboard() {
  const [token, setToken] = useState('')
  const [overview, setOverview] = useState<Overview>()
  const [ledger, setLedger] = useState<Ledger>()
  const [current, setCurrent] = useState('')
  const [tab, setTab] = useState('Tổng quan')
  const [ready, setReady] = useState(false)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const paymentRequest = useRef(new Map<string, string>())
  useEffect(() => { setToken(sessionStorage.getItem('rentflow-session') ?? ''); setReady(true) }, [])
  useEffect(() => {
    if (!token) return
    setBusy(true)
    api<Overview>('overview', token).then(setOverview).catch(error => setError(error.message)).finally(() => setBusy(false))
  }, [token])
  async function open(id: string) {
    setLedger(undefined); setCurrent(id); setBusy(true); setError('')
    try { setLedger(await api<Ledger>('leases/' + id + '/ledger', token)) }
    catch (error) { setError((error as Error).message) }
    finally { setBusy(false) }
  }
  const write: Write = async (path, values) => {
    await api(path, token, values)
    try {
      setOverview(await api<Overview>('overview', token))
      if (current) await open(current)
    } catch { setError('Đã lưu. Hãy tải lại để xem dữ liệu mới.') }
  }
  const role = overview?.actor.role
  const renter = role === 'RENTER'
  const rooms = overview?.properties.flatMap(property => property.rooms) ?? []
  const unpaid = overview?.invoices.filter(row => Number(row.remainingAmount) > 0) ?? []
  const now = new Date()
  const month = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit' }).format(now)
  const tabs = renter ? ['Tổng quan', 'Hợp đồng', 'Thông báo'] :
    ['Tổng quan', 'Khu trọ & phòng', 'Người thuê', 'Hợp đồng', 'Điện nước', 'Hóa đơn & thanh toán', 'Tiền cọc', 'Thông báo', 'Cài đặt']
  return <>
    <header className="mast"><Link href="/" className="brand">RentFlow</Link>{token && <button className="ghost" onClick={async () => {
      try { await api('logout', token, {}) }
      catch (error) { setError((error as Error).message); return }
      sessionStorage.removeItem('rentflow-session'); setToken(''); setOverview(undefined); setLedger(undefined); setCurrent(''); setTab('Tổng quan'); setError('')
    }}>Đăng xuất</button>}</header>
    <main className="shell">
      {!ready && <p role="status">Đang tải…</p>}
      {ready && !token && <Action title="Đăng nhập RentFlow" button="Đăng nhập" fields={[field('email', 'Email', 'email'), field('password', 'Mật khẩu', 'password')]} submit={async data => {
        const result = await api<{ token: string }>('login', '', data)
        sessionStorage.setItem('rentflow-session', result.token)
        setToken(result.token)
      }} />}
      {error && <p className="error" role="alert">{error} <button className="ghost" onClick={() => location.reload()}>Tải lại</button></p>}
      {busy && <p role="status">Đang tải…</p>}
      {overview && <>
        <nav aria-label="Quản lý">{tabs.map(item => <button key={item} aria-current={tab === item ? 'page' : undefined} onClick={() => { setTab(item); setLedger(undefined); setCurrent(''); setError('') }}>{item}</button>)}</nav>
        <h1>{tab}</h1>
        <p className="muted">{overview.actor.fullName}</p>
        {tab === 'Tổng quan' && <>
          <div className="tiles">
            {!renter && <><article><h2>Phòng trống</h2><strong>{rooms.filter(room => room.status === 'AVAILABLE').length}</strong></article>
            <article><h2>Phòng đang thuê</h2><strong>{rooms.filter(room => room.status === 'OCCUPIED').length}</strong></article></>}
            <article><h2>Công nợ</h2><strong>{vnd(unpaid.reduce((sum, row) => sum + Number(row.remainingAmount), 0))}</strong></article>
            <article><h2>Đến hạn tháng này</h2><strong>{unpaid.filter(row => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit' }).format(new Date(row.dueDate)) === month).length}</strong></article>
          </div>
          <h2>Hợp đồng sắp hết hạn</h2>
          {overview.leases.filter(lease => lease.status === 'ACTIVE' && +new Date(lease.endDate) >= +now && +new Date(lease.endDate) - +now <= 30 * 86400000).map(lease =>
            <p key={lease.id}>{lease.room.roomCode} · {date(lease.endDate)}</p>)}
        </>}
        {tab === 'Khu trọ & phòng' && <>
          <label>Tìm phòng<input value={search} onChange={event => setSearch(event.target.value)} placeholder="Mã phòng hoặc tên khu" /></label>
          {overview.properties.map(property => <section key={property.id} className="card"><h2>{property.name}</h2><p>{property.address}</p>
            {property.rooms.filter(room => (room.roomCode + ' ' + property.name).toLowerCase().includes(search.toLowerCase())).map(room =>
              <p key={room.id}><strong>{room.roomCode}</strong> · {labels[room.status]} · {vnd(room.baseRentPrice)} · {room.maxOccupants} người</p>)}
          </section>)}
        </>}
        {tab === 'Người thuê' && <ul>{overview.tenants.map(person => <li key={person.id}>{person.fullName}</li>)}</ul>}
        {tab === 'Điện nước' && overview.properties.map(property => <section key={property.id} className="card"><h2>{property.name}</h2>{property.utilityRates.map(rate =>
          <p key={rate.id}>{rate.serviceName} · {vnd(rate.unitPrice)}/{rate.unit} · {date(rate.effectiveFrom)}</p>)}</section>)}
        {tab === 'Thông báo' && (overview.notifications.length ? <ul>{overview.notifications.map(row => <li key={row.id}>{row.message}</li>)}</ul> : <p>Chưa có thông báo.</p>)}
        {['Tổng quan', 'Hóa đơn & thanh toán'].includes(tab) && <section><h2>Hóa đơn còn nợ</h2>
          {unpaid.length ? unpaid.map(invoice => {
            const lease = overview.leases.find(row => row.id === invoice.leaseId)
            return <p key={invoice.id}>{lease?.room.roomCode} · {lease?.tenants.find(row => row.representative)?.tenant.fullName} · {invoice.billingPeriod} · {vnd(invoice.remainingAmount)} · hạn {date(invoice.dueDate)}</p>
          }) : <p>Không có khoản còn nợ.</p>}
        </section>}
        {['Tổng quan', 'Hợp đồng', 'Hóa đơn & thanh toán', 'Tiền cọc'].includes(tab) && <section>
          <h2>Sổ đối chiếu thuê trọ</h2>
          {overview.leases.length ? overview.leases.map(lease => <button className="ghost choose" key={lease.id} onClick={() => open(lease.id)}>{lease.room.roomCode} · {labels[lease.status]} · {date(lease.startDate)}</button>) : <p>Chưa có hợp đồng.</p>}
        </section>}
        {ledger && <section className="card">
          <h2>Phòng {ledger.room.roomCode}</h2><p>{date(ledger.startDate)} – {date(ledger.endDate)} · {vnd(ledger.rentAmount)}/tháng</p>
          {ledger.tenants.map(({ tenant, representative }, i) => <p key={i}>{tenant.fullName}{representative ? ' · Đại diện' : ''}</p>)}
          {ledger.handovers.map(row => <div key={row.kind}><h3>{row.kind === 'IN' ? 'Nhận phòng' : 'Trả phòng'} · {date(row.date)}</h3>
            <p>{row.condition} · {row.inventory} · Điện {row.electric} · Nước {row.water}</p>{row.notes && <p>{row.notes}</p>}
            <p>{row.confirmedAt ? 'Đã xác nhận' : 'Chờ xác nhận'}</p>
            {!row.confirmedAt && role === 'OWNER' && <Action title="Xác nhận biên bản" submit={values => write('leases/' + ledger.id + '/handovers/' + row.kind + '/confirm', values)} />}
          </div>)}
          <details><summary>Xem quyết toán</summary>
            <p>Cọc thỏa thuận {vnd(ledger.depositAgreed)} · Thực nhận {vnd(ledger.depositReceived)}</p>
            {ledger.settlement ? <><p>Khấu trừ {vnd(ledger.settlement.deduction)} · Bù nợ {vnd(ledger.settlement.debtOffset)}</p>
              <p>Căn cứ {ledger.settlement.reason}</p>
              {ledger.settlement.invoiceId && <p>Hóa đơn bù nợ kỳ {ledger.invoices.find(row => row.id === ledger.settlement?.invoiceId)?.billingPeriod}</p>}
              <strong>Hoàn cọc {vnd(ledger.settlement.refund)}</strong></> : <p>Chưa chốt quyết toán.</p>}
          </details>
          {ledger.invoices.map(invoice => <article className="invoice" key={invoice.id}>
            <h3>Hóa đơn {invoice.billingPeriod}</h3>
            <p>Tổng {vnd(invoice.totalAmount)} · Đã thu {vnd(invoice.paidAmount)} · Còn nợ {vnd(invoice.remainingAmount)}</p>
            <details><summary>Xem cách tính</summary>
              {invoice.items.map(item => <p key={item.id}>{item.description} · {item.meterStart !== null ? '(' + item.meterEnd + ' − ' + item.meterStart + ') = ' : ''}{item.quantity} × {vnd(item.snapshotUnitPrice)} = <strong>{vnd(item.lineTotal)}</strong></p>)}
              <h4>Lịch sử thanh toán</h4>
              {invoice.payments.map(payment => <div key={payment.id}><p>{labels[payment.method]} · {vnd(payment.amount)} · {labels[payment.status]}</p>
                {['OWNER', 'ACCOUNTANT'].includes(role ?? '') && payment.method !== 'DEPOSIT' && payment.status === 'PENDING' && <Action title="Xác nhận khoản thu" submit={values => write('payments/' + payment.id + '/confirm', values)} />}
                {['OWNER', 'ACCOUNTANT'].includes(role ?? '') && payment.method !== 'DEPOSIT' && payment.status === 'CONFIRMED' && <Action title="Đảo khoản thu" fields={[field('reason', 'Lý do')]} submit={values => write('payments/' + payment.id + '/reverse', values)} />}
              </div>)}
            </details>
            {Number(invoice.remainingAmount) > 0 && ['OWNER', 'ACCOUNTANT', 'RENTER'].includes(role ?? '') && <Action title="Báo thanh toán" fields={[field('amount','Số tiền','number'), select('method','Phương thức',[['TRANSFER','Chuyển khoản'],['CASH','Tiền mặt']])]} submit={async values => {
              const key = invoice.id + ':' + values.amount + ':' + values.method
              const requestKey = paymentRequest.current.get(key) ?? crypto.randomUUID()
              paymentRequest.current.set(key, requestKey)
              await write('invoices/' + invoice.id + '/payments', { ...values, requestKey })
              paymentRequest.current.delete(key)
            }} />}
          </article>)}
        </section>}
        {!renter && <AdminForms overview={overview} tab={tab} write={write} current={ledger?.id} />}
      </>}
    </main>
  </>
}
