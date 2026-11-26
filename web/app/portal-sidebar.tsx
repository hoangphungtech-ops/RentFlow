'use client'

import Link from 'next/link'

type Props = {
  label: string
  sections: string[]
  active: string
  onSelect: (section: string) => void
}

export function PortalSidebar({ label, sections, active, onSelect }: Props) {
  return <aside className="workspace-sidebar">
    <Link href="/" className="workspace-brand">
      <span className="workspace-mark" aria-hidden="true">RF</span>
      <span>RentFlow<small>{label}</small></span>
    </Link>
    <nav aria-label="Quản lý">
      {sections.map(section => <button
        type="button"
        key={section}
        aria-current={active === section ? 'page' : undefined}
        onClick={() => onSelect(section)}
      >{section}</button>)}
    </nav>
  </aside>
}
