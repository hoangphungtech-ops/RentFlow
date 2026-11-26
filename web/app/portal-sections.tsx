'use client'

import { useEffect, useState } from 'react'
import { Action, api, field, vnd } from './shared'
import type { Overview } from './quan-ly/dashboard'

type Room = {id:string;roomCode:string;baseRentPrice:string;maxOccupants:number;floorArea:number|null;listingStatus?:string;amenities:string|null;property:{name:string;address:string};images:{id:string;alt:string;isPrimary:boolean}[]}
type AppData = { rooms:Room[]; bookings:{id:string;status:string;kind:string;room:{roomCode:string;property:{name:string}}}[]; maintenance:{id:string;title:string;status:string}[]; application:{status:string}|null }
type ManagerData = {rooms:Room[];bookings:{id:string;status:string;kind:string;user:{fullName:string};room:{roomCode:string;property:{name:string}}}[];maintenance:{id:string;title:string;status:string;leaseId:string;assigneeId:string|null;lease:{room:{propertyId:string}}}[];staff:{propertyId:string;user:{id:string;fullName:string}}[];payments:{amount:string;confirmedAt:string}[]}

export function PortalSection({tab,role,overview,refresh}:{tab:string;role:'user'|'manager';overview:Overview;refresh:()=>Promise<void>}) {
  const [data,setData]=useState<AppData|ManagerData>()
  const [message,setMessage]=useState('')
  const [area,setArea]=useState('')
  const [maxRent,setMaxRent]=useState('')
  const [busy,setBusy]=useState(false)
  async function load() {
    setBusy(true)
    setMessage('')
    const query = new URLSearchParams()
    if (area.trim()) query.set('area', area.trim())
    if (maxRent) query.set('max', maxRent)
    try {
      if (role === 'user' && tab === 'Tìm phòng') {
        const rooms = await api<Room[]>('v10/listings?' + query)
        setData({ rooms, bookings: [], maintenance: [], application: null })
      } else {
        setData(await api<AppData|ManagerData>(role === 'user' ? 'v10/user' : 'v10/manager'))
      }
    } catch (error) {
      setMessage((error as Error).message)
    } finally { setBusy(false) }
  }
  useEffect(() => {
    if (['Tìm phòng', 'Yêu cầu thuê', 'Bảo trì', 'Đăng phòng'].includes(tab)) void load()
  }, [tab])
  const feedback = <>{busy && <p role="status">Đang tải…</p>}{message && <p role="alert" className="error">{message}</p>}</>
  if (tab==='Tìm phòng' && role==='user') return <section className="card">
    <h2>Phòng đang nhận yêu cầu</h2>
    <form className="fields" onSubmit={e=>{e.preventDefault();void load()}}><label>Khu vực hoặc tuyến đường<input value={area} onChange={e=>setArea(e.target.value)} placeholder="Bình Thạnh, Nguyễn Xí" /></label><label>Giá tối đa (VNĐ/tháng)<input type="number" min="0" max="9999999999" step="1" value={maxRent} onChange={e=>setMaxRent(e.target.value)} /></label><button disabled={busy}>Tìm phòng</button></form>
    {feedback}
    {data && !data.rooms.length && !busy && <p>Không tìm thấy phòng phù hợp.</p>}
    {(data as AppData|undefined)?.rooms.map(room=><article className="card" key={room.id}><h3>{room.roomCode} · {room.property.name}</h3><p>{room.property.address} · {room.floorArea??'—'} m²</p><p>{room.amenities}</p><strong>{vnd(room.baseRentPrice)}/tháng</strong>
      <ListingPhotos room={room} />
      <Action title="Gửi yêu cầu" fields={[{key:'kind',label:'Hình thức',options:[['VIEW','Đặt lịch xem'],['RENT','Đề nghị thuê']]},{key:'visitDate',label:'Ngày dự kiến',type:'date',optional:true},{key:'note',label:'Lời nhắn'}]} submit={async value=>{await api('v10/listings/'+room.id+'/bookings','',value)}}/>
    </article>)}
  </section>
  if (role==='user' && tab==='Yêu cầu thuê') {
    const d=data as AppData|undefined
    return <section className="card"><h2>Yêu cầu và quyền chủ trọ</h2>{feedback}
      {data && !busy && !d?.bookings.length && <p>Chưa có yêu cầu.</p>}{d?.bookings.map(row=><p key={row.id}>{row.room.roomCode} · {row.kind==='RENT'?'Thuê phòng':'Xem phòng'} · {stateLabel(row.status)}
        {row.status==='APPROVED'&&<button onClick={async()=>{await api('v10/user/bookings/'+row.id+'/confirm','',{});await load()}}>Xác nhận</button>}</p>)}
      {d?.application?<p>Đơn đăng ký chủ trọ: {stateLabel(d.application.status)}</p>:<Action title="Đăng ký làm chủ trọ" fields={[field('reason','Thông tin khu trọ')]} submit={async value=>{await api('v10/owner-applications','',value);await load()}}/>}
    </section>
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
          { ...field('floorArea', 'Diện tích (m²)', 'number'), value: String(room.floorArea ?? '') },
          { ...field('amenities', 'Tiện nghi', 'text', true), value: room.amenities ?? '' },
        ]} submit={async value => { await api('v10/manager/rooms/' + room.id + '/listing', '', value); await load() }} />
      </article>)}
      {tab==='Yêu cầu thuê'&&d?.bookings.map(row=><p key={row.id}>{row.room.roomCode} · {row.user.fullName} · {stateLabel(row.status)}<button onClick={async()=>{await api('v10/manager/bookings/'+row.id,'',{approve:true});await load()}}>Duyệt</button><button onClick={async()=>{await api('v10/manager/bookings/'+row.id,'',{approve:false});await load()}}>Từ chối</button></p>)}
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
