'use client'

import { useEffect, useRef, useState } from 'react'
import { Action, api, field, vnd } from './shared'
import type { Overview } from './quan-ly/dashboard'

type Booking = {id:string;status:string;kind:string;note:string;visitDate:string|null;room:{roomCode:string;property:{name:string;address:string}}}
type Room = {id:string;roomCode:string;baseRentPrice:string;maxOccupants:number;status:string;listingTitle?:string|null;floorArea:number|null;listingStatus?:string;amenities:string|null;property:{name:string;address:string};images:{id:string;alt:string;isPrimary:boolean}[]}
type AppData = { rooms:Room[]; bookings:Booking[]; maintenance:{id:string;title:string;status:string}[]; application:{status:string}|null }
type ManagerData = {rooms:Room[];bookings:(Booking & {user:{fullName:string}})[];maintenance:{id:string;title:string;status:string;leaseId:string;assigneeId:string|null;lease:{room:{propertyId:string}}}[];staff:{propertyId:string;user:{id:string;fullName:string}}[];payments:{amount:string;confirmedAt:string}[]}

export function PortalSection({tab,role,overview,refresh,navigate}:{tab:string;role:'user'|'manager';overview:Overview;refresh:()=>Promise<void>;navigate:(section:string)=>void}) {
  const [data,setData]=useState<AppData|ManagerData>()
  const [message,setMessage]=useState('')
  const [thread, setThread] = useState('')
  const [busy,setBusy]=useState(false)
  async function load() {
    setBusy(true)
    setMessage('')
    try {
      setData(await api<AppData|ManagerData>(role === 'user' ? 'v10/user' : 'v10/manager'))
    } catch (error) {
      setMessage((error as Error).message)
    } finally { setBusy(false) }
  }
  useEffect(() => {
    if (['Yêu cầu của tôi', 'Phản hồi', 'Trao đổi', 'Yêu cầu thuê', 'Bảo trì', 'Đăng phòng'].includes(tab)) void load()
  }, [tab])
  const feedback = <>{busy && <p role="status">Đang tải…</p>}{message && <p role="alert" className="error">{message}</p>}</>
  if (tab==='Tìm phòng' && role==='user') return <RoomGallery onRequests={() => navigate('Yêu cầu của tôi')} />
  if (role === 'user' && ['Yêu cầu của tôi', 'Phản hồi', 'Trao đổi'].includes(tab)) {
    const account = data as AppData | undefined
    const bookings = account?.bookings ?? []
    const selected = bookings.find(item => item.id === thread) ?? bookings[0]
    if (tab === 'Trao đổi') return <>{feedback}<div className="booking-inbox">
      {selected ? <BookingThread key={selected.id} booking={selected} /> : <section className="card">Chưa có yêu cầu để trao đổi.</section>}
      <section className="card"><h2>Yêu cầu liên quan</h2>{bookings.map(item => <div className="booking-thread-link" key={item.id}>
        <span>{item.room.roomCode} · {stateLabel(item.status)}</span>
        <button className="ghost" aria-pressed={selected?.id === item.id} onClick={() => setThread(item.id)}>Mở</button>
      </div>)}</section>
    </div></>
    const visible = tab === 'Phản hồi' ? bookings.filter(item => item.status !== 'PENDING') : bookings
    return <>{feedback}
      {account && !visible.length && <section className="card">{tab === 'Phản hồi' ? 'Chưa có phản hồi từ quản lý khu trọ.' : 'Bạn chưa gửi yêu cầu nào.'}</section>}
      {visible.map(item => <article key={item.id} className="card booking-summary">
        <span className="rental-badge">{stateLabel(item.status)}</span>
        <h2>{item.room.roomCode} · {item.room.property.name}</h2>
        <p>{item.room.property.address}</p>
        <p>{item.kind === 'RENT' ? 'Thuê phòng' : 'Xem phòng'}{item.visitDate ? ' · ' + dateLabel(item.visitDate) : ''}</p>
        <p>{item.note}</p>
        {item.status === 'APPROVED' && <Action title="Xác nhận yêu cầu" button="Xác nhận" submit={async () => { await api('v10/user/bookings/' + item.id + '/confirm', '', {}); await load() }} />}
        <button className="ghost" aria-expanded={thread === item.id} onClick={() => setThread(thread === item.id ? '' : item.id)}>Trao đổi</button>
        {thread === item.id && <BookingThread booking={item} />}
      </article>)}
      {tab === 'Yêu cầu của tôi' && (account?.application ? <p>Đơn đăng ký chủ trọ · {stateLabel(account.application.status)}</p> : <Action title="Đăng ký làm chủ trọ" fields={[field('reason','Thông tin khu trọ')]} submit={async value=>{await api('v10/owner-applications','',value);await load()}}/>)}
    </>
  }
  if(role==='user'&&tab==='Bảo trì') {
    const d=data as AppData|undefined
    return <section className="card"><h2>Báo sự cố</h2>{feedback}
      {overview.leases.filter(l=>l.status==='ACTIVE').map(lease=><Action key={lease.id} title={'Phòng '+lease.room.roomCode+' · Gửi yêu cầu'} fields={[field('title','Sự cố'),field('description','Mô tả')]} submit={async value=>{await api('v10/user/leases/'+lease.id+'/maintenance','',value);await load()}}/>)}
      {d?.maintenance.map(item=><p key={item.id}>{item.title} · {stateLabel(item.status)}</p>)}
    </section>
  }
  if(role==='manager'&&(tab==='Đăng phòng'||tab==='Yêu cầu thuê'||tab==='Bảo trì')) {
    const d=data as ManagerData|undefined
    return <section className="card"><h2>{tab}</h2>{feedback}
      {tab==='Đăng phòng'&&d?.rooms.map(room=><article key={room.id}><h3>{room.roomCode} · {room.property.address}</h3><p>Trạng thái niêm yết: {stateLabel(room.listingStatus ?? 'DRAFT')}</p>
        <ListingPhotos room={room} />
        <Action title="Thông tin tin đăng" button="Gửi duyệt tin phòng" fields={[
          { ...field('listingTitle', 'Tiêu đề tin', 'text', true), value: room.listingTitle ?? '' },
          { ...field('floorArea', 'Diện tích (m²)', 'number'), value: String(room.floorArea ?? '') },
          { ...field('amenities', 'Tiện nghi', 'text', true), value: room.amenities ?? '' },
        ]} submit={async value => { await api('v10/manager/rooms/' + room.id + '/listing', '', value); await load() }} />
      </article>)}
      {tab==='Yêu cầu thuê'&&d?.bookings.map(row=><article key={row.id} className="card">{row.room.roomCode} · {row.user.fullName} · {stateLabel(row.status)}<button onClick={async()=>{await api('v10/manager/bookings/'+row.id,'',{approve:true});await load()}}>Duyệt</button><button onClick={async()=>{await api('v10/manager/bookings/'+row.id,'',{approve:false});await load()}}>Từ chối</button><button className="ghost" aria-expanded={thread === row.id} onClick={() => setThread(thread === row.id ? '' : row.id)}>Trao đổi</button>{thread === row.id && <BookingThread booking={row} />}</article>)}
      {tab==='Bảo trì' && d && !d.maintenance.length && <p>Chưa có công việc bảo trì trong phạm vi.</p>}
      {tab==='Bảo trì'&&d?.maintenance.map(row=><article key={row.id} className="card">
        <h3>{row.title}</h3><p>{stateLabel(row.status)}</p>
        {row.status!=='DONE'&&<>
          <Action title="Cập nhật tiến độ" submit={async()=>{await api('v10/manager/maintenance/'+row.id,'',{status:row.status==='OPEN'?'IN_PROGRESS':'DONE'});await load()}}/>
          {d.staff.some(entry=>entry.propertyId===row.lease.room.propertyId) && <Action title="Giao việc" fields={[{key:'assigneeId',label:'Nhân viên',value:row.assigneeId??'',options:d.staff.filter(entry=>entry.propertyId===row.lease.room.propertyId).map(entry=>[entry.user.id,entry.user.fullName])}]} submit={async value=>{await api('v10/manager/maintenance/'+row.id+'/assign','',value);await load()}}/>}
        </>}
      </article>)}
    </section>
  }
  if(role==='manager'&&tab==='Điện nước') return <section className="card"><h2>Chỉ số và ảnh đối chiếu</h2>
    {overview.properties.flatMap(property=>property.rooms).map(room=><Action key={room.id} title={'Phòng '+room.roomCode} fields={[field('billingPeriod','Kỳ hóa đơn (YYYY-MM)'),field('electricOld','Điện đầu kỳ','number'),field('electricNew','Điện cuối kỳ','number'),field('waterOld','Nước đầu kỳ','number'),field('waterNew','Nước cuối kỳ','number'),field('electric','Ảnh công tơ điện','file'),field('water','Ảnh công tơ nước','file')]} submit={async value=>{const form=new FormData();Object.entries(value).forEach(([k,v])=>form.append(k,v as string|Blob));const response=await fetch('/api/v10/manager/rooms/'+room.id+'/meter-evidence',{method:'POST',headers:{'X-RentFlow-Web':'1'},body:form});if(!response.ok)throw new Error((await response.json()).message);await refresh()}}/>)}
  </section>
  return null
}

function stateLabel(value: string) {
  const names: Record<string, string> = {
    DRAFT: 'Nháp', PENDING: 'Chờ duyệt', PUBLISHED: 'Đã đăng', REJECTED: 'Từ chối',
    APPROVED: 'Đã duyệt', CONFIRMED: 'Đã xác nhận',
    OPEN: 'Mới', IN_PROGRESS: 'Đang xử lý', DONE: 'Hoàn thành',
  }
  return names[value] ?? value
}

function ListingPhotos({ room }: { room: Room }) {
  const [open, setOpen] = useState(false)
  if (!room.images.length) return <p>Phòng này chưa có ảnh.</p>
  return <div>
    <button className="ghost" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Ẩn ảnh phòng' : 'Xem ảnh phòng'}</button>
    {open && <div className="portal-pictures">{room.images.map(photo =>
      <ListingPhoto key={photo.id} roomId={room.id} photo={photo} />
    )}</div>}
  </div>
}

function ListingPhoto({ roomId, photo }: { roomId: string; photo: Room['images'][number] }) {
  const [src, setSrc] = useState('')
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    const request = new AbortController()
    let url = ''
    void fetch('/api/v10/listing-photos/' + roomId + '/' + photo.id, {
      headers: { 'X-RentFlow-Web': '1' }, signal: request.signal,
    }).then(async response => {
      if (!response.ok) throw new Error('Không tải được ảnh phòng.')
      const blob = await response.blob()
      if (request.signal.aborted) return
      url = URL.createObjectURL(blob)
      setSrc(url)
    }).catch(() => { if (!request.signal.aborted) setFailed(true) })
    return () => { request.abort(); if (url) URL.revokeObjectURL(url) }
  }, [roomId, photo.id])
  if (!src) return <p role={failed ? 'alert' : 'status'}>{failed ? 'Không tải được ảnh phòng.' : 'Đang tải ảnh…'}</p>
  return <img src={src} alt={photo.alt || 'Ảnh phòng'} />
}

const dateLabel = (value: string) => new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(value))

function BookingThread({ booking }: { booking: Booking }) {
  type Message = { id: string; body: string; createdAt: string; author: { fullName: string } }
  const [messages, setMessages] = useState<Message[]>()
  const [error, setError] = useState('')
  const path = 'v10/bookings/' + booking.id + '/messages'
  useEffect(() => {
    let active = true
    void api<Message[]>(path).then(result => { if (active) setMessages(result) }).catch(failure => { if (active) setError(failure.message) })
    return () => { active = false }
  }, [path])
  return <section className="card booking-conversation">
    <h2>Trao đổi về {booking.room.roomCode}</h2>
    {error && <p role="alert">{error}</p>}
    {!messages && !error && <p role="status">Đang tải tin nhắn…</p>}
    {messages && !messages.length && <p>Chưa có tin nhắn. Bạn có thể hỏi thêm hoặc hẹn lịch xem phòng.</p>}
    {messages?.map(message => <article key={message.id}>
      <strong>{message.author.fullName}</strong> <small>{dateLabel(message.createdAt)}</small>
      <p>{message.body}</p>
    </article>)}
    {messages && <Action title="Tin nhắn mới" fields={[field('message','Nội dung trao đổi')]} button="Gửi" submit={async value => {
      const saved = await api<Message>(path, '', value)
      setMessages(previous => [...(previous ?? []), saved])
    }} />}
  </section>
}

function RoomGallery({ onRequests }: { onRequests: () => void }) {
  const [rooms, setRooms] = useState<Room[]>()
  const [search, setSearch] = useState('')
  const [area, setArea] = useState('')
  const [max, setMax] = useState('')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<{ room: Room; mode: 'photos' | 'request' }>()
  const [submitted, setSubmitted] = useState(false)
  const modal = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    let active = true
    void api<Room[]>('v10/listings?catalogue=1').then(result => { if (active) setRooms(result) }).catch(failure => { if (active) setError(failure.message) })
    return () => { active = false }
  }, [])
  useEffect(() => {
    if (selected && !modal.current?.open) modal.current?.showModal()
  }, [selected])
  const fold = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/đ/g, 'd')
  const title = (room: Room) => room.listingTitle ?? (room.roomCode + ' · ' + room.property.name)
  const district = (address: string) => address.match(/Bình Thạnh|Phú Nhuận/i)?.[0] ?? 'Khu vực khác'
  const areas = [...new Set((rooms ?? []).map(room => district(room.property.address)))]
  const statusLabels: Record<string, string> = { AVAILABLE: 'Còn trống', OCCUPIED: 'Đang thuê', MAINTENANCE: 'Bảo trì' }
  const visible = rooms?.filter(room => (!area || district(room.property.address) === area)
    && (!status || room.status === status) && (!max || Number(room.baseRentPrice) <= Number(max))
    && fold([title(room), room.property.address, room.amenities].join(' ')).includes(fold(search.trim())))
  function open(room: Room, mode: 'photos' | 'request') {
    setSubmitted(false)
    setSelected({ room, mode })
  }
  return <section className="rental-gallery">
    <p className="rental-subtitle">Tìm nhà trọ theo khu vực, gửi yêu cầu và theo dõi phản hồi.</p>
    <div className="rental-filters">
      <input aria-label="Tìm phòng, tuyến đường, khu vực" placeholder="Tìm phòng, tuyến đường, khu vực…" value={search} onChange={event => setSearch(event.target.value)} />
      <select aria-label="Khu vực" value={area} onChange={event => setArea(event.target.value)}>
        <option value="">Tất cả khu vực</option>{areas.map(item => <option key={item}>{item}</option>)}
      </select>
      <select aria-label="Trạng thái phòng" value={status} onChange={event => setStatus(event.target.value)}>
        <option value="">Mọi trạng thái</option>{Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select>
      <input aria-label="Giá tối đa mỗi tháng" placeholder="Giá tối đa (VNĐ)" type="number" min="0" value={max} onChange={event => setMax(event.target.value)} />
    </div>
    {error && <p role="alert" className="error">{error}</p>}
    {!rooms && !error && <p role="status">Đang tải phòng…</p>}
    {visible && !visible.length && <p>Không tìm thấy phòng phù hợp.</p>}
    <div className="rental-grid">{visible?.map(room => <article key={room.id} className="rental-card">
      {room.images.length > 0 ? <button className="rental-cover" aria-label="Xem ảnh phòng" onClick={() => open(room, 'photos')}>
        <ListingPhoto roomId={room.id} photo={room.images[0]} />
        <span>{room.images.length} ảnh phòng · Bấm để xem</span>
      </button> : <div className="rental-cover rental-placeholder"><span>Chưa có ảnh · {district(room.property.address)}</span><b aria-hidden="true">⌂</b></div>}
      <div className="rental-card-body">
        <div className="rental-location"><small>{room.property.address}</small><span className="rental-badge">{statusLabels[room.status] ?? room.status}</span></div>
        <h3>{title(room)}</h3>
        <p>{room.roomCode} · {room.floorArea ?? '—'} m²{room.amenities ? ' · ' + room.amenities : ''}</p>
        <strong className="rental-price">{vnd(room.baseRentPrice)}<small>/tháng</small></strong>
        <footer><small>{room.property.name}</small><button disabled={room.status !== 'AVAILABLE'} onClick={() => open(room, 'request')}>Gửi yêu cầu xem/đặt phòng</button></footer>
      </div>
    </article>)}</div>
    <dialog ref={modal} className="rental-dialog" aria-label={selected ? title(selected.room) : undefined} onClose={() => setSelected(undefined)}>
      {selected && <>
        <header><h2>{title(selected.room)}</h2><button className="ghost" onClick={() => modal.current?.close()}>Đóng</button></header>
        {selected.mode === 'photos' ? <div className="rental-photo-list">{selected.room.images.map(photo => <ListingPhoto key={photo.id} roomId={selected.room.id} photo={photo} />)}</div>
          : submitted ? <div><p role="status">Đã gửi yêu cầu.</p><button onClick={() => { modal.current?.close(); onRequests() }}>Xem yêu cầu của tôi</button></div>
          : <Action title="Gửi yêu cầu" button="Gửi yêu cầu" fields={[{key:'kind',label:'Hình thức',value:'VIEW',options:[['VIEW','Đặt lịch xem'],['RENT','Đề nghị thuê']]},{key:'visitDate',label:'Ngày dự kiến',type:'date',optional:true},{key:'note',label:'Lời nhắn'}]} submit={async value => {
            await api('v10/listings/' + selected.room.id + '/bookings', '', value)
            setSubmitted(true)
          }} />}
      </>}
    </dialog>
  </section>
}
