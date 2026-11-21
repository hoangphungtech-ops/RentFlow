'use client'
import { useState } from 'react'
import { api, vnd } from '../shared'
import type { Overview } from './page'

type History = {
  leases: { id: string; startDate: string; endDate: string; status: string }[]
  meterReadings: { billingPeriod: string; electricOld: string; electricNew: string; waterOld: string; waterNew: string }[]
}
const day = (value: string) => new Date(value).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })

function RoomHistory({ id, code, statuses, openLease }: {
  id: string; code: string; statuses: Record<string,string>; openLease: (id: string) => void
}) {
  const [history, setHistory] = useState<History>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  async function load() {
    setError(''); setLoading(true)
    try { setHistory(await api<History>('rooms/' + id + '/history')) }
    catch (failure) { setError((failure as Error).message) }
    finally { setLoading(false) }
  }
  return <details onToggle={event => { if (event.currentTarget.open && !loading) void load() }}>
    <summary>Lịch sử phòng {code}</summary>
    {loading && <p role="status">Đang tải lịch sử…</p>}
    {error && <p role="alert">{error} <button onClick={() => void load()}>Thử lại</button></p>}
    {history && <>
      <h3>Hợp đồng gần đây</h3>
      {history.leases.length ? <ul>{history.leases.map(lease => <li key={lease.id}>
        <button className="ghost" onClick={() => openLease(lease.id)}>{statuses[lease.status]} · {day(lease.startDate)} – {day(lease.endDate)}</button>
      </li>)}</ul> : <p>Chưa có hợp đồng.</p>}
      <h3>Chỉ số điện nước gần đây</h3>
      {history.meterReadings.length ? <ul>{history.meterReadings.map(reading => <li key={reading.billingPeriod}>
        {reading.billingPeriod} · Điện {reading.electricOld} → {reading.electricNew} · Nước {reading.waterOld} → {reading.waterNew}
      </li>)}</ul> : <p>Chưa có chỉ số.</p>}
    </>}
  </details>
}

export function RoomList({ properties, statuses, openLease }: {
  properties: Overview['properties']; statuses: Record<string,string>; openLease: (id: string) => void
}) {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const matches = properties.map(property => ({ ...property, rooms: property.rooms.filter(room =>
    (!status || room.status === status) &&
    (room.roomCode + ' ' + property.name).toLocaleLowerCase('vi').includes(search.trim().toLocaleLowerCase('vi')),
  ) })).filter(property => property.rooms.length)
  return <>
    <label>Tìm phòng<input value={search} onChange={event => setSearch(event.target.value)} placeholder="Mã phòng hoặc tên khu" /></label>
    <label>Trạng thái phòng<select aria-label="Trạng thái phòng" value={status} onChange={event => setStatus(event.target.value)}>
      <option value="">Tất cả trạng thái</option>
      {['AVAILABLE','OCCUPIED','MAINTENANCE'].map(value => <option key={value} value={value}>{statuses[value]}</option>)}
    </select></label>
    {!matches.length && <p role="status">Không có phòng phù hợp.</p>}
    {matches.map(property => <section key={property.id} className="card"><h2>{property.name}</h2><p>{property.address}</p>
      {property.rooms.map(room => <div key={room.id}><p>
        <strong>{room.roomCode}</strong> · {statuses[room.status]} · {vnd(room.baseRentPrice)} · {room.maxOccupants} người
      </p><RoomHistory id={room.id} code={room.roomCode} statuses={statuses} openLease={openLease} /></div>)}
    </section>)}
  </>
}
