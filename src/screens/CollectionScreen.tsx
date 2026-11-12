import { useEffect, useRef, useState } from 'react'
import backIcon from '../assets/proto/v2/back40.svg'
import closeRing from '../assets/proto/v2/detail-close-ring.svg'
import closeX from '../assets/proto/v2/detail-close-x.svg'
import deckBox from '../assets/proto/v2/deck-box.svg'
import pillDiscard from '../assets/proto/v2/pill-discard.svg'
import bandImg from '../assets/proto/v2/tl-bar.svg'
import { Bottom, CardView, Popup, TextButton, Thumb, shrink, type PopupAction, SketchyBox } from '../components/ui'
import { framePoint, toLocal } from '../lib/frame'
import { MAX_RESIDENTS, deleteCard, placeCard, swapCards, townOf, type Card, type State } from '../lib/store'

// New Figma GUI (prototyping › 콜렉션 725:*): town strip → selected town's deck (3×2 pages, slot 1 = Head)
// → other towns' cards. Long-press to drag: into the deck (moves in), onto a card (the two swap), or
// within the deck (reorder). Detail overlay with Delete.
const PER_PAGE = 6
const HOLD_MS = 350

type Drag = { id: string; from: 'deck' | 'rest'; x: number; y: number }

export default function CollectionScreen({
  state,
  commit,
  townId,
  onTown,
  onBack,
}: {
  state: State
  commit: (fn: (s: State) => State) => void
  townId: string
  onTown: (id: string) => void
  onBack: () => void
}) {
  const [newest, setNewest] = useState(true)
  const [page, setPage] = useState(0)
  const [openId, setOpenId] = useState<string | null>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [overDeck, setOverDeck] = useState(false)
  const [popup, setPopup] = useState<{ message: string; actions: PopupAction[] } | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const town = state.towns.find((t) => t.id === townId) ?? state.towns[0]
  const deck = town.residents.map((id) => state.cards[id]).filter(Boolean) as Card[]
  const rest = state.towns
    .filter((t) => t.id !== town.id)
    .flatMap((t) => t.residents.map((id) => state.cards[id]).filter(Boolean) as Card[])
    .sort((a, b) => (newest ? b.createdAt.localeCompare(a.createdAt) : a.createdAt.localeCompare(b.createdAt)))
  const open = openId ? state.cards[openId] : null
  const pages = Math.ceil(MAX_RESIDENTS / PER_PAGE)

  // while dragging a card, stop the browser from scrolling underneath
  useEffect(() => {
    const el = root.current!
    const block = (e: TouchEvent) => dragging.current && e.preventDefault()
    el.addEventListener('touchmove', block, { passive: false })
    return () => el.removeEventListener('touchmove', block)
  }, [])

  // ---- long-press drag ----
  const press = useRef<{ id: string; from: Drag['from']; x: number; y: number; timer: number; fired: boolean } | null>(null)

  function local(e: React.PointerEvent) {
    return toLocal(e.clientX, e.clientY, root.current!)
  }
  function onDown(e: React.PointerEvent, id: string, from: Drag['from']) {
    const p = local(e)
    const target = e.currentTarget
    const pointerId = e.pointerId
    const timer = window.setTimeout(() => {
      if (!press.current) return
      press.current.fired = true
      dragging.current = true
      try {
        target.setPointerCapture(pointerId)
      } catch {
        /* pointer gone */
      }
      navigator.vibrate?.(15)
      setDrag({ id, from, x: p.x, y: p.y })
    }, HOLD_MS)
    press.current = { id, from, ...p, timer, fired: false }
  }
  function onMove(e: React.PointerEvent) {
    const pr = press.current
    if (!pr) return
    const p = local(e)
    if (!pr.fired) {
      if (Math.hypot(p.x - pr.x, p.y - pr.y) > 8) cancelPress()
      return
    }
    setDrag((d) => d && { ...d, x: p.x, y: p.y })
    setOverDeck(!!(document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest('[data-deck]'))
  }
  function cancelPress() {
    if (press.current) clearTimeout(press.current.timer)
    press.current = null
    dragging.current = false
    setDrag(null)
    setOverDeck(false)
  }
  function onUp(e: React.PointerEvent) {
    const pr = press.current
    if (!pr) return
    clearTimeout(pr.timer)
    if (!pr.fired) {
      press.current = null
      return setOpenId(pr.id) // short tap = detail
    }
    drop(e.clientX, e.clientY, pr.id, pr.from)
    cancelPress()
  }

  function drop(cx: number, cy: number, id: string, from: Drag['from']) {
    const hit = document.elementFromPoint(cx, cy) as HTMLElement | null
    // dropped on another card in the other area → the two trade places (no card ever loses its town)
    const other = hit?.closest<HTMLElement>('[data-card]')?.dataset.card
    const otherFrom = hit?.closest<HTMLElement>('[data-from]')?.dataset.from
    if (other && other !== id && otherFrom !== from) return commit((s) => swapCards(s, id, other))
    const slot = hit?.closest<HTMLElement>('[data-slot]')
    const inDeck = slot || hit?.closest('[data-deck]')
    if (!inDeck) return // cards can't be taken out of a town by dragging
    const at = slot ? Number(slot.dataset.slot) : deck.length
    if (from === 'rest' && deck.length >= MAX_RESIDENTS) {
      return setPopup({ message: 'This town is full. Drop it on a card to swap.', actions: [{ label: 'Got it!', onClick: () => setPopup(null) }] })
    }
    commit((s) => placeCard(s, id, town.id, at))
  }

  function askDelete(card: Card) {
    setPopup({
      message: 'Do you really want to delete?',
      actions: [
        { label: 'Delete', onClick: () => { commit((s) => deleteCard(s, card.id)); setPopup(null); setOpenId(null) } },
        { label: 'Cancel', onClick: () => setPopup(null) },
      ],
    })
  }

  const cardProps = (c: Card, from: Drag['from']) => ({
    onPointerDown: (e: React.PointerEvent) => onDown(e, c.id, from),
    onPointerMove: onMove,
    onPointerUp: onUp,
    onPointerCancel: cancelPress,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  })

  // Figma Collection geometry (frame px): 90px tiles, 125 apart, rows 116 apart
  const TILE = 90
  const COL = 125
  const PITCH = 105
  const stripW = Math.max(402, 61 + (state.towns.length - 1) * PITCH + 60)
  const bandW = stripW - 52 + 40
  // deck pages scroll inside the hand-drawn box only (box: left 10, 382 wide; clip just inside its stroke)
  const CLIP_L = 13
  const CLIP_W = 376

  // drawing zoomed on the upper body, like the Figma tiles
  const tile = (c: Card, from: Drag['from'], label: string) => (
    <button
      aria-label={label}
      data-card={c.id}
      data-from={from}
      {...cardProps(c, from)}
      className={`relative size-full rounded-[3px] bg-white ${from === 'deck' ? 'touch-pan-x' : ''} ${drag?.id === c.id ? 'opacity-30' : ''}`}
    >
      <span className="absolute inset-[1px] overflow-hidden rounded-[3px]">
        <img src={c.thumb ?? c.image} alt="" draggable={false} className={c.thumb ? 'pointer-events-none absolute inset-0 size-full object-cover' : 'pointer-events-none absolute top-[5%] left-[-15%] w-[130%] max-w-none'} />
      </span>
      {/* hand-drawn black frame */}
      <SketchyBox w={90} h={90} seed={c.id.charCodeAt(0) + c.id.charCodeAt(1)} />
    </button>
  )

  return (
    <div ref={root} className="relative h-full overflow-hidden bg-[#f9f9f9] font-hand">
      <button aria-label="Back" onClick={onBack} className="absolute top-[85px] left-[24px] z-20 size-[40px]">
        <img src={backIcon} alt="" className="size-full" />
      </button>
      <p className="absolute top-[89px] left-1/2 -translate-x-1/2 text-[24px] leading-[1.3]">Collection</p>
      <TextButton onClick={() => setNewest(!newest)} className="absolute top-[93px] right-[24px] z-20 text-[17px]">
        {newest ? 'Newest' : 'Oldest'}
      </TextButton>

      {/* towns on one grey band; the picked one gets the dark ring */}
      {/* no bounce past the ends, so the band's cut-off end never shows */}
      <div className="absolute inset-x-0 top-[134px] h-[100px] overflow-x-auto overflow-y-hidden overscroll-x-none [scrollbar-width:none]">
        <div className="relative h-full" style={{ width: stripW }}>
          {/* the hand-drawn grey band (Town List's, without the outline), laid sideways; its end cap runs past the
              strip's right edge and is cut off there */}
          <div className="pointer-events-none absolute top-[5px] h-[60px] overflow-hidden" style={{ left: 52, width: stripW - 52 }}>
            <img src={bandImg} alt="" className="absolute top-0 left-0 w-[60px] max-w-none origin-top-left" style={{ height: bandW, transform: 'translateY(60px) rotate(-90deg)' }} />
          </div>
          {/* iPhone can still bounce the strip past its end: a flat grey continuation drawn as a box-shadow
              (shadows don't add scroll width), so the band never looks cut while dragging */}
          <div className="pointer-events-none absolute top-[15px] h-[40px]" style={{ left: stripW - 600, width: 600, boxShadow: '600px 0 0 #ccc' }} />
          {state.towns.map((t, i) => {
            const on = t.id === town.id
            const size = on ? 64 : 52
            return (
              <button key={t.id} onClick={() => { onTown(t.id); setPage(0) }} aria-pressed={on} className="absolute top-[4px]" style={{ left: 61 + i * PITCH - size / 2, marginTop: on ? 0 : 6, width: size }}>
                <Thumb image={state.cards[t.residents[0] ?? '']?.image} thumb={state.cards[t.residents[0] ?? '']?.thumb} size={size} strong={on} ring={on ? 7 : 6.6} outline={!on} />
                <span className="absolute left-1/2 w-[100px] -translate-x-1/2 truncate text-center text-[16px] leading-[normal]" style={{ top: on ? 72 : 66 }}>
                  {t.name}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* selected town's deck */}
      <div data-deck className="absolute inset-x-0 top-[243px] h-[257px]">
        {/* Figma Collection 787:893: hand-drawn box (Vector 413); darker while a card hovers over it */}
        <img src={deckBox} alt="" className={`pointer-events-none absolute top-[1px] left-[10px] h-[256px] w-[382px] max-w-none transition-[filter] ${overDeck ? 'brightness-[0.62]' : ''}`} />
        <div
          className="absolute top-[4px] bottom-[4px] flex snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain rounded-[18px] [scrollbar-width:none]"
          // clip-path as well: iPhone Safari can paint a scrolling box's children outside its rounded overflow clip
          style={{ left: CLIP_L, width: CLIP_W, clipPath: 'inset(0 round 18px)', WebkitClipPath: 'inset(0 round 18px)' }}
          onScroll={(e) => setPage(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
        >
          {Array.from({ length: pages }, (_, p) => (
            <div key={p} className="relative h-full shrink-0 snap-start" style={{ width: CLIP_W, marginTop: -4 }}>
              {Array.from({ length: PER_PAGE }, (_, k) => {
                const at = p * PER_PAGE + k
                if (at >= MAX_RESIDENTS) return null
                const c = deck[at]
                return (
                  <div key={k} data-slot={Math.min(at, deck.length)} className="absolute" style={{ left: 31 - CLIP_L + (k % 3) * COL, top: 20 + Math.floor(k / 3) * 116, width: TILE, height: TILE }}>
                    {c ? (
                      <>
                        {tile(c, 'deck', `${c.nickname || 'Card'}${at === 0 ? ', head' : ''}`)}
                        {at === 0 && (
                          <span className="pointer-events-none absolute inset-x-[2px] top-[67px] h-[21px] bg-white/70 text-center text-[15px] leading-[22px]">Head</span>
                        )}
                      </>
                    ) : (
                      <span className="block size-full rounded-[3px] border-2 border-[#efefef] bg-[#e7e7e7]" />
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
        <div className="pointer-events-none absolute top-[240px] left-1/2 flex -translate-x-1/2 gap-[8px]">
          {Array.from({ length: pages }, (_, p) => (
            <span key={p} className={`size-[5px] rounded-full ${p === page ? 'bg-black' : 'bg-[#ccc]'}`} />
          ))}
        </div>
      </div>

      {/* everyone else (only this part scrolls) */}
      <div className="absolute inset-x-0 top-[500px] bottom-0 overflow-y-auto [scrollbar-width:none]">
        {rest.length === 0 ? (
          <p className="pt-[40px] text-center text-[17px] text-[#8e8e8e]">Cards in other towns show up here.</p>
        ) : (
          <div className="grid grid-cols-[repeat(3,90px)] gap-x-[35px] gap-y-[25px] pt-[25px] pb-[70px] pl-[31px]">
            {rest.map((c) => (
              <div key={c.id} className="size-[90px]">
                {tile(c, 'rest', c.nickname || 'Card')}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[63px] bg-gradient-to-t from-[#e0e0e0]/70 to-[#e0e0e0]/0" />

      {/* card following the finger */}
      {drag && (
        <div
          className="pointer-events-none absolute z-40 size-[74px] -translate-x-1/2 -translate-y-1/2 scale-[1.2] overflow-hidden rounded-[3.7px] border-[2.4px] border-black bg-white shadow-[0_8px_16px_rgba(0,0,0,0.25)]"
          style={{ left: drag.x, top: drag.y }}
        >
          {state.cards[drag.id]?.thumb ? (
            <img src={state.cards[drag.id]!.thumb} alt="" className="absolute inset-0 size-full object-cover" />
          ) : (
            <img src={state.cards[drag.id]?.image} alt="" className="absolute top-[5%] left-[-15%] w-[130%] max-w-none" />
          )}
        </div>
      )}

      {open && <Detail card={open} townName={townOf(state, open.id)?.name ?? ''} onClose={() => setOpenId(null)} onDelete={() => askDelete(open)} />}

      {popup && <Popup message={popup.message} actions={popup.actions} />}
    </div>
  )
}

// card overlay (Figma 725:13761): tap the drawing to hide the card text, drag to tilt it around
function Detail({ card, townName, onClose, onDelete }: { card: Card; townName: string; onClose: () => void; onDelete: () => void }) {
  const [plain, setPlain] = useState(false)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  const start = useRef<{ x: number; y: number; moved: boolean } | null>(null)
  const [held, setHeld] = useState(false)

  return (
    <div className="animate-fade-in absolute inset-0 z-30 bg-black/35 text-white backdrop-blur-[1.5px]">
      <p className="absolute top-[170.5px] left-[21px] text-[25px] leading-[1.1]">{townName}</p>
      <button aria-label="Close" onClick={onClose} className="absolute top-[166px] left-[349px] flex h-[37px] w-[35px] items-center justify-center">
        <img src={closeRing} alt="" className="absolute inset-0 size-full" />
        <img src={closeX} alt="" className="relative h-[14.8px] w-[12.3px]" />
      </button>
      <div className="absolute top-[210px] left-[21px] w-[360px] [perspective:700px]" style={shrink(515)}>
        <div
          className="animate-pop-in touch-none"
          style={{
            transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
            transition: held ? 'none' : 'transform 0.5s var(--ease-spring)',
          }}
          onPointerDown={(e) => {
            start.current = { ...framePoint(e.clientX, e.clientY), moved: false }
            setHeld(true)
            e.currentTarget.setPointerCapture(e.pointerId)
          }}
          onPointerMove={(e) => {
            const s = start.current
            if (!s) return
            const p = framePoint(e.clientX, e.clientY)
            const dx = p.x - s.x
            const dy = p.y - s.y
            if (Math.hypot(dx, dy) > 6) s.moved = true
            const lim = (v: number) => Math.max(-18, Math.min(18, v))
            setTilt({ x: lim(-dy / 6), y: lim(dx / 6) })
          }}
          onPointerUp={() => {
            const moved = start.current?.moved
            start.current = null
            setHeld(false)
            setTilt({ x: 0, y: 0 })
            if (!moved) setPlain((p) => !p)
          }}
          onPointerCancel={() => {
            start.current = null
            setHeld(false)
            setTilt({ x: 0, y: 0 })
          }}
        >
          <CardView card={card} plain={plain} />
        </div>
      </div>
      <Bottom>
        <button onClick={onDelete} className="absolute top-[735px] left-[280px] flex h-[43px] w-[102px] items-center justify-center">
          <img src={pillDiscard} alt="" className="absolute inset-0 size-full" />
          <span className="relative text-[23px] leading-[1.1] text-[#686868]">Discard</span>
        </button>
      </Bottom>
    </div>
  )
}
