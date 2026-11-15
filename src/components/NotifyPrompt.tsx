import { useEffect, useState } from 'react'
import { tr } from '../lib/i18n'
import { Popup } from './ui'

// Asks to allow notifications: right after logging in / signing up, and again every time the app opens until the
// phone's own answer is in (allowed or blocked). iPhone only offers notifications to the Home Screen web app and
// only from a tap, so our popup's "Allow" is what opens the system prompt. Where notifications don't exist
// (Safari tab on iPhone, old browsers) nothing shows.
const NOTIFY = 'subwayseal.notify' // My Page toggle
let shownThisRun = false // "Not now" = ask again next time the app opens, not right away

const undecided = () => typeof Notification !== 'undefined' && 'serviceWorker' in navigator && Notification.permission === 'default'

function remember(on: boolean) {
  try {
    localStorage.setItem(NOTIFY, on ? 'on' : 'off')
  } catch {
    /* private mode */
  }
}

export default function NotifyPrompt({ user, blocked }: { user: string | null; blocked: boolean }) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!user || blocked || shownThisRun || !undecided()) return
    shownThisRun = true
    setOpen(true)
  }, [user, blocked])
  if (!open) return null
  return (
    <Popup
      message={tr('Allow notifications?\nWe’ll send you a little nudge now and then.')}
      actions={[
        { label: tr('Not now'), onClick: () => setOpen(false) },
        {
          label: tr('Allow'),
          onClick: () => {
            setOpen(false)
            Notification.requestPermission()
              .then((p) => p !== 'default' && remember(p === 'granted'))
              .catch(() => {})
          },
        },
      ]}
    />
  )
}
