import Dashboard from '../../quan-ly/dashboard'
import { PortalGate } from '../../portal-gate'

export default function Page() {
  return <PortalGate role="staff"><Dashboard portal="staff" /></PortalGate>
}
