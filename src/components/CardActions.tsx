import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { copyLink, makeCardLink, prepareCard, saveCardImage, sendLink } from '../lib/cardShare'
import { tr } from '../lib/i18n'
import type { Card } from '../lib/store'
import { viewAsId } from '../lib/viewAs'
import { Popup, type PopupAction } from './ui'

// Save (down arrow) and Share (curved arrow) icons for one card: on the finished-card screen and the
// Collection card view. Save → phone share sheet with the image (Save Image) or a PNG download.
// Share → makes a public link to the card, then a second tap shares or copies it.

// hand-drawn line icons (slightly wobbly strokes), like the finished-card screen design
export function SaveIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-full" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12.2 3.2C12 6.4 12.3 10.2 12.05 15.4" />
      <path d="M7.9 11.6C9.3 12.9 10.7 14.3 12.1 15.6C13.3 14.2 14.6 12.8 16 11.5" />
      <path d="M4.6 20.4C8.2 20.1 12.6 20.6 19.5 20.2" />
    </svg>
  )
}

export function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-full" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12.1 15.2C11.9 11.6 12.2 7.4 12 3.4" />
      <path d="M8.3 7.3C9.6 6 10.8 4.6 12 3.3C13.2 4.5 14.4 5.8 15.7 7" />
      <path d="M4.7 10.8C4.4 14.3 4.7 17.6 4.6 20.9C9.4 20.6 14.6 21.1 19.6 20.7C19.8 17.4 19.4 14.1 19.5 10.9" />
    </svg>
  )
}

type Pop = { message: string; actions: PopupAction[] } | null

export default function CardActions({ card, light = false, className = '', size = 30, gap = 14 }: { card: Card; light?: boolean; className?: string; size?: number; gap?: number }) {
  const [busy, setBusy] = useState<'save' | 'share' | null>(null)
  const [pop, setPop] = useState<Pop>(null)
  const close = () => setPop(null)

  // make the image while the card is on screen, so Save can open the share sheet right on the tap
  useEffect(() => {
    prepareCard(card).catch(() => {})
  }, [card])

  async function save() {
    if (busy) return
    if (viewAsId) return setPop({ message: tr('Admin view: read-only.'), actions: [{ label: tr('Got it!'), onClick: close }] })
    setBusy('save')
    const r = await saveCardImage(card)
    setBusy(null)
    if (r === 'failed') setPop({ message: tr("Couldn't make the image. Try again in a moment."), actions: [{ label: tr('Got it!'), onClick: close }] })
  }

  async function share() {
    if (busy) return
    if (viewAsId) return setPop({ message: tr('Admin view: read-only.'), actions: [{ label: tr('Got it!'), onClick: close }] })
    setBusy('share')
    const r = await makeCardLink(card)
    setBusy(null)
    if (!r.ok) {
      const message =
        r.error === 'no-server' ? tr('Link sharing needs the server. Save the image instead.') : r.error === 'login' ? tr('Log in to share a link.') : tr("Couldn't make the link. Try again in a moment.")
      return setPop({ message, actions: [{ label: tr('Got it!'), onClick: close }] })
    }
    const title = card.nickname || 'card capture collect'
    setPop({
      message: tr('Your card link is ready!'),
      actions: [
        {
          label: tr('Copy'),
          onClick: async () => {
            await copyLink(r.url)
            setPop({ message: tr('Link copied.'), actions: [{ label: tr('Got it!'), onClick: close }] })
          },
        },
        {
          label: tr('Share'),
          onClick: async () => {
            const how = await sendLink(r.url, title)
            if (how === 'copied') setPop({ message: tr('Link copied.'), actions: [{ label: tr('Got it!'), onClick: close }] })
            else close()
          },
        },
      ],
    })
  }

  const btn = `flex items-center justify-center p-[7px] transition-opacity ${light ? 'text-white' : 'text-black'}`
  return (
    <>
      <div className={`flex items-center ${className}`} style={{ gap }}>
        <button aria-label={tr('Save image')} onClick={save} className={`${btn} ${busy === 'save' ? 'opacity-40' : ''}`} style={{ width: size + 14, height: size + 14 }}>
          <SaveIcon />
        </button>
        <button aria-label={tr('Share link')} onClick={share} className={`${btn} ${busy === 'share' ? 'opacity-40' : ''}`} style={{ width: size + 14, height: size + 14 }}>
          <ShareIcon />
        </button>
      </div>
      {/* over the whole screen: the icons sit inside small positioned boxes (Bottom) */}
      {pop && createPortal(<Popup message={pop.message} actions={pop.actions} />, document.getElementById('root') ?? document.body)}
    </>
  )
}
