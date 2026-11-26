'use client'

import Link from 'next/link'
import { ReactNode, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, ApiError } from './shared'

export function PortalGate({ role, children }: { role: string; children: ReactNode }) {
  const router = useRouter()
  const [portal, setPortal] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    api<{ portal: string }>('v10/me').then(actor => setPortal(actor.portal)).catch(failure => {
      if (failure instanceof ApiError && failure.status === 401) router.replace('/login')
      else setError(failure.message)
    })
  }, [router])
  if (portal === role) return children
  return <main className="shell">
    {error ? <p role="alert">{error}</p> : portal ? <section className="card"><h1>Không có quyền truy cập</h1><Link href={'/' + portal + '/dashboard'}>Về giao diện của bạn</Link></section> : <p role="status">Đang xác thực quyền…</p>}
  </main>
}
