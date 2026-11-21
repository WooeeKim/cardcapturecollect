import { useEffect, useMemo, useRef, useState } from 'react'
import { CardView, GoTag, fromBottom, HandleIcon, Header, PlusButton, Popup, Thumb, type PopupAction } from '../components/ui'
import { sfx } from '../lib/sound'
import { framePoint } from '../lib/frame'
import tlBox from '../assets/proto/v2/tl-box.svg'
import { BUMPY_TOP, LINE_BG, stretchX } from '../lib/lineShapes'
import tlClose from '../assets/proto/v2/tl-close.svg'
import tlPill from '../assets/proto/v2/tl-edit.svg'
import { MAX_RESIDENTS, MAX_TOWNS, addTown, canDeleteTown, deleteTown, dotDate, moveTown, newTown, updateTown, type Card, type State, type Town } from '../lib/store'
import { townName, tr } from '../lib/i18n'
import { useWide } from '../lib/wide'
import { SQUARE_ID, SQUARE_NAME, SQUARE_PER_USER, SQUARE_THUMB } from '../lib/square'

// Figma prototyping: townList · townList-detail · townList for migration · 마을 추가
// browse  = Go / Edit
// migrate = move an existing card ("Migration")
// send    = place a newly drawn card ("Send")
export type ListMode = 'browse' | 'migrate' | 'send'

// a town under the card being dragged: thumbnail and name pressed in, a little darker (like a button under a finger)
// (thumbnail, name and the open town's box only: a filter on the whole row would lift that box above the grey line)
const DROP_OVER = [
  '[&_[data-thumb]]:brightness-[0.85] [&_[data-thumb]]:scale-[0.94] [&_[data-thumb]]:transition-[transform,filter] [&_[data-thumb]]:duration-150',
  '[&_[data-name]]:scale-[0.94] [&_[data-name]]:origin-left [&_[data-name]]:text-[#333] [&_[data-name]]:transition-[transform,color] [&_[data-name]]:duration-150',
  '[&>img]:brightness-[0.9]',
].join(' ')

const ROW = 130
// iPad sideways (Figma iPad · townList 1033:10719): the same list moved right so the grey line sits at x 271,
// starting a little higher (no status bar), with the reorder handle further out
const WIDE_LIST_X = 251
const WIDE_HANDLE_X = 588
const OPEN_EXTRA = 114 // open row is 244 tall (Figma townList-detail 787:1012)
// the shared town is the last stop, so its open box grows upward instead of hanging below the line
// (Figma 261119 수정 › townList_scroll 1133:8068, Vector 405): it starts 49px above the circle and ends 15px under it,
// its text moves up by SQ_UP; with a Migration / Send pill the box is a little taller so the pill can hang under it
const SQ_BOX_TOP = -49
const SQ_BOX_H = 148
const SQ_BOX_H_PILL = 167
const SQ_UP = 44
// while a card waits in the corner, the list can scroll up until its end sits this high (frame px), clear of the card
const CARD_CLEAR_Y = 485
// the grey line (Figma 261119 수정 › line_bg): 84 wide, centred on the thumbnails, from 12px above the first one to
// 11px below the last; only its middle stretches as towns are added, the rounded ends keep their shape
const RAIL_X = 24
const RAIL_TOP = 44 - 12
const RAIL_PAD = 11
// the list scrolls up under a cover with a wavy bottom edge (Figma 울퉁불퉁), so it starts this much higher
const UNDER = 40

// the shared town (lib/square.ts, Figma Section 1 1133:7217 "Transfer"): one more row at the end of the list, the grey swirl
// as its thumbnail (same ring as other towns); no Edit, no reorder
export type SquareInfo = { town: Town; chief?: Card; mine: number; ok: boolean }

export default function TownListScreen({
  state,
  commit,
  mode,
  card,
  homeId,
  square,
  loggedIn = true,
  onBack,
  onGo,
  onPlace,
}: {
  state: State
  commit: (fn: (s: State) => State) => void
  mode: ListMode
  card?: Card // floating card in migrate / send
  homeId?: string // where the card lives now (migrate)
  square?: SquareInfo
  loggedIn?: boolean
  onBack: () => void
  onGo: (townId: string) => void
  onPlace: (townId: string) => void // after the card flew into the town
}) {
  const wide = useWide()
  const [openId, setOpenId] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({ name: '', bio: '' })
  const [adding, setAdding] = useState<Town | null>(null)
  const [popup, setPopup] = useState<{ message: string; actions: PopupAction[] } | null>(null)
  const [flying, setFlying] = useState<{ x: number; y: number } | null>(null)
  // the waiting card held by a finger: offset from its resting spot (frame px), and the town row under the finger
  const [carry, setCarry] = useState<{ x: number; y: number } | null>(null)
  const [over, setOver] = useState<string | null>(null)
  const carryStart = useRef<{ x: number; y: number } | null>(null)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dragDy, setDragDy] = useState(0)
  const thumbs = useRef(new Map<string, HTMLElement>())
  const cardEl = useRef<HTMLDivElement>(null)
  const listEl = useRef<HTMLDivElement>(null)

  const openIndex = state.towns.findIndex((t) => t.id === openId)
  const chiefOf = (t: Town) => state.cards[t.residents[0] ?? '']
  // the swirl fills the circle (thumb), it isn't a drawing to crop to the upper body (image)
  const chiefImage = (t: Town) => (isSquare(t) ? undefined : chiefOf(t)?.image)
  const chiefThumb = (t: Town) => (isSquare(t) ? SQUARE_THUMB : chiefOf(t)?.thumb)
  const gotIt = (message: string) => setPopup({ message, actions: [{ label: tr('Got it!'), onClick: () => setPopup(null) }] })
  const open = state.towns.find((t) => t.id === openId)
  const isSquare = (t: Town) => t.id === SQUARE_ID
  const dirty = !!open && editing && (draft.name !== open.name || draft.bio !== open.bio)

  // card waiting + shared town opened: bring it up above the card
  useEffect(() => {
    if (card && openId === SQUARE_ID) listEl.current?.scrollTo({ top: listEl.current.scrollHeight, behavior: 'smooth' })
  }, [card, openId])

  useEffect(() => {
    if (adding) listEl.current?.scrollTo({ top: listEl.current.scrollHeight, behavior: 'smooth' })
  }, [adding])

  function toggle(t: Town) {
    if (adding) return
    if (openId === t.id) return close()
    if (dirty) return askSave(() => openRow(t))
    openRow(t)
  }
  function openRow(t: Town) {
    setOpenId(t.id)
    setEditing(false)
  }
  function close() {
    if (dirty) return askSave(() => setOpenId(null))
    setOpenId(null)
    setEditing(false)
  }
  function save() {
    if (!open) return
    commit((s) => updateTown(s, open.id, { name: draft.name.trim() || open.name, bio: draft.bio.trim() }))
    setEditing(false)
  }
  function askSave(then: () => void) {
    setPopup({
      message: tr("There's unsaved changes.\nDo you wanna save?"),
      actions: [
        { label: tr('Discard'), onClick: () => { setPopup(null); setEditing(false); then() } },
        { label: tr('Save'), onClick: () => { setPopup(null); save(); then() } },
      ],
    })
  }
  function askDelete(t: Town) {
    const why = canDeleteTown(state, t.id)
    if (why === 'residents') return gotIt(tr('You cannot delete town with resident.'))
    if (why === 'last') return gotIt(tr('You need at least one town.'))
    setPopup({
      message: tr('Do you really want to delete?'),
      actions: [
        { label: tr('Delete'), onClick: () => { commit((s) => deleteTown(s, t.id)); setPopup(null); setOpenId(null); setEditing(false) } },
        { label: tr('Cancel'), onClick: () => setPopup(null) },
      ],
    })
  }
  function startAdd() {
    if (state.towns.length >= MAX_TOWNS) return gotIt(`You can have up to ${MAX_TOWNS} towns.`)
    if (dirty) return askSave(startAdd)
    setOpenId(null)
    setEditing(false)
    const t = newTown(state, '', '')
    setAdding(t)
    setDraft({ name: '', bio: '' })
  }
  function create() {
    if (!adding) return
    const t = { ...adding, name: draft.name.trim() || tr('New Town {n}', { n: state.towns.length + 1 }), bio: draft.bio.trim() }
    commit((s) => addTown(s, t))
    setAdding(null)
    setOpenId(t.id)
  }

  // `carried` = where the dragged card was let go (offset from its resting spot), so it flies on from there
  function place(t: Town, carried = { x: 0, y: 0 }) {
    if (mode === 'migrate' && t.id === homeId) return gotIt(tr('This person already lives here.'))
    if (isSquare(t)) {
      if (!loggedIn) return gotIt(tr('Log in to move someone to {name}.', { name: tr(SQUARE_NAME) }))
      if (!square?.ok) return gotIt(tr("Couldn't reach {name}. Try again in a moment.", { name: tr(SQUARE_NAME) }))
      if (square.mine >= SQUARE_PER_USER) return gotIt(tr('You can have up to {n} people in {name}.', { n: SQUARE_PER_USER, name: tr(SQUARE_NAME) }))
    } else if (t.residents.length >= MAX_RESIDENTS) return gotIt(tr('This town is full.'))
    const from = cardEl.current?.getBoundingClientRect()
    const to = thumbs.current.get(t.id)?.querySelector('[data-thumb]')?.getBoundingClientRect()
    if (!from || !to) return onPlace(t.id)
    const a = framePoint(from.left + from.width / 2, from.top + from.height / 2)
    const b = framePoint(to.left + to.width / 2, to.top + to.height / 2)
    setFlying({ x: carried.x + b.x - a.x, y: carried.y + b.y - a.y })
    sfx.moveIn()
    setTimeout(() => onPlace(t.id), 650)
  }

  // ---- drag the waiting card onto a town (same as opening it and pressing Send / Migration) ----
  const townAt = (clientX: number, clientY: number) => {
    for (const el of document.elementsFromPoint(clientX, clientY)) {
      const id = (el as HTMLElement).closest<HTMLElement>('[data-town]')?.dataset.town
      if (id) return id
    }
    return null
  }
  const townById = (id: string) => (id === SQUARE_ID ? square?.town : state.towns.find((t) => t.id === id)) ?? null
  function onCardDown(e: React.PointerEvent) {
    if (flying) return
    e.currentTarget.setPointerCapture(e.pointerId)
    carryStart.current = framePoint(e.clientX, e.clientY)
    setCarry({ x: 0, y: 0 })
  }
  function onCardMove(e: React.PointerEvent) {
    const s0 = carryStart.current
    if (!s0) return
    const p = framePoint(e.clientX, e.clientY)
    setCarry({ x: p.x - s0.x, y: p.y - s0.y })
    setOver(townAt(e.clientX, e.clientY))
    // near the top / bottom of the list: scroll it so far towns can be reached
    const list = listEl.current
    if (list) {
      const r = list.getBoundingClientRect()
      if (e.clientY < r.top + 60) list.scrollTop -= 12
      else if (e.clientY > r.bottom - 60) list.scrollTop += 12
    }
  }
  function onCardUp(e: React.PointerEvent) {
    if (!carryStart.current) return
    carryStart.current = null
    const id = townAt(e.clientX, e.clientY)
    const t = id ? townById(id) : null
    const offset = carry ?? { x: 0, y: 0 }
    setOver(null)
    setCarry(null) // back to its spot unless it flies into the town
    if (t && Math.hypot(offset.x, offset.y) > 12) place(t, offset)
  }
  function onCardCancel() {
    carryStart.current = null
    setOver(null)
    setCarry(null)
  }

  // ---- reorder with the "=" handle ----
  const dragStart = useRef(0)
  function onHandleDown(e: React.PointerEvent, i: number) {
    e.currentTarget.setPointerCapture(e.pointerId)
    setOpenId(null)
    setEditing(false)
    dragStart.current = framePoint(e.clientX, e.clientY).y
    setDragIdx(i)
    setDragDy(0)
  }
  function onHandleMove(e: React.PointerEvent) {
    if (dragIdx === null) return
    let dy = framePoint(e.clientX, e.clientY).y - dragStart.current
    let dragIdxNow = dragIdx
    const steps = Math.trunc(dy / ROW + Math.sign(dy) * 0.5)
    const to = Math.max(0, Math.min(state.towns.length - 1, dragIdx + steps))
    if (to !== dragIdx) {
      commit((s) => moveTown(s, dragIdx, to))
      dragStart.current += (to - dragIdx) * ROW
      dy -= (to - dragIdx) * ROW
      setDragIdx(to)
      dragIdxNow = to
    }
    // stay on the grey bar: the first town can't go above the top slot, the last can't go below the bottom one
    setDragDy(Math.max(-dragIdxNow * ROW, Math.min((state.towns.length - 1 - dragIdxNow) * ROW, dy)))
  }
  function onHandleUp() {
    setDragIdx(null)
    setDragDy(0)
  }

  const action = mode === 'migrate' ? tr('Migration') : mode === 'send' ? tr('Send') : null

  // Figma townList geometry (frame px). The list scrolls under a white header (0–149).
  const rowTop = (i: number) => 44 + i * ROW + (openIndex >= 0 && i > openIndex ? OPEN_EXTRA : 0)
  const squareTop = rowTop(state.towns.length) + (adding ? ROW + OPEN_EXTRA : 0)
  // open shared town: its box grows upward, so the row only gets taller for a Migration / Send pill under it
  const squareExtra = action ? 20 : 0
  const listEnd = square ? squareTop + ROW + (openId === SQUARE_ID ? squareExtra : 0) : squareTop
  // with a card in the corner, leave enough room under the list that its end can scroll up to CARD_CLEAR_Y
  const listHeight: number | string = card && !wide ? `max(${listEnd + 120}px, calc(${listEnd}px + 100% - ${CARD_CLEAR_Y - 109}px))` : listEnd + 120
  // the grey line runs from the first row to just under the last one (open rows have the bigger 84px thumbnail)
  const n = state.towns.length
  const last = square ? { top: squareTop, open: openId === SQUARE_ID } : adding ? { top: rowTop(n), open: true } : { top: rowTop(n - 1), open: openIndex === n - 1 }
  const listTop = wide ? 121 : 149
  const railH = last.top + (last.open ? 84 : 70) + RAIL_PAD - RAIL_TOP
  const railD = useMemo(() => stretchX(LINE_BG.d, LINE_BG.len, railH, LINE_BG.capStart, LINE_BG.capEnd), [railH])

  // hand-drawn pill button (Figma Vector 406); grey label for the "leave it" side
  const pill = (label: string, onClick: () => void, left: number, grey = false) => (
    <button onClick={onClick} className="absolute top-[147px] flex h-[41px] items-center justify-center" style={{ left, width: label.length > 4 ? 84 : 69 }}>
      <img src={tlPill} alt="" className="absolute inset-[-2.5%_-1.5%] size-[calc(100%+3%)] max-w-none" />
      <span className={`relative text-[20px] leading-[1.3] ${grey ? 'text-[#686868]' : ''}`}>{label}</span>
    </button>
  )

  // open town (Figma townList-detail 787:1012): hand-drawn box, Go tag, Edit pill.
  // Edit mode uses the same size and position as view mode.
  const detail = (t: Town | null) => {
    const isNew = !t
    const sq = !!t && isSquare(t)
    const editable = isNew || (editing && !sq)
    const up = sq ? SQ_UP : 0
    return (
      <>
        {/* townList-detail variant 2: the box grows out of the grey line. It starts well inside the line and sits
            behind it (-z), so the line's wavy edge covers the box's left end with no gap.
            Its top lines up with the thumbnail circle; the Edit/Done pill hangs over its bottom edge. */}
        <img src={tlBox} alt="" className="animate-tl-box pointer-events-none absolute left-[64px] -z-10 w-[329px] max-w-none origin-left" style={sq ? { top: SQ_BOX_TOP, height: action ? SQ_BOX_H_PILL : SQ_BOX_H } : { top: 0, height: 162 }} />
        {/* data-keyboard-box: while typing, the whole open box (pills too) moves up above the keyboard (main.tsx) */}
        <div data-keyboard-box className="animate-tl-content absolute inset-x-0 bottom-0" style={{ top: -up }}>
        {editable ? (
          <input
            autoFocus
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            maxLength={20}
            placeholder={isNew ? tr('New Town {n}', { n: state.towns.length + 1 }) : ''}
            aria-label={tr('Town name')}
            className="absolute top-[22px] left-[135px] h-[27.3px] w-[205px] bg-transparent text-[21px] leading-[1.3] outline-none placeholder:text-[#5f5f5f]"
          />
        ) : (
          <p data-name className="absolute top-[22px] left-[135px] w-[205px] truncate text-[21px] leading-[1.3]">{sq ? tr(SQUARE_NAME) : townName(t!.name)}</p>
        )}
        <button aria-label={tr('Close')} onClick={isNew ? () => setAdding(null) : close} className="absolute top-[14px] left-[344px] flex size-[28px] items-center justify-center">
          <img src={tlClose} alt="" className="h-[14.8px] w-[12.3px]" />
        </button>
        <p className="absolute top-[54px] left-[135px] text-[14px] leading-[normal] text-[#8e8e8e]">
          {sq ? tr('Residents {n}/no limits', { n: t!.residents.length }) : `Residents ${t ? t.residents.length : 0}/${MAX_RESIDENTS}`}
        </p>
        {editable ? (
          <textarea
            value={draft.bio}
            onChange={(e) => setDraft({ ...draft, bio: e.target.value })}
            maxLength={100}
            rows={2}
            placeholder={tr('Write your town biography.')}
            aria-label={tr('Town biography')}
            className="absolute top-[77px] left-[135px] w-[235px] resize-none bg-transparent text-[17px] leading-[1.2] outline-none placeholder:text-[#5f5f5f]"
          />
        ) : (
          <p className="absolute top-[77px] left-[135px] line-clamp-2 w-[235px] text-[17px] leading-[1.2] break-words">{sq ? tr('You can send your character only {n}!', { n: SQUARE_PER_USER }) : t!.bio}</p>
        )}
        <p className="absolute left-[135px] text-[14px] leading-[1.3] text-[#8e8e8e]" style={{ top: sq ? 102 : 127 }}>since {dotDate(t ? t.createdAt : adding!.createdAt)}</p>
        {isNew ? (
          <>
            {pill(tr('Discard'), () => setAdding(null), 133, true)}
            {pill(tr('Create'), create, 296)}
          </>
        ) : editing ? (
          <>
            {pill(tr('Delete'), () => askDelete(t!), 133, true)}
            {pill(tr('Done'), save, 311)}
          </>
        ) : action ? (
          pill(action, () => place(t!), action.length > 4 ? 296 : 311)
        ) : sq ? null : (
          pill(tr('Edit'), () => {
            setDraft({ name: t!.name, bio: t!.bio })
            setEditing(true)
          }, 311)
        )}
        </div>
        <span data-thumb className="animate-tl-thumb pointer-events-none absolute top-0 left-[24px]">
          <Thumb image={t ? chiefImage(t) : undefined} thumb={t ? chiefThumb(t) : undefined} size={84} strong />
        </span>
        {/* Go sits on top of the thumbnail, centered under it */}
        {t && !editing && mode === 'browse' && (
          <button aria-label={tr('Go to {name}', { name: sq ? tr(SQUARE_NAME) : townName(t.name) })} onClick={() => onGo(t.id)} className="absolute top-[70px] left-[39px] z-10">
            <GoTag />
          </button>
        )}
      </>
    )
  }

  return (
    <div className="relative h-full overflow-hidden bg-[#f9f9f9] font-hand">
      <Header title={tr('Town List')} onBack={() => (dirty ? askSave(onBack) : onBack())} right={<PlusButton label={tr('Add town')} onClick={startAdd} />} />
      {/* the list slides up under a cover with a wavy bottom edge (Figma 261119 수정 › townList, 울퉁불퉁), not a
          gradient: the same colour as the screen behind it and no outline, so only the cut-off line and towns show the edge */}
      <svg aria-hidden viewBox={`0 0 ${BUMPY_TOP.w} ${BUMPY_TOP.h}`} preserveAspectRatio="none" className="pointer-events-none absolute inset-x-0 top-0 z-10 w-full" style={{ height: listTop }}>
        <path d={BUMPY_TOP.d} fill="#F9F9F9" />
      </svg>

      <div ref={listEl} className="absolute inset-x-0 bottom-0 overflow-y-auto [scrollbar-width:none]" style={{ top: listTop - UNDER }}>
        <div className="relative isolate min-h-full overflow-hidden" style={{ height: listHeight, marginTop: UNDER, marginLeft: wide ? WIDE_LIST_X : undefined, width: wide ? WIDE_HANDLE_X + 60 : undefined }}>
          {/* the grey line every town hangs on (Figma line_bg), lying down in its own drawing: x 0 = bottom end */}
          <svg aria-hidden className="pointer-events-none absolute overflow-visible" style={{ left: RAIL_X, top: RAIL_TOP, width: LINE_BG.thick, height: railH }} viewBox={`0 0 ${LINE_BG.thick} ${railH}`}>
            <path d={railD} transform={`translate(0 ${railH}) rotate(-90)`} fill="#CCCCCC" stroke="#000" strokeWidth={2} strokeLinejoin="round" />
          </svg>

          {state.towns.map((t, i) => {
            const isOpen = openId === t.id
            const dimmed = (!!openId && !isOpen) || !!adding
            const lifted = dragIdx === i
            return (
              <div
                key={t.id}
                data-town={t.id}
                className={`absolute inset-x-0 ${lifted ? 'z-10' : 'transition-[top] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]'} ${over === t.id ? DROP_OVER : ''}`}
                style={{ top: rowTop(i) + (lifted ? dragDy : 0), height: isOpen ? ROW + OPEN_EXTRA : ROW }}
                ref={(el) => {
                  if (el) thumbs.current.set(t.id, el)
                  else thumbs.current.delete(t.id)
                }}
              >
                {isOpen ? (
                  detail(t)
                ) : (
                  <>
                    {/* the whole row is a touch area (like a list row), not just the thumbnail and name */}
                    <button aria-hidden tabIndex={-1} onClick={() => toggle(t)} className="absolute inset-0" />
                    <button aria-label={`${t.name} details`} onClick={() => toggle(t)} data-thumb className="absolute top-0 left-[31px]">
                      <Thumb image={chiefImage(t)} thumb={chiefThumb(t)} size={70} grey={dimmed} outline />
                    </button>
                    <button data-name onClick={() => toggle(t)} className="absolute top-[23px] left-[136px] max-w-[205px] truncate text-left text-[21px] leading-[1.1]">
                      {townName(t.name)}
                    </button>
                    <span
                      aria-label={tr('Reorder')}
                      className="absolute top-[20px] flex size-[30px] touch-none items-center justify-center"
                      style={{ left: wide ? WIDE_HANDLE_X : 352 }}
                      onPointerDown={(e) => onHandleDown(e, i)}
                      onPointerMove={onHandleMove}
                      onPointerUp={onHandleUp}
                      onPointerCancel={onHandleUp}
                    >
                      <HandleIcon />
                    </span>
                  </>
                )}
              </div>
            )
          })}

          {adding && (
            <div className="absolute inset-x-0" style={{ top: rowTop(state.towns.length), height: ROW + OPEN_EXTRA }}>
              {detail(null)}
            </div>
          )}

          {square && (
            <div
              data-town={SQUARE_ID}
              className={`absolute inset-x-0 transition-[top] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${over === SQUARE_ID ? DROP_OVER : ''}`}
              style={{ top: squareTop, height: openId === SQUARE_ID ? ROW + squareExtra : ROW }}
              ref={(el) => {
                if (el) thumbs.current.set(SQUARE_ID, el)
                else thumbs.current.delete(SQUARE_ID)
              }}
            >
              {openId === SQUARE_ID ? (
                detail(square.town)
              ) : (
                <>
                  <button aria-hidden tabIndex={-1} onClick={() => toggle(square.town)} className="absolute inset-0" />
                  <button aria-label={tr('{name} details', { name: tr(SQUARE_NAME) })} onClick={() => toggle(square.town)} data-thumb className="absolute top-0 left-[31px]">
                    <Thumb image={chiefImage(square.town)} thumb={chiefThumb(square.town)} size={70} grey={(!!openId && openId !== SQUARE_ID) || !!adding} outline />
                  </button>
                  <button data-name onClick={() => toggle(square.town)} className="absolute top-[23px] left-[136px] max-w-[205px] truncate text-left text-[21px] leading-[1.1]">
                    {tr(SQUARE_NAME)}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* card waiting to move in (townList for migration): drag it onto a town, or open a town and press the pill */}
      {card && (
        <div
          ref={cardEl}
          aria-label={tr('Drag onto a town to move in')}
          className={`absolute z-30 w-[115px] touch-none select-none ${carry ? 'cursor-grabbing drop-shadow-[0_10px_18px_rgba(0,0,0,0.3)]' : 'cursor-grab drop-shadow-[0_4px_8px_rgba(0,0,0,0.2)]'}`}
          style={{
            left: wide ? 960 : 290,
            top: fromBottom(676),
            transform: flying
              ? `translate(${flying.x}px, ${flying.y}px) scale(0.15) rotate(0deg)`
              : carry
                ? `translate(${carry.x}px, ${carry.y}px) scale(0.85) rotate(0deg)`
                : 'rotate(6deg)',
            opacity: flying ? 0.2 : 1,
            transition: carry ? 'none' : flying ? 'transform 0.6s cubic-bezier(0.5, 0, 0.75, 0), opacity 0.6s ease-in' : 'transform 0.3s var(--ease-spring)',
          }}
          onPointerDown={onCardDown}
          onPointerMove={onCardMove}
          onPointerUp={onCardUp}
          onPointerCancel={onCardCancel}
        >
          <div className="pointer-events-none">
            <CardView card={card} />
          </div>
        </div>
      )}

      {popup && <Popup message={popup.message} actions={popup.actions} />}
    </div>
  )
}
