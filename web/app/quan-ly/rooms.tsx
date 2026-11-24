'use client'
import { useEffect, useState } from 'react'
import { api, vnd } from '../shared'
import type { Overview } from './page'

type History = {
  leases: { id: string; startDate: string; endDate: string; status: string }[]
  meterReadings: { billingPeriod: string; electricOld: string; electricNew: string; waterOld: string; waterNew: string }[]
}
const day = (value: string) => new Date(value).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })

function RoomHistory({ id, code, statuses, openLease, room, owner, refresh }: {
  id: string; code: string; statuses: Record<string,string>; openLease: (id: string) => void
  room: Overview['properties'][number]['rooms'][number]; owner: boolean; refresh: () => Promise<void>
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
    <h3>Chi tiết phòng</h3><p>Trạng thái phòng: {statuses[room.status]}</p>
    {owner && <RoomStatusControl room={room} refresh={refresh} />}
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

type RoomPhotoInfo = { id: string; alt: string; sizeBytes: number; width: number; height: number; isPrimary: boolean }

export function RoomList({ properties, statuses, openLease, refresh, owner }: {
  properties: Overview['properties']; statuses: Record<string,string>; openLease: (id: string) => void; refresh: () => Promise<void>; owner: boolean
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
        <strong>{room.roomCode}</strong> · {statuses[room.status]} · {vnd(room.baseRentPrice)}/tháng<br />
        Sức chứa: {room.maxOccupants} người · Đang ở (đã bàn giao): {room.occupantCount} người
      </p>{((room.status === 'AVAILABLE' && room.activeLeaseCount > 0) || (room.status === 'OCCUPIED' && room.activeLeaseCount === 0)) &&
        <p role="alert">Trạng thái phòng không khớp với hợp đồng đang giữ phòng. Hãy kiểm tra hồ sơ trước khi lập hợp đồng mới.</p>}
      {owner && <RoomStatusControl room={room} refresh={refresh} />}<RoomGallery roomId={room.id} roomCode={room.roomCode} images={room.images ?? []} refresh={refresh} />
      <RoomHistory id={room.id} code={room.roomCode} statuses={statuses} openLease={openLease} room={room} owner={owner} refresh={refresh} /></div>)}
    </section>)}
  </>
}

function RoomStatusControl({ room, refresh }: { room: Overview['properties'][number]['rooms'][number]; refresh: () => Promise<void> }) {
  const [next, setNext] = useState(room.status)
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)
  useEffect(() => setNext(room.status), [room.status])
  async function save() {
    setMessage('')
    try {
      await api('rooms/' + room.id + '/settings', '', { baseRentPrice: Number(room.baseRentPrice), maxOccupants: room.maxOccupants, status: next })
      setFailed(false); setMessage('Đã cập nhật trạng thái phòng.'); await refresh()
    } catch (error) { setFailed(true); setMessage((error as Error).message) }
  }
  return <div className="room-status-control"><label>Trạng thái phòng<select aria-label={'Trạng thái phòng ' + room.roomCode} value={next} onChange={event => setNext(event.target.value)}>
    <option value="AVAILABLE">Trống</option><option value="OCCUPIED">Đang thuê</option><option value="MAINTENANCE">Bảo trì</option>
  </select></label><button type="button" disabled={next === room.status} onClick={() => void save()}>Cập nhật trạng thái</button>
  {message && <p role={failed ? 'alert' : 'status'}>{message}</p>}</div>
}

function RoomPhoto({ roomId, image, roomCode }: { roomId: string; image: RoomPhotoInfo; roomCode: string }) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    let active = true
    let objectUrl = ''
    void fetch('/api/rooms/' + roomId + '/images/' + image.id + '/file', {
      headers: { 'X-RentFlow-Web': '1' },
      signal: AbortSignal.timeout(12000),
    }).then(async response => {
      if (!response.ok) throw new Error('Không tải được ảnh phòng')
      objectUrl = URL.createObjectURL(await response.blob())
      if (active) setSrc(objectUrl)
      else URL.revokeObjectURL(objectUrl)
    }).catch(() => { if (active) setSrc('') })
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [roomId, image.id])
  return src ? <img className="room-photo" src={src} loading="lazy" alt={image.alt || 'Ảnh phòng ' + roomCode} /> :
    <span className="room-photo room-photo-loading" role="status">Đang tải ảnh…</span>
}

function RoomGallery({ roomId, roomCode, images, refresh }: {
  roomId: string; roomCode: string; images: RoomPhotoInfo[]; refresh: () => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)
  const [preview, setPreview] = useState('')
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  async function upload(file: File | undefined, imageId?: string) {
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setFailed(true); setMessage('Chỉ nhận ảnh JPEG, PNG hoặc WebP.'); return }
    if (file.size > 8 * 1024 * 1024) { setFailed(true); setMessage('Ảnh gốc tối đa 8 MB.'); return }
    if (!imageId && images.length >= 12) { setFailed(true); setMessage('Mỗi phòng lưu tối đa 12 ảnh.'); return }
    setBusy(true); setMessage('')
    setPreview(URL.createObjectURL(file))
    try {
      const form = new FormData()
      form.append('image', file)
      const response = await fetch('/api/rooms/' + roomId + '/images' + (imageId ? '/' + imageId : ''), {
        method: imageId ? 'PUT' : 'POST',
        headers: { 'X-RentFlow-Web': '1' },
        body: form,
        signal: AbortSignal.timeout(30000),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error([body?.message ?? 'Không thể lưu ảnh.'].flat().join(' · '))
      setFailed(false); setMessage(imageId ? 'Đã thay ảnh.' : 'Đã tải ảnh lên.'); setPreview('')
      await refresh()
    } catch (error) {
      setFailed(true); setMessage(error instanceof Error ? error.message : 'Không thể lưu ảnh.')
    } finally { setBusy(false) }
  }

  async function setPrimary(imageId: string) {
    setBusy(true); setMessage('')
    try {
      await api('rooms/' + roomId + '/images/' + imageId + '/primary', '', {})
      await refresh(); setFailed(false); setMessage('Đã chọn ảnh đại diện.')
    } catch (error) { setFailed(true); setMessage((error as Error).message) }
    finally { setBusy(false) }
  }

  async function remove(imageId: string) {
    if (!window.confirm('Xóa ảnh phòng ' + roomCode + '?')) return
    setBusy(true); setMessage('')
    try {
      await api('rooms/' + roomId + '/images/' + imageId, '', undefined, 'DELETE')
      await refresh(); setFailed(false); setMessage('Đã xóa ảnh.')
    } catch (error) { setFailed(true); setMessage((error as Error).message) }
    finally { setBusy(false) }
  }

  return <section className="room-gallery" aria-label={'Ảnh phòng ' + roomCode}>
    <h3>Ảnh phòng {roomCode} ({images.length}/12)</h3>
    {preview && <figure className="room-preview"><img className="room-photo" src={preview} alt={'Xem trước ảnh phòng ' + roomCode} /><figcaption>Xem trước ảnh được chọn</figcaption></figure>}
    <div className="room-gallery-grid">
      {images.map(image => <figure className="room-image-card" data-room-image-id={image.id} key={image.id}>
        <RoomPhoto roomId={roomId} image={image} roomCode={roomCode} />
        <figcaption>{image.isPrimary ? <strong>Ảnh đại diện</strong> : <span>{image.width} × {image.height} · {(image.sizeBytes / 1024).toFixed(0)} KB</span>}
          <label className="image-action">Thay ảnh
            <input aria-label={'Thay ảnh phòng ' + roomCode} type="file" accept="image/jpeg,image/png,image/webp" disabled={busy}
              onChange={event => { void upload(event.currentTarget.files?.[0], image.id); event.currentTarget.value = '' }} />
          </label>
          {!image.isPrimary && <button type="button" className="ghost" disabled={busy} onClick={() => void setPrimary(image.id)}>Đặt ảnh đại diện</button>}
          <button type="button" className="ghost" disabled={busy} onClick={() => void remove(image.id)}>Xóa ảnh</button>
        </figcaption>
      </figure>)}
    </div>
    {images.length < 12 && <label className="image-action">Thêm ảnh phòng {roomCode} · JPEG, PNG hoặc WebP, tối đa 8 MB
      <input aria-label={'Thêm ảnh phòng ' + roomCode} type="file" accept="image/jpeg,image/png,image/webp" disabled={busy}
        onChange={event => { void upload(event.currentTarget.files?.[0]); event.currentTarget.value = '' }} />
    </label>}
    {message && <p role={failed ? 'alert' : 'status'}>{message}</p>}
  </section>
}
