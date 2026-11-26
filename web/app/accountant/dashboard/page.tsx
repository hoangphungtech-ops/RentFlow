import Dashboard from '../../quan-ly/dashboard'
import { PortalGate } from '../../portal-gate'

export default function Page() {
  return <PortalGate role="accountant"><Dashboard portal="accountant" /></PortalGate>
}
