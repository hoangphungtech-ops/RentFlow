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
  const [photos,setPhotos]=useState<Record<string,string[]>>({})
  async function load() {
    const value= role==='user' && tab==='Tìm phòng'
      ? await api<Room[]>('v10/listings'+(area?'?area='+encodeURIComponent(area):''))
      : await api<AppData|ManagerData>(role==='user'?'v10/user':'v10/manager')
    setData(role==='user'&&tab==='Tìm phòng'?{rooms:value as Room[],bookings:[],maintenance:[],application:null}:value as AppData|ManagerData)
  }
  useEffect(()=>{
    if (['Tìm phòng', 'Yêu cầu thuê', 'Bảo trì', 'Đăng phòng'].includes(tab)) void load().catch(error=>setMessage(error.message))
  },[tab])
  async function getPhotos(room:Room) {
    const urls=await Promise.all(room.images.map(async photo=>{
      const response=await fetch('/api/v10/listing-photos/'+room.id+'/'+photo.id,{headers:{'X-RentFlow-Web':'1'}})
      if(!response.ok)throw new Error('Không tải được ảnh phòng.')
      return URL.createObjectURL(await response.blob())
    }))
    setPhotos(old=>({...old,[room.id]:urls}))
  }
  useEffect(()=>()=>Object.values(photos).flat().forEach(URL.revokeObjectURL),[photos])
  if (tab==='Tìm phòng' && role==='user') return <section className="card">
    <h2>Phòng đang nhận yêu cầu</h2>
    <form className="fields" onSubmit={e=>{e.preventDefault();void load()}}><label>Khu vực hoặc tuyến đường<input value={area} onChange={e=>setArea(e.target.value)} placeholder="Bình Thạnh, Nguyễn Xí" /></label><button>Tìm phòng</button></form>
    {(data as AppData|undefined)?.rooms.map(room=><article className="card" key={room.id}><h3>{room.roomCode} · {room.property.name}</h3><p>{room.property.address} · {room.floorArea??'—'} m²</p><p>{room.amenities}</p><strong>{vnd(room.baseRentPrice)}/tháng</strong>
      {!photos[room.id]&&<button className="ghost" onClick={()=>getPhotos(room).catch(e=>setMessage(e.message))}>Xem ảnh phòng</button>}
      <div className="portal-pictures">{(photos[room.id]??[]).map((src,i)=><img key={src} src={src} alt={'Ảnh phòng '+(i+1)}/>)}</div>
      <Action title="Gửi yêu cầu" fields={[{key:'kind',label:'Hình thức',options:[['VIEW','Đặt lịch xem'],['RENT','Đề nghị thuê']]},{key:'visitDate',label:'Ngày dự kiến',type:'date',optional:true},{key:'note',label:'Lời nhắn'}]} submit={async value=>{await api('v10/listings/'+room.id+'/bookings','',value);setMessage('Đã gửi yêu cầu.')}}/>
    </article>)}
    {message&&<p role="status">{message}</p>}
  </section>
  if (role==='user' && tab==='Yêu cầu thuê') {
    const d=data as AppData|undefined
    return <section className="card"><h2>Yêu cầu và quyền chủ trọ</h2>
      {d?.bookings.map(row=><p key={row.id}>{row.room.roomCode} · {row.kind==='RENT'?'Thuê phòng':'Xem phòng'} · {row.status}
        {row.status==='APPROVED'&&<button onClick={async()=>{await api('v10/user/bookings/'+row.id+'/confirm','',{});await load()}}>Xác nhận</button>}</p>)}
      {d?.application?<p>Đơn đăng ký chủ trọ: {d.application.status}</p>:<Action title="Đăng ký làm chủ trọ" fields={[field('reason','Thông tin khu trọ')]} submit={async value=>{await api('v10/owner-applications','',value);await load()}}/>}
    </section>
  }
  if(role==='user'&&tab==='Bảo trì') {
    const d=data as AppData|undefined
    return <section className="card"><h2>Báo sự cố</h2>
      {overview.leases.filter(l=>l.status==='ACTIVE').map(lease=><Action key={lease.id} title={'Phòng '+lease.room.roomCode+' · Gửi yêu cầu'} fields={[field('title','Sự cố'),field('description','Mô tả')]} submit={async value=>{await api('v10/user/leases/'+lease.id+'/maintenance','',value);await load()}}/>)}
      {d?.maintenance.map(item=><p key={item.id}>{item.title} · {item.status}</p>)}
    </section>
  }
  if(role==='manager'&&(tab==='Đăng phòng'||tab==='Yêu cầu thuê'||tab==='Bảo trì')) {
    const d=data as ManagerData|undefined
    return <section className="card"><h2>{tab}</h2>
      {tab==='Đăng phòng'&&d?.rooms.map(room=><article key={room.id}><h3>{room.roomCode} · {room.property.address}</h3><p>Trạng thái niêm yết: {room.listingStatus??'Nháp'}</p>
        <button onClick={async()=>{const floorArea=Number(prompt('Diện tích m²','24'));if(!floorArea)return;await api('v10/manager/rooms/'+room.id+'/listing','',{floorArea,amenities:room.amenities??'Wi-Fi, gác'});await load()}}>Gửi duyệt tin phòng</button>
        <div className="portal-pictures">{room.images.map(photo=><button key={photo.id} onClick={async()=>{const res=await fetch('/api/v10/listing-photos/'+room.id+'/'+photo.id,{headers:{'X-RentFlow-Web':'1'}});const url=URL.createObjectURL(await res.blob());setPhotos(x=>({...x,[room.id]:[...(x[room.id]??[]),url]}))}}>Ảnh · {photo.alt}</button>)}{(photos[room.id]??[]).map(src=><img key={src} src={src} alt="Ảnh phòng"/>)}</div>
      </article>)}
      {tab==='Yêu cầu thuê'&&d?.bookings.map(row=><p key={row.id}>{row.room.roomCode} · {row.user.fullName} · {row.status}<button onClick={async()=>{await api('v10/manager/bookings/'+row.id,'',{approve:true});await load()}}>Duyệt</button><button onClick={async()=>{await api('v10/manager/bookings/'+row.id,'',{approve:false});await load()}}>Từ chối</button></p>)}
      {tab==='Bảo trì'&&d?.maintenance.map(row=><article key={row.id} className="card">
        <h3>{row.title}</h3><p>{row.status}</p>
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
  if(role==='manager'&&tab==='Hóa đơn & thanh toán')return <section className="card"><h2>Đối soát</h2>{overview.invoices.map(invoice=><p key={invoice.id}>{invoice.billingPeriod} · {vnd(invoice.totalAmount)} · Đã xác nhận {vnd(invoice.paidAmount)} · Còn nợ {vnd(invoice.remainingAmount)}</p>)}</section>
  return null
}
