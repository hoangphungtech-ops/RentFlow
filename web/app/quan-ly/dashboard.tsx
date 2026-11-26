'use client'

import Link from 'next/link'
import { PortalSection } from '../portal-sections'
import { PortalSidebar } from '../portal-sidebar'
import { MeterPhotos } from '../meter-photos'
import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { Action, api, ApiError, field, select, vnd } from '../shared'
import { AccountSettings } from './accounts'
import { RoomList } from './rooms'
import { AdminForms } from './forms'

type Person = { id: string; fullName: string; propertyId: string }
type RoomImage = { id: string; alt: string; mimeType: string; sizeBytes: number; width: number; height: number; isPrimary: boolean }
type Room = { id: string; roomCode: string; status: string; baseRentPrice: string; maxOccupants: number; occupantCount: number; activeLeaseCount: number; images: RoomImage[] }
type Lease = { id: string; roomId: string; room: { roomCode: string; propertyId: string }; rentAmount: string; startDate: string; endDate: string; status: string; depositAgreed: string; depositReceived: string; tenants: { representative: boolean; tenant: { id: string; fullName: string } }[] }
type Payment = { id: string; method: string; status: string; amount: string }
type Item = { id: string; description: string; meterStart: string | null; meterEnd: string | null; quantity: string; snapshotUnitPrice: string; lineTotal: string }
type Invoice = { id: string; leaseId: string; billingPeriod: string; dueDate: string; totalAmount: string; paidAmount: string; remainingAmount: string; status: string; cancelReason: string | null }
type InvoiceDetail = Invoice & { items: Item[]; payments: Payment[] }
type Ledger = Lease & {
  room: Lease['room'] & { property: { name: string } }
  invoices: InvoiceDetail[]
  handovers: { kind: string; date: string; condition: string; inventory: string; electric: string; water: string; notes: string | null; confirmedAt: string | null }[]
  settlement: { received: string; deduction: string; debtOffset: string; refund: string; reason: string; invoiceId?: string } | null
}
export type Overview = {
  demo?: boolean
  actor: { fullName: string; role: string; email: string; username: string | null }; tenants: Person[]; leases: Lease[]; invoices: (Invoice & { _count: { payments: number } })[];
  properties: { id: string; name: string; address: string; rooms: Room[]; utilityRates: { id: string; serviceName: string; unitPrice: string; unit: string; effectiveFrom: string }[] }[];
  notifications: { id: string; message: string }[]
}
export type Write = (path: string, body: Record<string, unknown>) => Promise<void>
const date = (value: string) => new Date(value).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
const localDay = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' })
const labels: Record<string, string> = { AVAILABLE: 'Trống', OCCUPIED: 'Đang thuê', MAINTENANCE: 'Bảo trì', ACTIVE: 'Đang thuê', DRAFT: 'Nháp', EXPIRED: 'Hết hạn', TERMINATED: 'Đã trả phòng', CASH: 'Tiền mặt', TRANSFER: 'Chuyển khoản', DEPOSIT: 'Bù cọc', PENDING: 'Chờ xác nhận', CONFIRMED: 'Đã xác nhận', REVERSED: 'Đã đảo', ISSUED: 'Chưa thu', PARTIALLY_PAID: 'Thu một phần', PAID: 'Đã thu đủ', CANCELLED: 'Đã hủy' }
const invoiceBalance = (invoice: Invoice) => invoice.status === 'CANCELLED' ? 0 : Number(invoice.remainingAmount)

function InvoiceBadge({ status }: { status: string }) {
  return <span className={'badge badge-' + status.toLowerCase()}>{labels[status] ?? status}</span>
}

function InvoiceItems({ items }: { items: Item[] }) {
  return <table className="invoice-table"><thead><tr><th>Khoản mục</th><th>Chỉ số</th><th>SL</th><th>Đơn giá</th><th>Thành tiền</th></tr></thead><tbody>
    {items.map(item => <tr key={item.id}><td>{item.description}</td><td>{item.meterStart !== null ? item.meterEnd + ' − ' + item.meterStart : '—'}</td><td>{item.quantity}</td><td>{vnd(item.snapshotUnitPrice)}</td><td><strong>{vnd(item.lineTotal)}</strong></td></tr>)}
  </tbody></table>
}

export default function Dashboard({ portal }: { portal?: 'user' | 'manager' | 'owner' | 'staff' | 'accountant' } = {}) {
  const [signedIn, setSignedIn] = useState(false)
  const token = ''
  const [overview, setOverview] = useState<Overview>()
  const [ledger, setLedger] = useState<Ledger>()
  const [current, setCurrent] = useState('')
  const [tab, setTab] = useState('Tổng quan')
  const [roomStatus, setRoomStatus] = useState('')
  const [debtOnly, setDebtOnly] = useState(false)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [printId, setPrintId] = useState('')
  const [expandedInvoiceId, setExpandedInvoiceId] = useState('')
  const [busy, setBusy] = useState(false)
  const paymentRequest = useRef(new Map<string, string>())
  const ledgerRef = useRef<HTMLElement>(null)
  const scrollTarget = useRef<{ invoiceId?: string } | null>(null)
  async function refresh() {
    setBusy(true)
    try {
      setOverview(await api<Overview>('overview'))
      setSignedIn(true)
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) signOut()
      else setError((failure as Error).message)
    } finally { setBusy(false); setReady(true) }
  }
  function signOut(message = '') {
    if (portal) { window.location.replace('/login'); return }
    setSignedIn(false); setOverview(undefined); setLedger(undefined); setCurrent(''); setTab('Tổng quan'); setError(message)
  }
  useEffect(() => {
    sessionStorage.removeItem('rentflow-session')
    void refresh()
  }, [])
  useEffect(() => {
    if (ledger && scrollTarget.current) {
      const { invoiceId } = scrollTarget.current
      scrollTarget.current = null
      const invoice = invoiceId ? document.getElementById('invoice-' + invoiceId) : null
      const target = invoice ?? ledgerRef.current
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [ledger])
  async function open(id: string, jump = false, invoiceId?: string, expandPayments = false) {
    scrollTarget.current = jump ? { invoiceId } : null
    setLedger(undefined); setCurrent(id); setBusy(true); setError(''); setNotice(''); setPrintId('')
    setExpandedInvoiceId(expandPayments ? invoiceId ?? '' : '')
    try { setLedger(await api<Ledger>('leases/' + id + '/ledger', token)) }
    catch (error) { setError((error as Error).message) }
    finally { setBusy(false) }
  }
  const write: Write = async (path, values) => {
    await api(path, token, values)
    try {
      const [updated, updatedLedger] = await Promise.all([
        api<Overview>('overview', token),
        current ? api<Ledger>('leases/' + current + '/ledger', token) : undefined,
      ])
      setOverview(updated)
      if (updatedLedger) setLedger(updatedLedger)
    } catch { setError('Đã lưu. Hãy tải lại để xem dữ liệu mới.') }
  }
  const role = overview?.actor.role
  const renter = role === 'RENTER'
  const canConfirm = role === 'OWNER' || role === 'ACCOUNTANT'
  const rooms = overview?.properties.flatMap(property => property.rooms) ?? []
  const unpaid = overview?.invoices.filter(row => invoiceBalance(row) > 0) ?? []
  const printInvoice = ledger?.invoices.find(invoice => invoice.id === printId)
  const now = new Date()
  const today = localDay.format(now)
  const nextMonth = localDay.format(new Date(+now + 30 * 86400000))
  const overdue = unpaid.filter(invoice => localDay.format(new Date(invoice.dueDate)) < today)
  const pending = overview?.invoices.filter(invoice => invoice.status !== 'CANCELLED' && invoice._count.payments > 0) ?? []
  const ending = overview?.leases.filter(lease => {
    const endDay = localDay.format(new Date(lease.endDate))
    return lease.status === 'ACTIVE' && endDay >= today && endDay <= nextMonth
  }).sort((a, b) => a.endDate.localeCompare(b.endDate)) ?? []
  function downloadInvoiceReport() {
    const rows = [['Kỳ hóa đơn', 'Tổng tiền', 'Đã thu', 'Còn nợ', 'Trạng thái'],
      ...(overview?.invoices ?? []).map(row => [row.billingPeriod, row.totalAmount, row.paidAmount, String(invoiceBalance(row)), labels[row.status] ?? row.status])]
    const csv = rows.map(row => row.map(value => '"' + value.replaceAll('"', '""') + '"').join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'rentflow-cong-no.csv'
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const tabsByPortal = {
    user: ['Tổng quan', 'Tìm phòng', 'Yêu cầu thuê', 'Bảo trì', 'Hóa đơn & thanh toán', 'Hợp đồng', 'Thông báo', 'Cài đặt'],
    owner: ['Tổng quan', 'Khu trọ & phòng', 'Đăng phòng', 'Yêu cầu thuê', 'Bảo trì', 'Người thuê', 'Hợp đồng', 'Điện nước', 'Hóa đơn & thanh toán', 'Tiền cọc', 'Thông báo', 'Cài đặt'],
    manager: ['Tổng quan', 'Khu trọ & phòng', 'Đăng phòng', 'Yêu cầu thuê', 'Bảo trì', 'Người thuê', 'Hợp đồng', 'Điện nước', 'Hóa đơn & thanh toán', 'Thông báo', 'Cài đặt'],
    staff: ['Tổng quan', 'Khu trọ & phòng', 'Hợp đồng', 'Điện nước', 'Bảo trì', 'Thông báo', 'Cài đặt'],
    accountant: ['Tổng quan', 'Hóa đơn & thanh toán', 'Thông báo', 'Cài đặt'],
  }
  const portalLabels = { user: 'Cổng người thuê', owner: 'Cổng chủ trọ', manager: 'Cổng quản lý khu trọ', staff: 'Cổng nhân viên', accountant: 'Cổng kế toán' }
  const activePortal = portal ?? (renter ? 'user' : 'owner')
  const tabs = tabsByPortal[activePortal]
  function selectTab(item: string, status = '', onlyDebt = false) {
    setRoomStatus(status)
    setDebtOnly(onlyDebt)
    setTab(item)
    setLedger(undefined)
    setCurrent('')
    setError('')
    setNotice('')
    setPrintId('')
  }
  return <>
    <div className={portal ? 'workspace' : undefined}>
    {portal && <PortalSidebar label={portalLabels[portal]} sections={overview ? tabs : []} active={tab} onSelect={item => selectTab(item)} />}
    <div className="workspace-content">
    <header className="mast"><Link href="/" className="brand">RentFlow</Link>{overview && <span className="workspace-user">{overview.actor.fullName}</span>}{signedIn && <button className="ghost" onClick={async () => {
      try { await api('logout', token, {}) }
      catch (error) { if (!(error instanceof ApiError && error.status === 401)) { setError((error as Error).message); return } }
      signOut()
    }}>Đăng xuất</button>}</header>
    <main className="shell">
      {!ready && <p role="status">Đang tải…</p>}
      {ready && !signedIn && !portal && <>
        <Action title="Đăng nhập RentFlow" button="Đăng nhập" fields={[field('identifier', 'Tên đăng nhập hoặc email'), field('password', 'Mật khẩu', 'password')]} submit={async data => {
          await api('login', '', data)
          await refresh()
        }} />
        <p><Link href="/khoi-phuc">Quên mật khẩu?</Link> · <Link href="/khoi-phuc?mode=activate">Kích hoạt tài khoản</Link></p>
      </>}
      {error && <p className="error" role="alert">{error} <button className="ghost" onClick={() => location.reload()}>Tải lại</button></p>}
      {busy && <p role="status">Đang tải…</p>}
      {overview && <>
        {!portal && <nav aria-label="Quản lý">{tabs.map(item => <button key={item} aria-current={tab === item ? 'page' : undefined} onClick={() => selectTab(item)}>{item}</button>)}</nav>}
        <h1>{tab}</h1>
        {portal && portal !== 'accountant' && <PortalSection key={tab} tab={tab} role={portal === 'user' ? 'user' : 'manager'} overview={overview} refresh={refresh} />}
        {tab === 'Cài đặt' && <AccountSettings actor={overview.actor} properties={overview.properties} tenants={overview.tenants} signedOut={signOut} />}
        {tab === 'Tổng quan' && <>
          <div className="tiles">
            {tabs.includes('Khu trọ & phòng') && [
              { title: 'Tổng số phòng', status: '' },
              { title: 'Phòng đang thuê', status: 'OCCUPIED' },
              { title: 'Phòng trống', status: 'AVAILABLE' },
            ].map(item => <article key={item.title}>
              <h2>{item.title}</h2>
              <strong>{item.status ? rooms.filter(room => room.status === item.status).length : rooms.length}</strong>
              <button className="ghost metric-link" onClick={() => selectTab('Khu trọ & phòng', item.status)}>Xem {item.title.toLowerCase()}</button>
            </article>)}
            {tabs.includes('Hóa đơn & thanh toán') && <article><h2>Công nợ</h2>
              <strong>{vnd(unpaid.reduce((sum, row) => sum + invoiceBalance(row), 0))}</strong>
              <button className="ghost metric-link" onClick={() => selectTab('Hóa đơn & thanh toán', '', true)}>Xem hóa đơn còn nợ</button>
            </article>}
            {!rooms.length && renter && <article><h2>Tìm phòng</h2><button className="ghost" onClick={() => selectTab('Tìm phòng')}>Xem phòng đang nhận yêu cầu</button></article>}
            {role === 'STAFF' && <article><h2>Công việc bảo trì</h2><button className="ghost" onClick={() => selectTab('Bảo trì')}>Xem việc được giao</button></article>}
          </div>
          <section aria-labelledby="tasks-title">
            <h2 id="tasks-title">Việc cần xử lý</h2>
            <div className="task-grid">
              {role !== 'STAFF' && <article className="card">
                <h3>{overdue.length} hóa đơn quá hạn</h3>
                {overdue.length ? <p><strong>{vnd(overdue.reduce((sum, row) => sum + invoiceBalance(row), 0))}</strong> cần đối chiếu</p> : <p className="muted">Không có khoản quá hạn.</p>}
                {overdue.length > 0 && <details open><summary>Xem từng hóa đơn</summary>
                  {overdue.map(invoice => <div className="unpaid-row" key={invoice.id}>
                    <span>{overview.leases.find(lease => lease.id === invoice.leaseId)?.room.roomCode} · {vnd(invoice.remainingAmount)} · Hạn {date(invoice.dueDate)}</span>
                    <button type="button" className="ghost" onClick={() => open(invoice.leaseId, true, invoice.id)}>Xem sổ</button>
                  </div>)}
                </details>}
              </article>}
              {canConfirm && <article className="card">
                <h3>{pending.reduce((sum, invoice) => sum + invoice._count.payments, 0)} khoản chờ xác nhận</h3>
                <p className="muted">{pending.length ? 'Đối chiếu giao dịch hoặc tiền mặt thực nhận.' : 'Không có khoản chờ xác nhận.'}</p>
                {pending.length > 0 && <details open><summary>Xem khoản chờ xác nhận</summary>
                  {pending.map(invoice => <div className="unpaid-row" key={invoice.id}>
                    <span>{overview.leases.find(lease => lease.id === invoice.leaseId)?.room.roomCode} · {invoice.billingPeriod} · {invoice._count.payments} khoản</span>
                    <button type="button" className="ghost" onClick={() => open(invoice.leaseId, true, invoice.id, true)}>Đối chiếu</button>
                  </div>)}
                </details>}
              </article>}
              <article className="card">
                <h3>{ending.length} hợp đồng sắp hết hạn</h3>
                <p className="muted">Trong 30 ngày tới.</p>
                {ending.map(lease => <div className="unpaid-row" key={lease.id}>
                  <span>{lease.room.roomCode} · {date(lease.endDate)}</span>
                  <button type="button" className="ghost" onClick={() => open(lease.id, true)}>Xem hợp đồng</button>
                </div>)}
              </article>
            </div>
          </section>
        </>}
        {tab === 'Khu trọ & phòng' && <RoomList properties={overview.properties} statuses={labels} openLease={open} refresh={refresh} owner={role === 'OWNER' || role === 'MANAGER'} initialStatus={roomStatus}
          demo={overview.demo} invoices={role === 'STAFF' ? undefined : unpaid} leases={overview.leases} />}
        {tab === 'Người thuê' && <ul>{overview.tenants.map(person => <li key={person.id}>{person.fullName}</li>)}</ul>}
        {tab === 'Điện nước' && overview.properties.map(property => <section key={property.id} className="card"><h2>{property.name}</h2>{property.utilityRates.map(rate =>
          <p key={rate.id}>{rate.serviceName} · {vnd(rate.unitPrice)}/{rate.unit} · {date(rate.effectiveFrom)}</p>)}</section>)}
        {tab === 'Thông báo' && (overview.notifications.length ? <ul>{overview.notifications.map(row => <li key={row.id}>{row.message}</li>)}</ul> : <p>Chưa có thông báo.</p>)}
        {tab === 'Hóa đơn & thanh toán' && <section aria-label="Bảng kê hóa đơn">
          <h2>Bảng kê hóa đơn</h2>
          <label className="invoice-filter"><input type="checkbox" checked={debtOnly} onChange={event => setDebtOnly(event.target.checked)} /> Chỉ xem hóa đơn còn nợ</label>
          {canConfirm && <button className="ghost" onClick={downloadInvoiceReport}>Xuất bảng kê CSV</button>}
          {(debtOnly ? unpaid : overview.invoices).length ? <div className="table-wrap"><table className="invoice-table"><thead><tr>
            <th scope="col">Phòng · Kỳ</th><th scope="col">Tổng tiền</th><th scope="col">Đã thu</th><th scope="col">Còn nợ</th><th scope="col">Trạng thái</th><th scope="col">Chi tiết</th>
          </tr></thead><tbody>{(debtOnly ? unpaid : overview.invoices).map(invoice => {
            const lease = overview.leases.find(row => row.id === invoice.leaseId)
            return <tr id={'invoice-row-' + invoice.id} key={invoice.id}><th scope="row">{lease?.room.roomCode} · {invoice.billingPeriod}</th>
              <td>{vnd(invoice.totalAmount)}</td><td>{vnd(invoice.paidAmount)}</td><td>{vnd(invoiceBalance(invoice))}</td><td><InvoiceBadge status={invoice.status} /></td>
              <td><button type="button" className="ghost" onClick={() => open(invoice.leaseId, true, invoice.id)}>Xem sổ</button></td>
            </tr>
          })}</tbody></table></div> : <p>Chưa có hóa đơn.</p>}
        </section>}
        {tab === 'Tổng quan' && role !== 'STAFF' && <section><h2>Hóa đơn còn nợ</h2>
          {unpaid.length ? unpaid.map(invoice => {
            const lease = overview.leases.find(row => row.id === invoice.leaseId)
            return <div key={invoice.id} className="unpaid-row"><span>{lease?.room.roomCode} · {lease?.tenants.find(row => row.representative)?.tenant.fullName} · {invoice.billingPeriod} · <strong>{vnd(invoice.remainingAmount)}</strong> · hạn {date(invoice.dueDate)}</span><button type="button" className="ghost no-print" onClick={() => open(invoice.leaseId, true, invoice.id)}>Xem sổ</button></div>
          }) : <p>Không có khoản còn nợ.</p>}
        </section>}
        {['Tổng quan', 'Hợp đồng', 'Hóa đơn & thanh toán', 'Tiền cọc'].includes(tab) && <section>
          <h2>Sổ đối chiếu thuê trọ</h2>
          {overview.leases.length ? overview.leases.map(lease => <button className="ghost choose" key={lease.id} onClick={() => open(lease.id)}>{lease.room.roomCode} · {labels[lease.status]} · {date(lease.startDate)}</button>) : <p>Chưa có hợp đồng.</p>}
        </section>}
        {ledger && <section ref={ledgerRef} className="card print-ledger">
          {notice && <p role="status" className="feedback">{notice}</p>}
          <h2>Phòng {ledger.room.roomCode}</h2><p>{date(ledger.startDate)} – {date(ledger.endDate)}{role !== 'STAFF' && ' · ' + vnd(ledger.rentAmount) + '/tháng'}</p>
          {ledger.tenants.map(({ tenant, representative }, i) => <p key={i}>{tenant.fullName}{representative ? ' · Đại diện' : ''}</p>)}
          {ledger.handovers.map(row => <div key={row.kind}><h3>{row.kind === 'IN' ? 'Nhận phòng' : 'Trả phòng'} · {date(row.date)}</h3>
            <p>{row.condition} · {row.inventory} · Điện {row.electric} · Nước {row.water}</p>{row.notes && <p>{row.notes}</p>}
            <p>{row.confirmedAt ? 'Đã xác nhận' : 'Chờ xác nhận'}</p>
            {!row.confirmedAt && (role === 'OWNER' || role === 'MANAGER') && <Action title="Xác nhận biên bản" submit={values => write('leases/' + ledger.id + '/handovers/' + row.kind + '/confirm', values)} />}
          </div>)}
          {role !== 'STAFF' && <details><summary>Xem quyết toán</summary>
            <p>Cọc thỏa thuận {vnd(ledger.depositAgreed)} · Thực nhận {vnd(ledger.depositReceived)}</p>
            {ledger.settlement ? <><p>Khấu trừ {vnd(ledger.settlement.deduction)} · Bù nợ {vnd(ledger.settlement.debtOffset)}</p>
              <p>Căn cứ {ledger.settlement.reason}</p>
              {ledger.settlement.invoiceId && <p>Hóa đơn bù nợ kỳ {ledger.invoices.find(row => row.id === ledger.settlement?.invoiceId)?.billingPeriod}</p>}
              <strong>Hoàn cọc {vnd(ledger.settlement.refund)}</strong></> : <p>Chưa chốt quyết toán.</p>}
          </details>}
          {ledger.invoices.map(invoice => <article className="invoice" id={'invoice-' + invoice.id} key={invoice.id}>
            <div className="invoice-head"><h3>Hóa đơn {invoice.billingPeriod} <InvoiceBadge status={invoice.status} /></h3><button type="button" className="ghost no-print" onClick={() => {
              flushSync(() => setPrintId(invoice.id))
              window.print()
            }}>In / Lưu PDF</button></div>
            <p>Tổng {vnd(invoice.totalAmount)} · Đã thu {vnd(invoice.paidAmount)} · Còn nợ {vnd(invoiceBalance(invoice))}</p>
            {invoice.cancelReason && <p>Lý do hủy: {invoice.cancelReason}</p>}
            {invoice.status !== "CANCELLED" && <MeterPhotos invoiceId={invoice.id} />}
            <details open={invoice.id === expandedInvoiceId || undefined}><summary>Xem cách tính</summary>
              <div className="table-wrap"><InvoiceItems items={invoice.items} /></div>
              <h4>Lịch sử thanh toán</h4>
              {invoice.payments.map(payment => <div key={payment.id}><p>{labels[payment.method]} · {vnd(payment.amount)} · {labels[payment.status]}</p>
                {['OWNER', 'ACCOUNTANT'].includes(role ?? '') && payment.method !== 'DEPOSIT' && payment.status === 'PENDING' && <Action title="Xác nhận khoản thu" submit={values => write('payments/' + payment.id + '/confirm', values)} />}
                {['OWNER', 'ACCOUNTANT'].includes(role ?? '') && payment.method !== 'DEPOSIT' && payment.status === 'CONFIRMED' && <Action title="Đảo khoản thu" fields={[field('reason', 'Lý do')]} submit={values => write('payments/' + payment.id + '/reverse', values)} />}
              </div>)}
            </details>
            {invoiceBalance(invoice) > 0 && ['OWNER', 'ACCOUNTANT', 'RENTER'].includes(role ?? '') && <Action title="Báo thanh toán" fields={[field('amount','Số tiền','number'), select('method','Phương thức',[['TRANSFER','Chuyển khoản'],['CASH','Tiền mặt']])]} submit={async values => {
              const key = invoice.id + ':' + values.amount + ':' + values.method
              const requestKey = paymentRequest.current.get(key) ?? crypto.randomUUID()
              paymentRequest.current.set(key, requestKey)
              await write('invoices/' + invoice.id + '/payments', { ...values, requestKey })
              paymentRequest.current.delete(key)
            }} />}
          {['OWNER', 'ACCOUNTANT'].includes(role ?? '') && invoice.status === 'ISSUED' && Number(invoice.paidAmount) === 0 && !invoice.payments.some(p => p.status === 'PENDING' || p.status === 'CONFIRMED') && <div className="no-print"><Action title="Hủy hóa đơn" fields={[field('reason', 'Lý do hủy hóa đơn')]} submit={async values => {
            await write('invoices/' + invoice.id + '/cancel', values)
            setNotice('Đã hủy hóa đơn kỳ ' + invoice.billingPeriod + '.')
          }} /></div>}
          </article>)}
        </section>}
        {!renter && <AdminForms overview={overview} tab={tab} write={write} current={ledger?.id} />}
      </>}
    </main>
    </div>
    </div>
    {ledger && printInvoice && <article className="print-invoice">
      <p className="brand">RentFlow</p>
      <h1>Hóa đơn thuê trọ {printInvoice.billingPeriod}</h1>
      <p>{ledger.room.property.name} · Phòng {ledger.room.roomCode}</p>
      {ledger.tenants.filter(person => person.representative).map(person => <p key={person.tenant.fullName}>Người đại diện: {person.tenant.fullName}</p>)}
      <p>Hạn thanh toán {date(printInvoice.dueDate)} · {labels[printInvoice.status]}</p>
      {printInvoice.cancelReason && <p>Lý do hủy: {printInvoice.cancelReason}</p>}
      <InvoiceItems items={printInvoice.items} />
      <p>Tổng {vnd(printInvoice.totalAmount)} · Đã thu {vnd(printInvoice.paidAmount)} · <strong>Còn nợ {vnd(invoiceBalance(printInvoice))}</strong></p>
    </article>}
  </>
}
