import { redirect } from 'next/navigation'

export default function Page() { redirect('/login') }
export type { Overview, Write } from './dashboard'
