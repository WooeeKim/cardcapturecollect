import { useEffect, useRef, useState } from 'react'
import { BackIcon, CardView, CloseIcon, Popup, TextButton, Thumb, type PopupAction } from '../components/ui'
import { MAX_RESIDENTS, deleteCard, placeCard, townOf, type Card, type State } from '../lib/store'

// Figma wireframe: 콜렉션 (town strip → selected town's deck → other towns' cards) + card detail overlay.
// Long-press a card to move it: into the deck (moves in) or to another deck slot (reorder). Slot 1 = chief.
const PER_PAGE = 6
const HOLD_MS = 350

type Drag = { id: string; from: 'deck' | 'rest'; x: number; y: number }

export default function CollectionScreen({
  state,
  commit,
  townId,
  onTown,
  onBack,
  onMigrate,
}: {
  state: State
  commit: (fn: (s: State) => State) => void
  townId: string
  onTown: (id: string) => void
  onBack: () => void
  onMigrate: (cardId: string) => void
}) {
  const [newest, setNewest] = useState(true)
  const [page, setPage] = useState(0)
  const [openId, setOpenId] = useState<string | null>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [popup, setPopup] = useState<{ message: string; actions: PopupAction[] } | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const deckEl = useRef<HTMLDivElement>(null)
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
    const r = root.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
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
  }
  function cancelPress() {
    if (press.current) clearTimeout(press.current.timer)
    press.current = null
    dragging.current = false
    setDrag(null)
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
    const slot = hit?.closest<HTMLElement>('[data-slot]')
    const inDeck = slot || hit?.closest('[data-deck]')
    if (!inDeck) return // cards can't be taken out of a town by dragging
    const at = slot ? Number(slot.dataset.slot) : deck.length
    if (from === 'rest' && deck.length >= MAX_RESIDENTS) {
      return setPopup({ message: 'This town is full.', actions: [{ label: 'Got it!', onClick: () => setPopup(null) }] })
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

  return (
    <div ref={root} className="relative flex h-full flex-col overflow-hidden bg-white font-hand">
      {/* header */}
      <div className="relative h-[64px] shrink-0" style={{ marginTop: 'calc(var(--top) + 4px)' }}>
        <button aria-label="Back" onClick={onBack} className="absolute top-[6px] left-[22px] p-[6px]">
          <BackIcon />
        </button>
        <h1 className="absolute inset-x-0 top-[12px] text-center text-[30px] leading-none">Collection</h1>
        <TextButton onClick={() => setNewest(!newest)} className="absolute top-[16px] right-[22px] text-[16px]">
          {newest ? 'Newest' : 'Oldest'}
        </TextButton>
      </div>

      {/* towns on one line (same look as Town List, laid sideways) */}
      <div className="relative shrink-0 overflow-x-auto pb-[8px] [scrollbar-width:none]">
        <div className="relative flex w-max gap-[18px] px-[20px] pt-[4px]">
          <div className="absolute top-[12px] right-0 left-0 h-[48px] bg-bar" />
          {state.towns.map((t, i) => {
            const chief = state.cards[t.residents[0] ?? ""]
            const on = t.id === town.id
            return (
              <button key={t.id} onClick={() => { onTown(t.id); setPage(0) }} className="relative flex w-[66px] flex-col items-center">
                <Thumb image={chief?.image} size={on ? 64 : 58} seed={11 + i} strong={on} />
                <span className={`mt-[6px] w-full truncate text-center text-[14px] ${on ? '' : 'text-[#777]'}`}>{t.name}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* selected town's deck */}
      <div data-deck className="relative shrink-0 bg-[#dcdcdc] pb-[10px]" ref={deckEl}>
        <div
          className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none]"
          onScroll={(e) => setPage(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
        >
          {Array.from({ length: pages }, (_, p) => (
            <div key={p} className="grid w-full shrink-0 snap-start grid-cols-3 gap-x-[22px] gap-y-[20px] px-[30px] pt-[26px]">
              {Array.from({ length: PER_PAGE }, (_, k) => {
                const at = p * PER_PAGE + k
                if (at >= MAX_RESIDENTS) return <span key={k} />
                const c = deck[at]
                return (
                  <div key={k} data-slot={Math.min(at, deck.length)} className="relative aspect-square">
                    {at === 0 && c && <Crown />}
                    {c ? (
                      <button
                        aria-label={`${c.nickname || 'Card'}${at === 0 ? ', chief' : ''}`}
                        {...cardProps(c, 'deck')}
                        className={`size-full touch-pan-x border-[3px] border-black bg-white p-[3px] ${drag?.id === c.id ? 'opacity-30' : ''}`}
                      >
                        <img src={c.image} alt="" draggable={false} className="pointer-events-none size-full object-contain" />
                      </button>
                    ) : (
                      <span className="block size-full border-[2px] border-dashed border-[#aaa]" />
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
        <div className="mt-[12px] flex justify-center gap-[6px]">
          {Array.from({ length: pages }, (_, p) => (
            <span key={p} className={`size-[7px] rounded-full ${p === page ? 'bg-[#666]' : 'bg-[#aaa]'}`} />
          ))}
        </div>
      </div>

      {/* everyone else (only this part scrolls) */}
      <div className="min-h-0 flex-1 overflow-y-auto px-[30px] pt-[20px] pb-[40px]">
        {rest.length === 0 ? (
          <p className="pt-[30px] text-center text-[17px] text-[#8e8e8e]">Cards in other towns show up here.</p>
        ) : (
          <div className="grid grid-cols-3 gap-x-[22px] gap-y-[20px]">
            {rest.map((c) => (
              <button
                key={c.id}
                aria-label={c.nickname || 'Card'}
                {...cardProps(c, 'rest')}
                className={`aspect-square border-[3px] border-[#b5b5b5] bg-white p-[3px] ${drag?.id === c.id ? 'opacity-30' : ''}`}
              >
                <img src={c.image} alt="" draggable={false} className="pointer-events-none size-full object-contain" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* card following the finger */}
      {drag && (
        <div
          className="pointer-events-none absolute z-40 size-[96px] -translate-x-1/2 -translate-y-1/2 rotate-[-6deg] border-[3px] border-black bg-white p-[3px] shadow-[0_8px_16px_rgba(0,0,0,0.25)]"
          style={{ left: drag.x, top: drag.y }}
        >
          <img src={state.cards[drag.id]?.image} alt="" className="size-full object-contain" />
        </div>
      )}

      {open && (
        <Detail
          card={open}
          townName={townOf(state, open.id)?.name ?? ''}
          onClose={() => setOpenId(null)}
          onMigrate={() => onMigrate(open.id)}
          onDelete={() => askDelete(open)}
        />
      )}

      {popup && <Popup message={popup.message} actions={popup.actions} />}
    </div>
  )
}

function Crown() {
  return (
    <svg viewBox="0 0 40 26" className="absolute -top-[20px] left-1/2 z-10 w-[34px] -translate-x-1/2" aria-label="Chief">
      <path d="M3 24 L3 6 L12 15 L20 2 L28 15 L37 6 L37 24 Z" fill="#000" stroke="#000" strokeWidth={2} strokeLinejoin="round" />
    </svg>
  )
}

// card overlay: tap the drawing to hide the card text, drag to tilt it around
function Detail({ card, townName, onClose, onMigrate, onDelete }: { card: Card; townName: string; onClose: () => void; onMigrate: () => void; onDelete: () => void }) {
  const [plain, setPlain] = useState(false)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  const start = useRef<{ x: number; y: number; moved: boolean } | null>(null)
  const [held, setHeld] = useState(false)

  return (
    <div className="animate-fade-in absolute inset-0 z-30 flex flex-col bg-black/55 px-[34px] text-white">
      <div className="flex items-center justify-between" style={{ marginTop: 'calc(var(--top) + 60px)' }}>
        <p className="text-[20px]">{townName}</p>
        <button aria-label="Close" onClick={onClose} className="p-[6px]">
          <CloseIcon size={18} />
        </button>
      </div>
      <div className="mt-[10px] [perspective:700px]">
        <div
          className="animate-pop-in touch-none"
          style={{
            transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
            transition: held ? 'none' : 'transform 0.5s var(--ease-spring)',
          }}
          onPointerDown={(e) => {
            start.current = { x: e.clientX, y: e.clientY, moved: false }
            setHeld(true)
            e.currentTarget.setPointerCapture(e.pointerId)
          }}
          onPointerMove={(e) => {
            const s = start.current
            if (!s) return
            const dx = e.clientX - s.x
            const dy = e.clientY - s.y
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
      <div className="mt-[22px] flex justify-between text-[20px]">
        <TextButton onClick={onMigrate}>Migration</TextButton>
        <TextButton onClick={onDelete}>Delete</TextButton>
      </div>
    </div>
  )
}
