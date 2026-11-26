'use client'

import Link from 'next/link'
import {useEffect,useState} from 'react'
import {useRouter} from 'next/navigation'
import {api,ApiError} from '../../shared'
import {PortalGate} from '../../portal-gate'

type AdminData={users:{id:string;email:string;fullName:string;role:string;lockedAt:string|null}[];rooms:{id:string;roomCode:string;listingStatus:string;baseRentPrice:string;property:{name:string;address:string};images:{id:string;alt:string}[]}[];properties:{id:string;name:string;address:string;_count:{rooms:number}}[];applications:{id:string;status:string;reason:string;user:{fullName:string;email:string}}[];auditTrail:{id:string;action:string;createdAt:string}[]}
function Admin() {
 const [data,setData]=useState<AdminData>();const [tab,setTab]=useState('Tổng quan');const [photos,setPhotos]=useState<Record<string,string[]>>({});const router=useRouter()
 async function refresh(){setData(await api<AdminData>('v10/admin'))}
 async function viewPhotos(room:AdminData['rooms'][number]) {
  const urls=await Promise.all(room.images.map(async image=>{
   const response=await fetch('/api/v10/listing-photos/'+room.id+'/'+image.id,{headers:{'X-RentFlow-Web':'1'}});
   if(!response.ok)throw new Error('Không tải được ảnh phòng');
   return URL.createObjectURL(await response.blob());
  }));
  setPhotos(old=>({...old,[room.id]:urls}));
 }
 useEffect(()=>{refresh().catch(e=>{if(e instanceof ApiError&&e.status===401)router.replace('/login')})},[])
 return <><header className="mast"><Link href="/">RentFlow · Quản trị hệ thống</Link><button onClick={async()=>{await api('logout','',{}).catch(()=>{});router.replace('/login')}}>Đăng xuất</button></header><main className="shell"><nav>{['Tổng quan','Tài khoản','Duyệt tin phòng','Đơn chủ trọ','Nhật ký'].map(t=><button key={t} onClick={()=>setTab(t)}>{t}</button>)}</nav><h1>{tab}</h1>
 {tab==='Tổng quan'&&<div className="tiles"><article><h2>Tài khoản</h2><strong>{data?.users.length??'…'}</strong></article><article><h2>Phòng</h2><strong>{data?.rooms.length??'…'}</strong></article><article><h2>Khu trọ</h2><strong>{data?.properties.length??'…'}</strong></article></div>}
 {tab==='Tài khoản'&&data?.users.map(u=><article className="card" key={u.id}>{u.fullName} · {u.email} · {u.role} · {u.lockedAt?'Đã khóa':'Hoạt động'} {u.role!=='ADMIN'&&<button onClick={async()=>{await api('v10/admin/users/'+u.id,'',{locked:!u.lockedAt});await refresh()}}>{u.lockedAt?'Mở khóa':'Khóa'}</button>}</article>)}
 {tab==='Duyệt tin phòng'&&data?.rooms.filter(r=>r.listingStatus==='PENDING').map(r=><article className="card" key={r.id}><h2>{r.roomCode} · {r.property.name}</h2><p>{r.property.address}</p><button onClick={()=>void viewPhotos(r)}>Xem ảnh phòng</button><div className="portal-pictures">{(photos[r.id]??[]).map(src=><img key={src} src={src} alt="Ảnh tin phòng"/> )}</div><button onClick={async()=>{await api('v10/admin/rooms/'+r.id,'',{approve:true});await refresh()}}>Duyệt</button><button onClick={async()=>{await api('v10/admin/rooms/'+r.id,'',{approve:false});await refresh()}}>Từ chối</button></article>)}
 {tab==='Đơn chủ trọ'&&data?.applications.map(a=><article className="card" key={a.id}>{a.user.fullName} · {a.reason} · {a.status}{a.status==='PENDING'&&<><button onClick={async()=>{await api('v10/admin/owner-applications/'+a.id,'',{approve:true});await refresh()}}>Duyệt</button><button onClick={async()=>{await api('v10/admin/owner-applications/'+a.id,'',{approve:false});await refresh()}}>Từ chối</button></>}</article>)}
 {tab==='Nhật ký'&&data?.auditTrail.map(a=><p key={a.id}>{a.action} · {new Date(a.createdAt).toLocaleString('vi-VN')}</p>)}
 </main></>
}
export default function Page(){return <PortalGate role="admin"><Admin/></PortalGate>}
