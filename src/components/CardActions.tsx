import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { copyLink, makeCardLink, prepareCard, saveCardImage, sendLink } from '../lib/cardShare'
import { tr } from '../lib/i18n'
import type { Card } from '../lib/store'
import { viewAsId } from '../lib/viewAs'
import { Popup, type PopupAction } from './ui'
import saveSvg from '../assets/proto/v2/icon-save.svg?raw'
import shareSvg from '../assets/proto/v2/icon-share.svg?raw'

// Save (down arrow) and Share (curved arrow) icons for one card: on the finished-card screen and the
// Collection card view. Save → phone share sheet with the image (Save Image) or a PNG download.
// Share → makes a public link to the card, then a second tap shares or copies it.

// Figma UX › drawing-finish (1138:2642): hand-drawn save / share icons (Group 152 / 154), stroke in currentColor
const fit = (svg: string) => svg.replace(/width="[\d.]+" height="[\d.]+"/, 'width="100%" height="100%"')
export const SaveIcon = () => <span aria-hidden className="block size-full" dangerouslySetInnerHTML={{ __html: fit(saveSvg) }} />
export const ShareIcon = () => <span aria-hidden className="block size-full" dangerouslySetInnerHTML={{ __html: fit(shareSvg) }} />
const ICONS = { save: { w: 24.1, h: 29.3 }, share: { w: 28.75, h: 27.93 } }

type Pop = { message: string; actions: PopupAction[] } | null

export default function CardActions({ card, light = false, className = '', scale = 1, gap = 4 }: { card: Card; light?: boolean; className?: string; scale?: number; gap?: number }) {
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
        r.error === 'no-server'
          ? tr('Link sharing needs the server. Save the image instead.')
          : r.error === 'login'
            ? tr('Log in to share a link.')
            : r.error === 'setup'
              ? tr('Link sharing is still being set up. Save the image for now.')
              : tr("Couldn't make the link. Try again in a moment.")
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

  const btn = `flex items-end justify-center p-[5px] transition-opacity box-content ${light ? 'text-white' : 'text-black'}`
  const box = (k: keyof typeof ICONS) => ({ width: ICONS[k].w * scale, height: ICONS[k].h * scale })
  return (
    <>
      <div className={`flex items-end ${className}`} style={{ gap }}>
        <button aria-label={tr('Save image')} onClick={save} className={`${btn} ${busy === 'save' ? 'opacity-40' : ''}`} style={box('save')}>
          <SaveIcon />
        </button>
        <button aria-label={tr('Share link')} onClick={share} className={`${btn} ${busy === 'share' ? 'opacity-40' : ''}`} style={box('share')}>
          <ShareIcon />
        </button>
      </div>
      {/* over the whole screen: the icons sit inside small positioned boxes (Bottom) */}
      {pop && createPortal(<Popup message={pop.message} actions={pop.actions} />, document.getElementById('root') ?? document.body)}
    </>
  )
}
