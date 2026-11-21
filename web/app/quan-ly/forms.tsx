'use client'
import { Action, field, select } from '../shared'
import type { Overview, Write } from './page'

const n = (key: string, label: string) => field(key, label, 'number')
const d = (key: string, label: string) => field(key, label, 'date')
const propertyField = 'propertyId'
const leaseField = 'leaseId'
export function AdminForms({ overview, tab, current, write }: { overview: Overview; tab: string; current?: string; write: Write }) {
  const { actor, properties, leases, tenants, invoices } = overview
  const owner = actor.role === 'OWNER'
  const operations = owner || actor.role === 'STAFF'
  const billing = owner || actor.role === 'ACCOUNTANT'
  const property = select(propertyField, 'Khu trọ', properties.map(row => [row.id, row.name]))
  const rooms = select('roomId', 'Phòng', properties.flatMap(row => row.rooms.map<[string, string]>(room => [room.id, row.name + ' · ' + room.roomCode])))
  const people: [string, string][] = tenants.map(row => [row.id, row.fullName + ' · ' + properties.find(p => p.id === row.propertyId)?.name])
  const active = leases.filter(row => ['ACTIVE', 'EXPIRED'].includes(row.status))
  const chosen = leases.find(row => row.id === current)
  const leaseOptions = (rows: typeof leases) => select(leaseField, 'Hợp đồng', rows.map(row => [row.id, row.room.roomCode + ' · ' + new Date(row.startDate).toLocaleDateString('vi-VN')]))
  const scoped = (resource: string, key: string, suffix = '') => async (data: Record<string, unknown>) => {
    const { [key]: id, ...values } = data
    await write(resource + '/' + id + suffix, values)
  }
  if (tab === 'Khu trọ & phòng' && owner) return <div className="forms">
    <Action title="Tạo khu trọ" fields={[field('name','Tên khu'), field('address','Địa chỉ')]} submit={values => write('properties', values)} />
    <Action title="Tạo phòng" fields={[property, field('roomCode','Mã phòng'), n('baseRentPrice','Giá thuê'), n('maxOccupants','Sức chứa'), select('status','Trạng thái',[['AVAILABLE','Trống'],['MAINTENANCE','Bảo trì']])]} submit={scoped('properties', propertyField, '/rooms')} />
  </div>
  if (tab === 'Người thuê' && operations) return <Action title="Thêm người thuê" fields={[
    property, field('fullName','Họ tên'), field('contact','Liên hệ','text',true), ...(owner ? [field('email','Email tài khoản đã cấp','email',true)] : []),
  ]} submit={scoped('properties', propertyField, '/tenants')} />
  if (tab === 'Hợp đồng' && operations) return <div className="forms">
    <Action title="Lập hợp đồng" fields={[rooms, select('representative','Người đại diện',people), select('occupants','Người ở cùng',people,true,true), d('startDate','Ngày bắt đầu'), d('endDate','Ngày kết thúc'), n('rentAmount','Giá thuê'), n('depositAgreed','Cọc thỏa thuận')]} submit={values => write('leases', values)} />
    {owner && <Action title="Kích hoạt hợp đồng" fields={[leaseOptions(leases.filter(row => row.status === 'DRAFT'))]} submit={scoped('leases', leaseField, '/activate')} />}
    <Action title="Lập biên bản bàn giao" fields={[leaseOptions(active), select('kind','Loại biên bản',[['IN','Nhận phòng'],['OUT','Trả phòng']]), d('date','Ngày bàn giao'), field('condition','Tình trạng'), field('inventory','Tài sản'), n('electric','Chỉ số điện'), n('water','Chỉ số nước'), field('notes','Ghi chú','text',true)]} submit={scoped('leases', leaseField, '/handovers')} />
  </div>
  if (tab === 'Điện nước' && operations) return <div className="forms">
    {owner && <Action title="Thêm đơn giá" fields={[property, select('serviceType','Loại',[['ELECTRICITY','Điện'],['WATER','Nước'],['SERVICE','Dịch vụ']]), field('serviceName','Tên đơn giá'), field('unit','Đơn vị'), n('unitPrice','Đơn giá (đ)'), d('effectiveFrom','Hiệu lực từ')]} submit={scoped('properties', propertyField, '/rates')} />}
    <Action title="Ghi chỉ số" fields={[rooms, field('billingPeriod','Kỳ (YYYY-MM)'), n('electricOld','Điện đầu kỳ'), n('electricNew','Điện cuối kỳ'), n('waterOld','Nước đầu kỳ'), n('waterNew','Nước cuối kỳ')]} submit={scoped('rooms', 'roomId', '/readings')} />
  </div>
  if (tab === 'Hóa đơn & thanh toán' && billing) return <Action title="Phát hành hóa đơn" fields={[leaseOptions(active), field('billingPeriod','Kỳ (YYYY-MM)'), d('dueDate','Hạn thanh toán')]} submit={scoped('leases', leaseField, '/invoices')} />
  if (tab === 'Tiền cọc' && owner) return <div className="forms">
    <Action title="Ghi cọc đã nhận" fields={[leaseOptions(active), n('amount','Thực nhận'), field('reason','Căn cứ')]} submit={scoped('leases', leaseField, '/deposit')} />
    {chosen && active.includes(chosen) && <Action title={'Chốt quyết toán phòng ' + chosen.room.roomCode} fields={[
      n('deduction','Khấu trừ'), n('debtOffset','Bù công nợ'), field('reason','Căn cứ khấu trừ và trả phòng'),
      select('invoiceId','Hóa đơn bù nợ',invoices.filter(row => row.leaseId === chosen.id && Number(row.remainingAmount) > 0).map(row => [row.id, row.billingPeriod]),true),
    ]} submit={values => write('leases/' + chosen.id + '/settlement', values)} />}
  </div>
  if (tab === 'Cài đặt') return <p>Vai trò tài khoản hiện tại · {{ OWNER: 'Chủ trọ', STAFF: 'Nhân viên', ACCOUNTANT: 'Kế toán' }[actor.role]}</p>
  return null
}

