'use client'
import { useState } from 'react'
import { Action, field, select } from '../shared'
import { matchesVietnameseSearch } from '../vietnamese-search'
import type { Overview, Write } from './page'

const n = (key: string, label: string) => field(key, label, 'number')
const d = (key: string, label: string) => field(key, label, 'date')
const propertyField = 'propertyId'
const leaseField = 'leaseId'

function LeaseCreateForm({ overview, write }: { overview: Overview; write: Write }) {
  const { properties, tenants, leases } = overview
  const rooms = properties.flatMap(property => property.rooms
    .filter(room => room.status === 'AVAILABLE' && room.activeLeaseCount === 0)
    .map(room => ({ ...room, propertyId: property.id, propertyName: property.name })))
  const activeTenantIds = new Set(leases.filter(lease => ['ACTIVE', 'EXPIRED'].includes(lease.status)).flatMap(lease => lease.tenants.map(row => row.tenant.id)))
  const [roomId, setRoomId] = useState('')
  const [query, setQuery] = useState('')
  const [representative, setRepresentative] = useState('')
  const [occupants, setOccupants] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const room = rooms.find(row => row.id === roomId)
  const people = tenants.filter(person => person.propertyId === room?.propertyId && !activeTenantIds.has(person.id))
  const matches = people.filter(person => matchesVietnameseSearch(person.fullName, query))
  const selectedNames = occupants.map(id => people.find(person => person.id === id)).filter(Boolean)
  function chooseRoom(value: string) { setRoomId(value); setRepresentative(''); setOccupants([]); setQuery('') }
  function togglePerson(id: string) { setOccupants(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]) }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setSaved(false)
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    if (!room || !people.some(person => person.id === representative)) { setError('Chọn phòng trống và một người đại diện phù hợp trong khu trọ.'); return }
    if (occupants.includes(representative)) { setError('Người đại diện không chọn lại trong danh sách người ở cùng.'); return }
    setBusy(true)
    try {
      await write('leases', { roomId, representative, occupants, startDate: form.get('startDate'), endDate: form.get('endDate'), rentAmount: Number(form.get('rentAmount')), depositAgreed: Number(form.get('depositAgreed')) })
      formElement.reset(); setRoomId(''); setRepresentative(''); setOccupants([]); setQuery(''); setSaved(true)
    } catch (failure) { setError((failure as Error).message) }
    finally { setBusy(false) }
  }
  return <form className="action" onSubmit={submit}>
    <h3>Lập hợp đồng</h3>
    {!rooms.length ? <p role="status">Chưa có phòng trống phù hợp để lập hợp đồng.</p> : <>
      <label>Phòng<select name="roomId" required value={roomId} onChange={event => chooseRoom(event.target.value)}><option value="">Chọn phòng trống</option>
        {rooms.map(item => <option key={item.id} value={item.id}>{item.propertyName} · {item.roomCode} · {Number(item.baseRentPrice).toLocaleString('vi-VN')} đ</option>)}
      </select></label>
      {!room && <p className="muted">Chọn phòng để tải người thuê thuộc đúng khu trọ.</p>}
      {room && !people.length && <p role="status">Khu trọ này chưa có người thuê phù hợp.</p>}
      {room && people.length > 0 && <>
        <label>Người đại diện<select name="representative" required value={representative} onChange={event => setRepresentative(event.target.value)}>
          <option value="">Chọn người đại diện</option>{people.map(person => <option key={person.id} value={person.id}>{person.fullName}</option>)}
        </select></label>
        <fieldset className="person-picker"><legend>Người ở cùng · có thể chọn nhiều người</legend>
          <label>Tìm người thuê<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Nhập tên người thuê" /></label>
          {selectedNames.length > 0 && <ul className="selected-people" aria-label="Người đã chọn">{selectedNames.map(person => person && <li key={person.id}><span>{person.fullName}</span><button type="button" className="ghost" onClick={() => togglePerson(person.id)}>Bỏ chọn</button></li>)}</ul>}
          {matches.length ? <ul className="person-results">{matches.filter(person => person.id !== representative).map(person => <li key={person.id}>
            <label><input type="checkbox" checked={occupants.includes(person.id)} onChange={() => togglePerson(person.id)} />{person.fullName}</label>
          </li>)}</ul> : <p role="status">Không có người thuê phù hợp với từ khóa.</p>}
        </fieldset>
      </>}
      <div className="fields">
        <label>Ngày bắt đầu<input name="startDate" type="date" required /></label><label>Ngày kết thúc<input name="endDate" type="date" required /></label>
        <label>Giá thuê (VNĐ/tháng)<input name="rentAmount" type="number" min="0" step="1" placeholder="Ví dụ: 3000000" required /></label>
        <label>Cọc thỏa thuận (VNĐ)<input name="depositAgreed" type="number" min="0" step="1" placeholder="Ví dụ: 3000000" required /></label>
      </div>
      <button disabled={busy || !room || people.length === 0}>{busy ? 'Đang lưu…' : 'Lưu hợp đồng'}</button>
    </>}
    {error && <p role="alert">{error}</p>}{saved && <p role="status">Đã lưu hợp đồng nháp.</p>}
  </form>
}
export function AdminForms({ overview, tab, current, write }: { overview: Overview; tab: string; current?: string; write: Write }) {
  const { actor, properties, leases, tenants, invoices } = overview
  const owner = actor.role === 'OWNER'
  const operations = owner || actor.role === 'STAFF'
  const billing = owner || actor.role === 'ACCOUNTANT'
  const property = select(propertyField, 'Khu trọ', properties.map(row => [row.id, row.name]))
  const rooms = select('roomId', 'Phòng', properties.flatMap(row => row.rooms.map<[string, string]>(room => [room.id, row.name + ' · ' + room.roomCode])))
  const today = new Date().toISOString().slice(0, 10)
  const active = leases.filter(row => row.status === 'ACTIVE' && new Date(row.endDate).toISOString().slice(0, 10) >= today)
  const chosen = leases.find(row => row.id === current)
  const leaseOptions = (rows: typeof leases) => select(leaseField, 'Hợp đồng', rows.map(row => [row.id, `${row.room.roomCode} · ${row.tenants.map(person => person.tenant.fullName).join(', ')} · ${row.status} · ${new Date(row.startDate).toLocaleDateString('vi-VN')}`]))
  const activatable = leases.filter(row => row.status === 'DRAFT' && properties.some(property => property.id === row.room.propertyId && property.rooms.some(room => room.id === row.roomId && room.status === 'AVAILABLE' && room.activeLeaseCount === 0)))
  const scoped = (resource: string, key: string, suffix = '') => async (data: Record<string, unknown>) => {
    const { [key]: id, ...values } = data
    await write(resource + '/' + id + suffix, values)
  }
  if (tab === 'Khu trọ & phòng' && owner) return <div className="forms">
    <Action title="Tạo khu trọ" fields={[field('name','Tên khu'), field('address','Địa chỉ')]} submit={values => write('properties', values)} />
    <Action title="Tạo phòng" fields={[property, field('roomCode','Mã phòng'), n('baseRentPrice','Giá thuê'), n('maxOccupants','Sức chứa'), { ...select('status','Trạng thái',[['AVAILABLE','Trống'],['MAINTENANCE','Bảo trì']]), value: 'AVAILABLE' }]} submit={scoped('properties', propertyField, '/rooms')} />
    <Action title="Cập nhật phòng" fields={[rooms, n('baseRentPrice','Giá thuê mới'), n('maxOccupants','Sức chứa'), select('status','Trạng thái',[['AVAILABLE','Trống'],['MAINTENANCE','Bảo trì'],['OCCUPIED','Đang thuê']])]} submit={scoped('rooms','roomId','/settings')} />
  </div>
  if (tab === 'Người thuê' && operations) return <Action title="Thêm người thuê" fields={[
    property, field('fullName','Họ tên'), field('contact','Liên hệ','text',true), ...(owner ? [field('email','Email tài khoản đã cấp','email',true)] : []),
  ]} submit={scoped('properties', propertyField, '/tenants')} />
  if (tab === 'Hợp đồng' && operations) return <div className="forms">
    <LeaseCreateForm overview={overview} write={write} />
    {owner && (activatable.length ? <Action title="Kích hoạt hợp đồng" fields={[leaseOptions(activatable)]} submit={scoped('leases', leaseField, '/activate')} /> : <p role="status">Chưa có hợp đồng nháp phù hợp với phòng trống.</p>)}
    {active.length ? <Action title="Lập biên bản bàn giao" fields={[leaseOptions(active), select('kind','Loại biên bản',[['IN','Nhận phòng'],['OUT','Trả phòng']]), d('date','Ngày bàn giao'), field('condition','Tình trạng'), field('inventory','Tài sản'), n('electric','Chỉ số điện'), n('water','Chỉ số nước'), field('notes','Ghi chú','text',true)]} submit={scoped('leases', leaseField, '/handovers')} /> : <p role="status">Chưa có hợp đồng đang hiệu lực để lập biên bản bàn giao.</p>}
  </div>
  if (tab === 'Điện nước' && operations) return <div className="forms">
    {owner && <Action title="Thêm đơn giá" fields={[property, select('serviceType','Loại',[['ELECTRICITY','Điện'],['WATER','Nước'],['SERVICE','Dịch vụ']]), { ...field('serviceName','Tên dịch vụ'), placeholder: 'Ví dụ: Điện sinh hoạt' }, { ...select('unit','Đơn vị',[['kWh','kWh'],['m³','m³'],['tháng','tháng'],['lần','lần']]), value: '' }, { ...n('unitPrice','Đơn giá (VNĐ)'), step: '1', placeholder: 'Số nguyên không âm, ví dụ: 3500' }, d('effectiveFrom','Hiệu lực từ')]} submit={scoped('properties', propertyField, '/rates')} />}
    {!overview.properties.some(row => row.utilityRates.length) && <p role="status">Chưa có đơn giá dịch vụ đã lưu.</p>}
    <Action title="Ghi chỉ số" fields={[rooms, { ...field('billingPeriod','Kỳ (YYYY-MM)'), pattern: '20[0-9]{2}-(0[1-9]|1[0-2])' }, n('electricOld','Điện đầu kỳ'), n('electricNew','Điện cuối kỳ'), n('waterOld','Nước đầu kỳ'), n('waterNew','Nước cuối kỳ')]} submit={scoped('rooms', 'roomId', '/readings')} />
    <Action title="Điều chỉnh chỉ số" fields={[rooms, { ...field('billingPeriod','Kỳ (YYYY-MM)'), pattern: '20[0-9]{2}-(0[1-9]|1[0-2])' }, n('electricOld','Điện đầu kỳ'), n('electricNew','Điện cuối kỳ'), n('waterOld','Nước đầu kỳ'), n('waterNew','Nước cuối kỳ'), field('reason','Lý do điều chỉnh')]} submit={scoped('rooms', 'roomId', '/readings/correct')} />
  </div>
  if (tab === 'Hóa đơn & thanh toán' && billing) return active.length ? <Action title="Phát hành hóa đơn" fields={[leaseOptions(active), { ...field('billingPeriod','Kỳ (YYYY-MM)'), pattern: '20[0-9]{2}-(0[1-9]|1[0-2])', placeholder: 'Ví dụ: 2026-11' }, d('dueDate','Hạn thanh toán')]} submit={scoped('leases', leaseField, '/invoices')} /> : <p role="status">Chưa có hợp đồng đang hiệu lực, còn hạn để lập hóa đơn.</p>
  if (tab === 'Tiền cọc' && owner) return <div className="forms">
    {active.length ? <Action title="Ghi cọc đã nhận" fields={[leaseOptions(active), { ...n('amount','Thực nhận (VNĐ)'), step: '1', placeholder: 'Số nguyên không âm' }, field('reason','Căn cứ')]} submit={scoped('leases', leaseField, '/deposit')} /> : <p role="status">Chưa có hợp đồng đang hiệu lực, còn hạn để ghi nhận tiền cọc.</p>}
    {chosen && active.includes(chosen) && <Action title={'Chốt quyết toán phòng ' + chosen.room.roomCode} fields={[
      n('deduction','Khấu trừ'), n('debtOffset','Bù công nợ'), field('reason','Căn cứ khấu trừ và trả phòng'),
      select('invoiceId','Hóa đơn bù nợ',invoices.filter(row => row.leaseId === chosen.id && Number(row.remainingAmount) > 0).map(row => [row.id, row.billingPeriod]),true),
    ]} submit={values => write('leases/' + chosen.id + '/settlement', values)} />}
  </div>
  if (tab === 'Cài đặt') return <p>Vai trò tài khoản hiện tại · {{ OWNER: 'Chủ trọ', STAFF: 'Nhân viên', ACCOUNTANT: 'Kế toán' }[actor.role]}</p>
  return null
}

