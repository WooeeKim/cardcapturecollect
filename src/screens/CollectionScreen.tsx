import { useEffect, useRef, useState } from 'react'
import backIcon from '../assets/proto/v2/back40.svg'
import closeRing from '../assets/proto/v2/detail-close-ring.svg'
import closeX from '../assets/proto/v2/detail-close-x.svg'
import deckBox from '../assets/proto/v2/deck-box.svg'
import pillDiscard from '../assets/proto/v2/pill-discard.svg'
import bandImg from '../assets/proto/v2/tl-bar.svg'
import { Bottom, CardView, Popup, TextButton, Thumb, shrink, type PopupAction, SketchyBox } from '../components/ui'
import { framePoint, toLocal } from '../lib/frame'
import { MAX_RESIDENTS, deleteCard, townOf, type Card, type State } from '../lib/store'
import { townName, tr } from '../lib/i18n'
import { useWide } from '../lib/wide'

// New Figma GUI (prototyping › 콜렉션 725:*): town strip → selected town's deck (3×2 pages, slot 1 = Head)
// → other towns' cards. Long-press to drag: into the deck (moves in), onto a card (the two swap), or
// within the deck (reorder). Detail overlay with Delete.
const HOLD_MS = 350
// deck geometry (frame px). Phone: 3×2 pages. iPad sideways (Figma iPad · collection 1033:10907): one 9×2 page
// (every slot of a town) in a box across the screen, the other towns' people 9 to a row under it.
const PHONE = { perPage: 6, cols: 3, tile: 90, col: 125, row: 116, tileX: 31, tileY: 20, clipL: 13, clipW: 376, top: 243, h: 257, boxL: 10, boxW: 382, boxH: 256 }
const WIDE = { perPage: 18, cols: 9, tile: 88, col: 117.8, row: 111.8, tileX: 82, tileY: 27, clipL: 33, clipW: 1128, top: 235, h: 254, boxL: 30, boxW: 1134, boxH: 254 }

type Drag = { id: string; from: 'deck' | 'rest'; x: number; y: number }

export default function CollectionScreen({
  state,
  commit,
  townId,
  openCard,
  onTown,
  onBack,
  onMigrate,
  onMoveCard,
  onSwap,
  onForget,
}: {
  state: State
  commit: (fn: (s: State) => State) => void
  townId: string
  openCard?: string // open this card's big view on arrival
  onTown: (id: string) => void
  onBack: () => void
  onMigrate: (cardId: string) => void // Town List in move mode — any of your towns or Last Stop
  // moves go through App so Last Stop (on the server) works like any other town
  onMoveCard: (cardId: string, townId: string, at?: number) => unknown
  onSwap: (a: string, b: string) => unknown
  onForget: (cardId: string) => void // let go: also leaves Last Stop
}) {
  const wide = useWide()
  const G = wide ? WIDE : PHONE
  const PER_PAGE = G.perPage
  const [newest, setNewest] = useState(true)
  const [page, setPage] = useState(0)
  const [openId, setOpenId] = useState<string | null>(openCard ?? null)
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
    if (other && other !== id && otherFrom !== from) return void onSwap(id, other)
    const slot = hit?.closest<HTMLElement>('[data-slot]')
    const inDeck = slot || hit?.closest('[data-deck]')
    if (!inDeck) return // cards can't be taken out of a town by dragging
    const at = slot ? Number(slot.dataset.slot) : deck.length
    if (from === 'rest' && deck.length >= MAX_RESIDENTS) {
      return setPopup({ message: tr('This town is full. Drop them on someone to swap places.'), actions: [{ label: tr('Got it!'), onClick: () => setPopup(null) }] })
    }
    onMoveCard(id, town.id, at)
  }

  function askDelete(card: Card) {
    setPopup({
      message: tr('Let this person go?'),
      actions: [
        { label: tr('Let go'), onClick: () => { onForget(card.id); commit((s) => deleteCard(s, card.id)); setPopup(null); setOpenId(null) } },
        { label: tr('Cancel'), onClick: () => setPopup(null) },
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
  const TILE = G.tile
  const COL = G.col
  const PITCH = 105
  // first town's centre, and where the grey band starts
  const START = wide ? 113 : 61
  const BAND_L = wide ? 104 : 52
  const stripW = Math.max(wide ? 1194 : 402, START + (state.towns.length - 1) * PITCH + 60)
  const bandW = stripW - BAND_L + 40
  // deck pages scroll inside the hand-drawn box only (clip just inside its stroke)
  const CLIP_L = G.clipL
  const CLIP_W = G.clipW

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
      <SketchyBox w={TILE} h={TILE} seed={c.id.charCodeAt(0) + c.id.charCodeAt(1)} />
    </button>
  )

  return (
    <div ref={root} className="relative h-full overflow-hidden bg-[#f9f9f9] font-hand">
      <button aria-label={tr('Back')} onClick={onBack} className={`absolute z-20 size-[40px] ${wide ? 'top-[30px] left-[40px]' : 'top-[85px] left-[24px]'}`}>
        <img src={backIcon} alt="" className="size-full" />
      </button>
      <p className={`absolute left-1/2 -translate-x-1/2 text-[24px] leading-[1.3] ${wide ? 'top-[36px]' : 'top-[89px]'}`}>{tr('Collection')}</p>
      <TextButton onClick={() => setNewest(!newest)} className={`absolute z-20 text-[17px] ${wide ? 'top-[40px] right-[40px]' : 'top-[93px] right-[24px]'}`}>
        {tr(newest ? 'Newest' : 'Oldest')}
      </TextButton>

      {/* towns on one grey band; the picked one gets the dark ring */}
      {/* no bounce past the ends, so the band's cut-off end never shows */}
      <div className={`absolute inset-x-0 h-[100px] overflow-x-auto ${wide ? 'top-[105px]' : 'top-[134px]'} overflow-y-hidden overscroll-x-none [scrollbar-width:none]`}>
        <div className="relative h-full" style={{ width: stripW }}>
          {/* the hand-drawn grey band (Town List's, without the outline), laid sideways; its end cap runs past the
              strip's right edge and is cut off there */}
          <div className="pointer-events-none absolute top-[5px] h-[60px] overflow-hidden" style={{ left: BAND_L, width: stripW - BAND_L }}>
            <img src={bandImg} alt="" className="absolute top-0 left-0 w-[60px] max-w-none origin-top-left" style={{ height: bandW, transform: 'translateY(60px) rotate(-90deg)' }} />
          </div>
          {/* iPhone can still bounce the strip past its end: a flat grey continuation drawn as a box-shadow
              (shadows don't add scroll width), so the band never looks cut while dragging */}
          <div className="pointer-events-none absolute top-[15px] h-[40px]" style={{ left: stripW - 600, width: 600, boxShadow: '600px 0 0 #ccc' }} />
          {state.towns.map((t, i) => {
            const on = t.id === town.id
            const size = on ? 64 : 52
            return (
              <button key={t.id} onClick={() => { onTown(t.id); setPage(0) }} aria-pressed={on} className="absolute top-[4px]" style={{ left: START + i * PITCH - size / 2, marginTop: on ? 0 : 6, width: size }}>
                <Thumb image={state.cards[t.residents[0] ?? '']?.image} thumb={state.cards[t.residents[0] ?? '']?.thumb} size={size} strong={on} ring={on ? 7 : 6.6} outline={!on} />
                <span className="absolute left-1/2 w-[100px] -translate-x-1/2 truncate text-center text-[16px] leading-[normal]" style={{ top: on ? 72 : 66 }}>
                  {townName(t.name)}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* selected town's deck */}
      <div data-deck className="absolute inset-x-0" style={{ top: G.top, height: G.h }}>
        {/* Figma Collection 787:893: hand-drawn box (Vector 413); darker while a card hovers over it */}
        <img src={deckBox} alt="" className={`pointer-events-none absolute top-[1px] max-w-none transition-[filter] ${overDeck ? 'brightness-[0.62]' : ''}`} style={{ left: G.boxL, width: G.boxW, height: G.boxH }} />
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
                  <div key={k} data-slot={Math.min(at, deck.length)} className="absolute" style={{ left: G.tileX - CLIP_L + (k % G.cols) * COL, top: G.tileY + Math.floor(k / G.cols) * G.row, width: TILE, height: TILE }}>
                    {c ? (
                      <>
                        {tile(c, 'deck', `${c.nickname || tr('Someone')}${at === 0 ? tr(', head') : ''}`)}
                        {at === 0 && (
                          <span className="pointer-events-none absolute inset-x-[2px] h-[21px] bg-white/70 text-center text-[15px] leading-[22px]" style={{ top: TILE - 23 }}>{tr('Head')}</span>
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
        <div className={`pointer-events-none absolute top-[240px] left-1/2 flex -translate-x-1/2 gap-[8px] ${pages < 2 ? 'hidden' : ''}`}>
          {Array.from({ length: pages }, (_, p) => (
            <span key={p} className={`size-[5px] rounded-full ${p === page ? 'bg-black' : 'bg-[#ccc]'}`} />
          ))}
        </div>
      </div>

      {/* everyone else (only this part scrolls) */}
      <div className={`absolute inset-x-0 bottom-0 overflow-y-auto [scrollbar-width:none] ${wide ? 'top-[505px]' : 'top-[500px]'}`}>
        {rest.length === 0 ? (
          <p className="pt-[40px] text-center text-[17px] text-[#8e8e8e]">{tr('People in other towns show up here.')}</p>
        ) : (
          <div className={`grid pb-[70px] ${wide ? 'grid-cols-[repeat(9,88px)] gap-x-[29.8px] gap-y-[24px] pt-[27px] pl-[82px]' : 'grid-cols-[repeat(3,90px)] gap-x-[35px] gap-y-[25px] pt-[25px] pl-[31px]'}`}>
            {rest.map((c) => (
              <div key={c.id} style={{ width: TILE, height: TILE }}>
                {tile(c, 'rest', c.nickname || tr('Someone'))}
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

      {open && <Detail wide={wide} card={open} townName={townOf(state, open.id)?.name ?? ''} onClose={() => setOpenId(null)} onDelete={() => askDelete(open)} onMigrate={() => onMigrate(open.id)} />}

      {popup && <Popup message={popup.message} actions={popup.actions} />}
    </div>
  )
}

// card overlay (Figma 725:13761): tap the drawing to hide the card text, drag to tilt it around
// iPad sideways: the card in the middle of the screen, town name and close above it, Let go at its lower right
function Detail({ wide, card, townName, onClose, onDelete, onMigrate }: { wide: boolean; card: Card; townName: string; onClose: () => void; onDelete: () => void; onMigrate: () => void }) {
  const [plain, setPlain] = useState(false)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  const start = useRef<{ x: number; y: number; moved: boolean } | null>(null)
  const [held, setHeld] = useState(false)

  return (
    <div className="animate-fade-in absolute inset-0 z-30 bg-black/35 text-white backdrop-blur-[1.5px]">
      <p className={`absolute text-[25px] leading-[1.1] ${wide ? 'top-[72px] left-[417px]' : 'top-[170.5px] left-[21px]'}`}>{townName}</p>
      <button aria-label={tr('Close')} onClick={onClose} className={`absolute flex h-[37px] w-[35px] items-center justify-center ${wide ? 'top-[68px] left-[745px]' : 'top-[166px] left-[349px]'}`}>
        <img src={closeRing} alt="" className="absolute inset-0 size-full" />
        <img src={closeX} alt="" className="relative h-[14.8px] w-[12.3px]" />
      </button>
      <div className={`absolute w-[360px] [perspective:700px] ${wide ? 'top-[112px] left-[417px]' : 'top-[210px] left-[21px]'}`} style={wide ? undefined : shrink(515)}>
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
      {(() => {
        const letGo = (
          <button onClick={onDelete} className={`absolute flex h-[43px] w-[102px] items-center justify-center ${wide ? 'top-[652px] left-[675px]' : 'top-[735px] left-[280px]'}`}>
            <img src={pillDiscard} alt="" className="absolute inset-0 size-full" />
            <span className="relative text-[23px] leading-[1.1] text-[#686868]">{tr('Let go')}</span>
          </button>
        )
        // Migration left of Let go: the way into Last Stop (dragging only moves people between your own towns)
        const migrate = (
          <button onClick={onMigrate} className={`absolute flex h-[43px] w-[124px] items-center justify-center ${wide ? 'top-[652px] left-[539px]' : 'top-[735px] left-[144px]'}`}>
            <img src={pillDiscard} alt="" className="absolute inset-0 size-full" />
            <span className="relative text-[23px] leading-[1.1] text-black">{tr('Migration')}</span>
          </button>
        )
        return wide ? (
          <>
            {migrate}
            {letGo}
          </>
        ) : (
          <Bottom>
            {migrate}
            {letGo}
          </Bottom>
        )
      })()}
    </div>
  )
}
