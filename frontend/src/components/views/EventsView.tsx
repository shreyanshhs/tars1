import { useTars } from '../../context/TarsContext'
import Events from './events/Events'

export function EventsView() {
  const { role } = useTars()
  return <Events canPost={role === 'faculty' || role === 'hod'} />
}
