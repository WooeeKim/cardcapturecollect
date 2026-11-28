import { useEffect, useMemo, useRef, useState } from 'react'
import backIcon from '../assets/proto/v2/back40.svg'
import closeRing from '../assets/proto/v2/detail-close-ring.svg'
import closeX from '../assets/proto/v2/detail-close-x.svg'
import deckBoxSvg from '../assets/proto/v2/deck-box.svg?raw'
import pillDiscard from '../assets/proto/v2/pill-discard.svg'
import pillMigrationWarm from '../assets/proto/v2/pill-migration-warm.svg'
import { BAND, stretchX } from '../lib/lineShapes'
import { Bottom, CardView, Popup, PICKED_RING, ringFor, TextButton, Thumb, TownChip, shrink, type PopupAction } from '../components/ui'
import cardShape from '../assets/proto/v2/card-shape.svg'
import CardActions from '../components/CardActions'
import { PillVillage } from '../components/v2'
import { framePoint, toLocal } from '../lib/frame'
import { MAX_RESIDENTS, deleteCard, townOf, type Card, type State } from '../lib/store'
import { townName, tr } from '../lib/i18n'
import { useWide } from '../lib/wide'
import { SQUARE_ID, SQUARE_NAME, SQUARE_PER_USER, SQUARE_THUMB } from '../lib/square'

// New Figma GUI (prototyping › 콜렉션 725:*): town strip → selected town's deck (3×2 pages, slot 1 = Head)
// → other towns' cards. Long-press to drag: into the deck (moves in), onto a card (the two swap), or
// within the deck (reorder). Detail overlay with Delete.
const HOLD_MS = 350
// deck geometry (frame px). Phone: 3×2 pages. iPad sideways (Figma iPad · collection 1033:10907): one 9×2 page
// (every slot of a town) in a box across the screen, the other towns' people 9 to a row under it.
const PHONE = { perPage: 6, cols: 3, tile: 90, col: 125, row: 116, tileX: 31, tileY: 20, clipL: 21, clipW: 360, top: 243, h: 257, boxL: 10, boxW: 382, boxH: 256 }
// deck box outline (Figma Vector 413), drawn inline so its 2px line stays 2px when the plaza's box is shorter
const DECK_D = deckBoxSvg.match(/ d="([^"]+)"/)![1]
const WIDE = { perPage: 18, cols: 9, tile: 88, col: 117.8, row: 111.8, tileX: 82, tileY: 27, clipL: 52, clipW: 1090, top: 235, h: 254, boxL: 30, boxW: 1134, boxH: 254 }

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
  onMigrate: (cardId: string) => void // Town List in move mode — any of your towns or the plaza
  // moves go through App so the plaza (on the server) works like any other town
  onMoveCard: (cardId: string, townId: string, at?: number) => unknown
  onSwap: (a: string, b: string) => unknown
  onForget: (cardId: string) => void // let go: also leaves the plaza
}) {
  const wide = useWide()
  const G = wide ? WIDE : PHONE
  const PER_PAGE = G.perPage
  const [newest, setNewest] = useState(true)
  const [page, setPage] = useState(0)
  const [openId, setOpenId] = useState<string | null>(openCard ?? null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [overDeck, setOverDeck] = useState(false)
  // full town / Transfer refused one more (Figma Section 1, Collection_Transfer_isFull 1145:8184): the grey box
  // shakes and darkens with an "It's been already full." bubble on it. The number restarts the animation.
  const [full, setFull] = useState(0)
  useEffect(() => {
    if (!full) return
    const t = setTimeout(() => setFull(0), 1700)
    return () => clearTimeout(t)
  }, [full])
  const deckEl = useRef<HTMLDivElement>(null)
  const refuseFull = () => {
    setFull(Date.now())
    // restarts on every refusal without remounting the deck (its pages keep their scroll)
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches)
      deckEl.current?.animate(
        [
          { transform: 'none' },
          { transform: 'translateX(-6px) rotate(-3deg)', offset: 0.12 },
          { transform: 'translateX(5px) rotate(2.5deg)', offset: 0.26 },
          { transform: 'translateX(-4px) rotate(-2deg)', offset: 0.4 },
          { transform: 'translateX(3px) rotate(1.2deg)', offset: 0.54 },
          { transform: 'translateX(-1.5px) rotate(-0.6deg)', offset: 0.68 },
          { transform: 'none', offset: 0.82 },
          { transform: 'none' },
        ],
        { duration: 600, easing: 'ease-in-out' },
      )
    try {
      navigator.vibrate?.([40, 30, 40])
    } catch {
      /* unsupported */
    }
  }
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
  // the plaza holds only your SQUARE_PER_USER: one row of slots in a shorter box (Figma 1133:7479)
  const plaza = town.id === SQUARE_ID
  const SLOTS = plaza ? SQUARE_PER_USER : MAX_RESIDENTS
  const CUT = plaza ? G.row : 0
  const pages = Math.ceil(SLOTS / PER_PAGE)

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
    if (from === 'rest' && deck.length >= SLOTS) return refuseFull()
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
  // first town's centre; the grey band (Figma 261119 수정 › Collection_scroll, Vector 537) runs from just before the
  // first town to just after the last (Transfer), rounded at both ends — only its middle stretches with more towns
  const START = wide ? 113 : 61
  const bandL = START - 32
  const bandR = START + (state.towns.length - 1) * PITCH + 30
  const bandLen = bandR - bandL
  const bandD = useMemo(() => stretchX(BAND.d, BAND.len, bandLen, BAND.capStart, BAND.capEnd), [bandLen])
  const stripW = Math.max(wide ? 1194 : 402, bandR + 24)
  // deck pages scroll inside the hand-drawn box only, clipped ~10px inside its outline so a card sliding past never
  // touches or crosses it (Figma Collection: the tiles always sit clear of the box line)
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
      {/* hand-drawn black frame (Figma 04 콜렉션 › card_shape 1207:10765) */}
      <img src={cardShape} alt="" className="pointer-events-none absolute top-[-1.11%] left-[-1.1%] h-[102.22%] w-[102.2%] max-w-none" />
    </button>
  )

  return (
    <div ref={root} className="relative h-full overflow-hidden bg-[#f9f9f9] font-hand">
      {/* header row as Figma 따뜻한컬러 › Collection 1283:11544: back 40×40 at y 77, title at y 81, Newest at y 88, all 10px higher */}
      <button aria-label={tr('Back')} onClick={onBack} className={`absolute z-20 size-[40px] ${wide ? 'top-[30px] left-[40px]' : 'top-[67px] left-[24px]'}`}>
        <img src={backIcon} alt="" className="size-full" />
      </button>
      <p className={`absolute left-1/2 -translate-x-1/2 text-[24px] leading-[1.3] ${wide ? 'top-[36px]' : 'top-[71px]'}`}>{tr('Collection')}</p>
      <TextButton onClick={() => setNewest(!newest)} className={`absolute z-20 text-[17px] ${wide ? 'top-[40px] right-[40px]' : 'top-[78px] right-[38px]'}`}>
        {tr(newest ? 'Newest' : 'Oldest')}
      </TextButton>

      {/* towns on one grey band; the picked one gets the dark ring */}
      <div className={`absolute inset-x-0 h-[100px] overflow-x-auto ${wide ? 'top-[105px]' : 'top-[134px]'} overflow-y-hidden overscroll-x-none [scrollbar-width:none]`}>
        <div className="relative h-full" style={{ width: stripW }}>
          {/* the hand-drawn grey band the towns sit on, with its own rounded ends */}
          <svg aria-hidden className="pointer-events-none absolute top-[7px] overflow-visible" style={{ left: bandL, width: bandLen, height: BAND.thick }} viewBox={`0 0 ${bandLen} ${BAND.thick}`}>
            <path d={bandD} fill="#CCCCCC" stroke="#000" strokeWidth={2} strokeLinejoin="round" />
          </svg>
          {state.towns.map((t, i) => {
            const on = t.id === town.id
            const size = on ? 64 : 52
            return (
              <button key={t.id} onClick={() => { onTown(t.id); setPage(0) }} aria-pressed={on} className="absolute top-[4px]" style={{ left: START + i * PITCH - size / 2, marginTop: on ? 0 : 6, width: size }}>
                {/* same ring as every town (outline, dark ring when picked); the plaza shows the grey swirl instead of its chief */}
                <Thumb
                  image={t.id === SQUARE_ID ? undefined : state.cards[t.residents[0] ?? '']?.image}
                  thumb={t.id === SQUARE_ID ? SQUARE_THUMB : state.cards[t.residents[0] ?? '']?.thumb}
                  size={size}
                  strong={on}
                  ring={on ? PICKED_RING : ringFor(size, 43)}
                  outline={!on}
                />
                <span className="absolute left-1/2 w-[100px] -translate-x-1/2 truncate text-center text-[16px] leading-[normal]" style={{ top: on ? 72 : 66 }}>
                  {townName(t.name)}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* selected town's deck */}
      <div ref={deckEl} data-deck data-over={overDeck ? 1 : undefined} className="absolute inset-x-0" style={{ top: G.top, height: G.h - CUT, transformOrigin: `${G.boxL + G.boxW / 2}px ${(G.boxH - CUT) / 2}px` }}>
        {/* Figma Collection 787:893: hand-drawn box (Vector 413); darker while a card hovers over it or it's refusing one */}
        <svg aria-hidden viewBox="0 0 382 256" preserveAspectRatio="none" className={`deck-box pointer-events-none absolute top-[1px] overflow-visible transition-[filter] ${overDeck ? 'brightness-[0.62]' : full ? 'brightness-[0.78]' : ''}`} style={{ left: G.boxL, width: G.boxW, height: G.boxH - CUT }}>
          <path d={DECK_D} fill="#E0E0E0" stroke="#000" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>
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
                if (at >= SLOTS) return null
                const c = deck[at]
                return (
                  <div key={k} data-slot={Math.min(at, deck.length)} className="absolute" style={{ left: G.tileX - CLIP_L + (k % G.cols) * COL, top: G.tileY + Math.floor(k / G.cols) * G.row, width: TILE, height: TILE }}>
                    {c ? (
                      <>
                        {tile(c, 'deck', `${c.nickname || tr('Someone')}${at === 0 && !plaza ? tr(', head') : ''}`)}
                        {at === 0 && !plaza && (
                          <span className="pointer-events-none absolute inset-x-[2px] h-[21px] bg-white/70 text-center text-[15px] leading-[22px]" style={{ top: TILE - 23 }}>{tr('Head')}</span>
                        )}
                      </>
                    ) : (
                      <span className="deck-empty block size-full rounded-[3px] border-2 border-[#efefef] bg-[#e7e7e7]" />
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
        {full > 0 && (
          <div role="status" className="animate-pop-in pointer-events-none absolute z-10 flex h-[45px] w-[227px] items-center justify-center" style={{ left: G.boxL + G.boxW / 2 - 113.5, top: (G.boxH - CUT) / 2 - 22 }}>
            <span className="absolute inset-[-2.22%_-0.44%]">
              <PillVillage />
            </span>
            <span className="relative text-[21px] leading-[1.1]">{tr("It's been already full.")}</span>
          </div>
        )}
      </div>

      {/* everyone else (only this part scrolls) */}
      <div className={`absolute inset-x-0 bottom-0 overflow-y-auto [scrollbar-width:none] `} style={{ top: (wide ? 505 : 500) - CUT }}>
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
          className="pointer-events-none absolute z-40 size-[74px] -translate-x-1/2 -translate-y-1/2 scale-[1.2] drop-shadow-[0_8px_16px_rgba(0,0,0,0.25)]"
          style={{ left: drag.x, top: drag.y }}
        >
          <span className="absolute inset-[1px] overflow-hidden rounded-[3px] bg-white">
          {state.cards[drag.id]?.thumb ? (
            <img src={state.cards[drag.id]!.thumb} alt="" className="absolute inset-0 size-full object-cover" />
          ) : (
            <img src={state.cards[drag.id]?.image} alt="" className="absolute top-[5%] left-[-15%] w-[130%] max-w-none" />
          )}
          </span>
          <img src={cardShape} alt="" className="absolute top-[-1.11%] left-[-1.1%] h-[102.22%] w-[102.2%] max-w-none" />
        </div>
      )}

      {open && <Detail wide={wide} card={open} town={(() => { const t = townOf(state, open.id); if (!t) return { name: '' }; const sq = t.id === SQUARE_ID; const chief = state.cards[t.residents[0] ?? '']; return { name: sq ? tr(SQUARE_NAME) : townName(t.name), image: sq ? undefined : chief?.image, thumb: sq ? SQUARE_THUMB : chief?.thumb } })()} onClose={() => setOpenId(null)} onDelete={() => askDelete(open)} onMigrate={() => onMigrate(open.id)} />}

      {popup && <Popup message={popup.message} actions={popup.actions} />}
    </div>
  )
}

// how far the open card's side edges move in when shrink(515) scales it down on a shorter phone
const CARD_INSET = '180px * (1 - clamp(0.5, calc((515 - var(--cut)) / 515), 1))'

// card overlay (Figma 725:13761): tap the drawing to hide the card text, drag to tilt it around
// iPad sideways: the card in the middle of the screen, town name and close above it, Let go at its lower right
function Detail({ wide, card, town, onClose, onDelete, onMigrate }: { wide: boolean; card: Card; town: { name: string; image?: string; thumb?: string }; onClose: () => void; onDelete: () => void; onMigrate: () => void }) {
  const [plain, setPlain] = useState(false)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  const start = useRef<{ x: number; y: number; moved: boolean } | null>(null)
  const [held, setHeld] = useState(false)

  return (
    <div className="animate-fade-in absolute inset-0 z-30 bg-black/35 text-white backdrop-blur-[1.5px]">
      {/* town chip above the card (Figma 04 콜렉션 › Collection 1207:9008): 10px above the card's top, lined up with its left
          edge. On a shorter phone the card shrinks around its top centre (shrink(515)), so its edges move in by
          180px × (1 − scale): the chip and the close button move with them. */}
      <TownChip name={town.name} image={town.image} thumb={town.thumb} className={`absolute ${wide ? 'top-[57px] left-[417px]' : 'top-[155px]'}`} style={wide ? undefined : { left: `calc(21px + ${CARD_INSET})` }} />
      <button aria-label={tr('Close')} onClick={onClose} className={`absolute flex h-[37px] w-[35px] items-center justify-center ${wide ? 'top-[68px] left-[745px]' : 'top-[166px]'}`} style={wide ? undefined : { left: `calc(349px - ${CARD_INSET})` }}>
        <img src={closeRing} alt="" className="absolute inset-0 size-full" />
        <img src={closeX} alt="" className="relative h-[16.78px] w-[14.33px] max-w-none" />
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
        // Figma 따뜻한컬러 › Collection (1283:12306 Group 114): Let go on the left (109×41 at 144), Migration on the
        // right (113×41 at 268), both at y 736; iPad: the same pair at the card's lower right
        const letGo = (
          <button onClick={onDelete} className={`absolute flex h-[41px] w-[109px] items-center justify-center ${wide ? 'top-[652px] left-[539px]' : 'top-[736px] left-[144px]'}`}>
            <img src={pillDiscard} alt="" className="absolute inset-0 size-full" />
            <span className="relative text-[22px] leading-[1.1] text-[#686868]">{tr('Let go')}</span>
          </button>
        )
        // inside the card's outline (card starts at x 21 / 417)
        const actions = <CardActions card={card} light className={`absolute ${wide ? 'top-[652px] left-[426px]' : 'top-[734px] left-[30px]'}`} />
        // Migration right of Let go: opens Town List to pick any town, the plaza included.
        // Warm colours (admins): a grey pill (color_03), like the Figma frame
        const migrate = (
          <button onClick={onMigrate} className={`absolute flex h-[41px] w-[113px] items-center justify-center ${wide ? 'top-[652px] left-[663px]' : 'top-[736px] left-[268px]'}`}>
            <img src={pillDiscard} alt="" className="warm-hide absolute inset-0 size-full" />
            <img src={pillMigrationWarm} alt="" className="warm-only absolute inset-0 size-full" />
            <span className="relative text-[22px] leading-[1.1] text-black">{tr('Migration')}</span>
          </button>
        )
        return wide ? (
          <>
            {actions}
            {migrate}
            {letGo}
          </>
        ) : (
          <Bottom>
            {actions}
            {migrate}
            {letGo}
          </Bottom>
        )
      })()}
    </div>
  )
}
