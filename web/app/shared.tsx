'use client'

import { FormEvent, ReactNode, useState } from 'react'

export const vnd = (value: string | number) => Number(value).toLocaleString('vi-VN') + ' đ'
export async function api<T>(path: string, token = '', body?: object, method?: string): Promise<T> {
  const response = await fetch('/api/' + path, {
    method: method ?? (body ? 'POST' : 'GET'),
    headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(12000),
  }).catch(() => { throw new Error('Mất kết nối. Vui lòng thử lại.') })
  const result = await response.json().catch(() => null)
  if (!response.ok) throw new Error([result?.message ?? 'Máy chủ chưa sẵn sàng.'].flat().join(' · '))
  return result as T
}

type Option = [string, string]
export type Field = { key: string; label: string; type?: string; options?: Option[]; optional?: boolean; value?: string; multiple?: boolean }
export const field = (key: string, label: string, type = 'text', optional = false): Field => ({ key, label, type, optional })
export const select = (key: string, label: string, options: Option[], optional = false, multiple = false): Field => ({ key, label, options, optional, multiple })

export function Action({ title, fields = [], submit, button, extra }: {
  title: string; fields?: Field[]; submit: (data: Record<string, unknown>) => Promise<unknown>; button?: string; extra?: ReactNode
}) {
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [failed, setFailed] = useState(false)
  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const inputs = new FormData(form)
    const data: Record<string, unknown> = {}
    for (const item of fields) {
      const value = inputs.get(item.key)
      if (item.multiple) data[item.key] = inputs.getAll(item.key)
      else if (value !== '' && value !== null) data[item.key] = item.type === 'number' ? Number(value) : value
    }
    setBusy(true)
    setFeedback('')
    try {
      await submit(data)
      form.reset()
      setFailed(false)
      setFeedback('Đã lưu.')
    } catch (error) {
      setFailed(true)
      setFeedback(error instanceof Error ? error.message : 'Không thể hoàn tất.')
    } finally { setBusy(false) }
  }
  return <form onSubmit={send} className="action">
    <h3>{title}</h3>
    <div className="fields">{fields.map(item => <label key={item.key}>{item.label}
      {item.options ? <select name={item.key} defaultValue={item.multiple ? [] : ''} required={!item.optional} multiple={item.multiple}>
        {!item.multiple && <option value="">Chọn</option>}
        {item.options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select> : <input name={item.key} type={item.type} min={item.type === 'number' ? 0 : undefined}
        step={item.type === 'number' ? 'any' : undefined} required={!item.optional} defaultValue={item.value} />}
    </label>)}</div>
    {extra}<button disabled={busy}>{busy ? 'Đang gửi…' : button ?? 'Lưu'}</button>
    {feedback && <p role={failed ? 'alert' : 'status'} className={failed ? 'error' : 'feedback'}>{feedback}</p>}
  </form>
}
