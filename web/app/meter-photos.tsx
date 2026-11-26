'use client'

import { useEffect, useRef, useState } from 'react'
import { api } from './shared'

export function MeterPhotos({ invoiceId }: { invoiceId: string }) {
  const [photos, setPhotos] = useState<{ url: string; label: string; date: string }[]>()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const urls = useRef<string[]>([])
  useEffect(() => () => { urls.current.forEach(URL.revokeObjectURL) }, [])

  async function load() {
    setBusy(true)
    setError('')
    const path = 'v10/invoices/' + invoiceId + '/meter-evidence'
    try {
      const list = await api<{ id: string; kind: string; createdAt: string }[]>(path)
      const loaded = await Promise.all(list.map(async item => {
        const response = await fetch('/api/' + path + '/' + item.id, { headers: { 'X-RentFlow-Web': '1' } })
        if (!response.ok) throw new Error('Không tải được ảnh.')
        const url = URL.createObjectURL(await response.blob())
        urls.current.push(url)
        return { url, label: item.kind === 'ELECTRICITY' ? 'Công tơ điện' : 'Công tơ nước', date: item.createdAt }
      }))
      setPhotos(loaded)
    } catch (failure) { setError((failure as Error).message) }
    finally { setBusy(false) }
  }
  return <section className="no-print">
    {!photos && <button className="ghost" disabled={busy} onClick={() => void load()}>Xem ảnh công tơ</button>}
    {error && <p role="alert">{error}</p>}
    {photos && (photos.length ? <div className="portal-pictures">{photos.map(photo => <figure key={photo.url}>
      <a href={photo.url} target="_blank" rel="noreferrer"><img src={photo.url} alt={photo.label} /></a>
      <figcaption>{photo.label} · Lưu lúc {new Date(photo.date).toLocaleString('vi-VN')}</figcaption>
    </figure>)}</div> : <p>Kỳ này chưa lưu ảnh công tơ.</p>)}
  </section>
}
