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

export function SaveIcon() {
  return (
    <svg viewBox="0 0 512 512" className="size-full" fill="none" stroke="currentColor" strokeWidth={44} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M256 70V330M150 225L256 330L362 225M66 425H446" />
    </svg>
  )
}

export function ShareIcon() {
  return (
    <svg viewBox="0 0 512 512" className="size-full" fill="none" stroke="currentColor" strokeWidth={40} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M270 62L486 255L270 448V318C160 318 82 352 34 446C40 288 104 196 270 192Z" />
    </svg>
  )
}

type Pop = { message: string; actions: PopupAction[] } | null

export default function CardActions({ card, light = false, className = '', size = 30 }: { card: Card; light?: boolean; className?: string; size?: number }) {
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
      <div className={`flex items-center gap-[14px] ${className}`}>
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
