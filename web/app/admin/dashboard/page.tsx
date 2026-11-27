'use client'

import Link from 'next/link'
import {useEffect,useState} from 'react'
import {useRouter} from 'next/navigation'
import {Action,api,ApiError,select} from '../../shared'
import {PortalGate} from '../../portal-gate'
import {PortalSidebar} from '../../portal-sidebar'

type AdminData={users:{id:string;email:string;fullName:string;role:string;lockedAt:string|null}[];rooms:{id:string;roomCode:string;listingStatus:string;baseRentPrice:string;property:{name:string;address:string};images:{id:string;alt:string}[]}[];properties:{id:string;name:string;address:string;_count:{rooms:number}}[];applications:{id:string;status:string;reason:string;user:{fullName:string;email:string}}[];auditTrail:{id:string;action:string;createdAt:string}[]}
function Admin() {
 const [viewer,setViewer]=useState('');const [error,setError]=useState('')
 const [data,setData]=useState<AdminData>();const [tab,setTab]=useState('Tổng quan');const router=useRouter()
 async function refresh(){setData(await api<AdminData>('v10/admin'))}
 async function moderateRoom(id:string, approve:boolean) {
   setError('')
   try { await api('v10/admin/rooms/'+id,'',{approve}); await refresh() }
   catch (failure) { setError(failure instanceof Error ? failure.message : 'Không thể cập nhật tin phòng.') }
 }
 useEffect(()=>{
  Promise.all([refresh(),api<{fullName:string}>('v10/me').then(actor=>setViewer(actor.fullName))]).catch(e=>{
   if(e instanceof ApiError&&e.status===401)router.replace('/login');else setError(e.message)
  })
 },[])
 return <div className="workspace">
 <PortalSidebar label="Cổng quản trị hệ thống" sections={['Tổng quan','Tài khoản','Duyệt tin phòng','Đơn chủ trọ','Nhật ký']} active={tab} onSelect={setTab} />
 <div className="workspace-content"><header className="mast"><Link href="/" className="brand">RentFlow</Link><span className="workspace-user">{viewer}</span><button onClick={async()=>{await api('logout','',{}).catch(()=>{});router.replace('/login')}}>Đăng xuất</button></header><main className="shell"><h1>{tab}</h1>{error ? <p className="error" role="alert">{error}</p> : !data && <p role="status">Đang tải…</p>}
 {tab==='Tổng quan'&&<div className="tiles"><article><h2>Tài khoản</h2><strong>{data?.users.length??'…'}</strong><button className="ghost metric-link" onClick={()=>setTab('Tài khoản')}>Xem tài khoản</button></article><article><h2>Tin phòng chờ duyệt</h2><strong>{data?.rooms.filter(room=>room.listingStatus==='PENDING').length??'…'}</strong><button className="ghost metric-link" onClick={()=>setTab('Duyệt tin phòng')}>Xem tin chờ duyệt</button></article><article><h2>Đơn chủ trọ chờ duyệt</h2><strong>{data?.applications.filter(row=>row.status==='PENDING').length??'…'}</strong><button className="ghost metric-link" onClick={()=>setTab('Đơn chủ trọ')}>Xem đơn chờ duyệt</button></article></div>}
 {tab==='Tài khoản'&&data?.users.map(u=><article className="card" key={u.id}>{u.fullName} · {u.email} · {u.role} · {u.lockedAt?'Đã khóa':'Hoạt động'} {u.role!=='ADMIN'&&<button onClick={async()=>{await api('v10/admin/users/'+u.id,'',{locked:!u.lockedAt});await refresh()}}>{u.lockedAt?'Mở khóa':'Khóa'}</button>}{['MANAGER','STAFF','ACCOUNTANT'].includes(u.role) && <Action title="Cập nhật vai trò vận hành" fields={[{...select('role','Vai trò',[['MANAGER','Quản lý'],['STAFF','Nhân viên'],['ACCOUNTANT','Kế toán']]), value:u.role}]} submit={async values=>{await api('v10/admin/users/'+u.id+'/role','',values);await refresh()}} />}</article>)}
 {tab==='Duyệt tin phòng'&&data?.rooms.filter(r=>r.listingStatus==='PENDING').map(r=><article className="card" key={r.id}><h2>{r.roomCode} · {r.property.name}</h2><p>{r.property.address}</p><AdminRoomPhotos room={r} /><div className="admin-room-actions"><button onClick={()=>void moderateRoom(r.id,true)}>Duyệt</button><button className="ghost" onClick={()=>void moderateRoom(r.id,false)}>Từ chối</button></div></article>)}
 {tab==='Đơn chủ trọ'&&data?.applications.map(a=><article className="card" key={a.id}>{a.user.fullName} · {a.reason} · {a.status}{a.status==='PENDING'&&<><button onClick={async()=>{await api('v10/admin/owner-applications/'+a.id,'',{approve:true});await refresh()}}>Duyệt</button><button onClick={async()=>{await api('v10/admin/owner-applications/'+a.id,'',{approve:false});await refresh()}}>Từ chối</button></>}</article>)}
 {tab==='Nhật ký'&&data?.auditTrail.map(a=><p key={a.id}>{a.action} · {new Date(a.createdAt).toLocaleString('vi-VN')}</p>)}
 </main></div></div>
}
export default function Page(){return <PortalGate role="admin"><Admin/></PortalGate>}


function AdminRoomPhotos({ room }: { room: AdminData['rooms'][number] }) {
  const [open, setOpen] = useState(false)
  return <div className="admin-room-photos">
    <button type="button" className="ghost" aria-expanded={open} onClick={() => setOpen(!open)}>
      {open ? 'Ẩn ảnh phòng' : 'Xem ảnh phòng'} ({room.images.length})
    </button>
    {open && (room.images.length === 0 ? <p role="status">Phòng này chưa có ảnh. Chủ trọ cần tải ảnh lên trước.</p> :
      <div className="admin-photo-grid">{room.images.map(photo => <AdminRoomPhoto key={photo.id} roomId={room.id} photo={photo} />)}</div>)}
  </div>
}

function AdminRoomPhoto({ roomId, photo }: { roomId: string; photo: AdminData['rooms'][number]['images'][number] }) {
  const [src, setSrc] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    let url = ''
    const timer = window.setTimeout(() => controller.abort(), 15000)
    let active = true
    void fetch('/api/v10/listing-photos/' + roomId + '/' + photo.id, {
      headers: { 'X-RentFlow-Web': '1' }, signal: controller.signal,
    }).then(async response => {
      if (!response.ok) throw new Error('Không tải được ảnh (HTTP ' + response.status + ').')
      const blob = await response.blob()
      if (!blob.type.startsWith('image/')) throw new Error('Dữ liệu trả về không phải ảnh.')
      if (!active) return
      url = URL.createObjectURL(blob)
      setSrc(url)
    }).catch(failure => {
      if (active) setError(controller.signal.aborted ? 'Tải ảnh quá thời gian chờ.' : (failure instanceof Error ? failure.message : 'Không tải được ảnh.'))
    }).finally(() => window.clearTimeout(timer))
    return () => { active = false; controller.abort(); window.clearTimeout(timer); if (url) URL.revokeObjectURL(url) }
  }, [roomId, photo.id])
  if (error) return <p role="alert">{error} Hãy ẩn ảnh rồi mở lại để thử lại.</p>
  if (!src) return <p role="status">Đang tải ảnh…</p>
  return <img src={src} alt={photo.alt || 'Ảnh phòng'} onError={() => setError('Không thể hiển thị ảnh.')} />
}
