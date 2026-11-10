import { useEffect, useRef, useState } from 'react'
import { BackIcon, CardView, CloseIcon, HandleIcon, PlusIcon, Popup, TextButton, Thumb, type PopupAction } from '../components/ui'
import { MAX_RESIDENTS, MAX_TOWNS, addTown, canDeleteTown, deleteTown, dotDate, moveTown, newTown, updateTown, type Card, type State, type Town } from '../lib/store'

// Figma prototyping: townList · townList-detail · townList for migration · 마을 추가
// browse  = Go / Edit
// migrate = move an existing card ("Migration")
// send    = place a newly drawn card ("Send")
export type ListMode = 'browse' | 'migrate' | 'send'

const ROW = 124

export default function TownListScreen({
  state,
  commit,
  mode,
  card,
  homeId,
  onBack,
  onGo,
  onPlace,
}: {
  state: State
  commit: (fn: (s: State) => State) => void
  mode: ListMode
  card?: Card // floating card in migrate / send
  homeId?: string // where the card lives now (migrate)
  onBack: () => void
  onGo: (townId: string) => void
  onPlace: (townId: string) => void // after the card flew into the town
}) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({ name: '', bio: '' })
  const [adding, setAdding] = useState<Town | null>(null)
  const [popup, setPopup] = useState<{ message: string; actions: PopupAction[] } | null>(null)
  const [flying, setFlying] = useState<{ x: number; y: number } | null>(null)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dragDy, setDragDy] = useState(0)
  const thumbs = useRef(new Map<string, HTMLElement>())
  const cardEl = useRef<HTMLDivElement>(null)
  const listEl = useRef<HTMLDivElement>(null)

  const gotIt = (message: string) => setPopup({ message, actions: [{ label: 'Got it!', onClick: () => setPopup(null) }] })
  const open = state.towns.find((t) => t.id === openId)
  const dirty = !!open && editing && (draft.name !== open.name || draft.bio !== open.bio)

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
      message: "There's unsaved changes. Do you wanna save?",
      actions: [
        { label: 'Discard', onClick: () => { setPopup(null); setEditing(false); then() } },
        { label: 'Save', onClick: () => { setPopup(null); save(); then() } },
      ],
    })
  }
  function askDelete(t: Town) {
    const why = canDeleteTown(state, t.id)
    if (why === 'residents') return gotIt('You cannot delete town with resident.')
    if (why === 'last') return gotIt('You need at least one town.')
    setPopup({
      message: 'Do you really want to delete?',
      actions: [
        { label: 'Delete', onClick: () => { commit((s) => deleteTown(s, t.id)); setPopup(null); setOpenId(null); setEditing(false) } },
        { label: 'Cancel', onClick: () => setPopup(null) },
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
    const t = { ...adding, name: draft.name.trim() || `New Town ${state.towns.length + 1}`, bio: draft.bio.trim() }
    commit((s) => addTown(s, t))
    setAdding(null)
    setOpenId(t.id)
  }

  function place(t: Town) {
    if (mode === 'migrate' && t.id === homeId) return gotIt('This card already lives here.')
    if (t.residents.length >= MAX_RESIDENTS) return gotIt('This town is full.')
    const from = cardEl.current?.getBoundingClientRect()
    const to = thumbs.current.get(t.id)?.getBoundingClientRect()
    if (!from || !to) return onPlace(t.id)
    setFlying({ x: to.left + to.width / 2 - (from.left + from.width / 2), y: to.top + to.height / 2 - (from.top + from.height / 2) })
    setTimeout(() => onPlace(t.id), 650)
  }

  // ---- reorder with the "=" handle ----
  const dragStart = useRef(0)
  function onHandleDown(e: React.PointerEvent, i: number) {
    e.currentTarget.setPointerCapture(e.pointerId)
    setOpenId(null)
    setEditing(false)
    dragStart.current = e.clientY
    setDragIdx(i)
    setDragDy(0)
  }
  function onHandleMove(e: React.PointerEvent) {
    if (dragIdx === null) return
    let dy = e.clientY - dragStart.current
    const steps = Math.trunc(dy / ROW + Math.sign(dy) * 0.5)
    const to = Math.max(0, Math.min(state.towns.length - 1, dragIdx + steps))
    if (to !== dragIdx) {
      commit((s) => moveTown(s, dragIdx, to))
      dragStart.current += (to - dragIdx) * ROW
      dy -= (to - dragIdx) * ROW
      setDragIdx(to)
    }
    setDragDy(dy)
  }
  function onHandleUp() {
    setDragIdx(null)
    setDragDy(0)
  }

  const action = mode === 'migrate' ? 'Migration' : mode === 'send' ? 'Send' : null

  return (
    <div className="relative h-full overflow-hidden bg-white font-hand">
      {/* header */}
      <button aria-label="Back" onClick={() => (dirty ? askSave(onBack) : onBack())} className="absolute left-[22px] z-20 p-[6px]" style={{ top: 'calc(var(--top) + 10px)' }}>
        <BackIcon />
      </button>
      <h1 className="absolute inset-x-0 z-20 text-center text-[30px] leading-none" style={{ top: 'calc(var(--top) + 16px)' }}>
        Town List
      </h1>
      <button aria-label="Add town" onClick={startAdd} className="absolute right-[22px] z-20 p-[6px]" style={{ top: 'calc(var(--top) + 10px)' }}>
        <PlusIcon />
      </button>

      <div ref={listEl} className="absolute inset-x-0 bottom-0 overflow-y-auto" style={{ top: 'calc(var(--top) + 70px)' }}>
        <div className="relative min-h-full pt-[60px] pb-[200px]">
          {/* the grey line every town hangs on */}
          <div className="absolute top-[95px] bottom-0 left-[27px] w-[79px] bg-bar" />

          {state.towns.map((t, i) => {
            const isOpen = openId === t.id
            const chief = state.cards[t.residents[0] ?? ""]
            const dimmed = (openId && !isOpen) || !!adding
            const lifted = dragIdx === i
            return (
              <div
                key={t.id}
                className={`relative flex ${isOpen ? 'items-start' : 'items-center'} ${lifted ? 'z-10' : 'transition-transform duration-200'}`}
                style={{ minHeight: ROW, transform: lifted ? `translateY(${dragDy}px)` : undefined }}
              >
                {isOpen && <div className="absolute top-[22px] right-[9px] bottom-[18px] left-[95px] rounded-[12px] bg-[#ececec]" />}
                <button
                  aria-label={`${t.name} details`}
                  onClick={() => toggle(t)}
                  className="relative shrink-0"
                  style={{ marginLeft: isOpen ? 24 : 31, marginTop: isOpen ? 22 : 0 }}
                  ref={(el) => {
                    if (el) thumbs.current.set(t.id, el)
                    else thumbs.current.delete(t.id)
                  }}
                >
                  <Thumb image={chief?.image} size={isOpen ? 84 : 70} seed={11 + i} strong={isOpen} grey={!!dimmed} />
                  {isOpen && !editing && mode === 'browse' && (
                    <span
                      onClick={(e) => {
                        e.stopPropagation()
                        onGo(t.id)
                      }}
                      className="absolute -bottom-[18px] left-1/2 -translate-x-1/2 rounded-[4px] border-[2.5px] border-[#5a5a5a] bg-white px-[8px] text-[22px] leading-[1.25]"
                    >
                      Go
                    </span>
                  )}
                </button>

                {!isOpen ? (
                  <>
                    <button onClick={() => toggle(t)} className="relative ml-[23px] flex-1 truncate text-left text-[22px]">
                      {t.name}
                    </button>
                    <span
                      aria-label="Reorder"
                      className="relative mr-[26px] touch-none p-[8px]"
                      onPointerDown={(e) => onHandleDown(e, i)}
                      onPointerMove={onHandleMove}
                      onPointerUp={onHandleUp}
                      onPointerCancel={onHandleUp}
                    >
                      <HandleIcon />
                    </span>
                  </>
                ) : (
                  <div className="relative mt-[30px] mr-[20px] mb-[26px] ml-[18px] flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start gap-[8px]">
                      {editing ? (
                        <input
                          autoFocus
                          value={draft.name}
                          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                          maxLength={20}
                          aria-label="Town name"
                          className="min-w-0 flex-1 border-b border-black/30 bg-transparent text-[26px] leading-[1.1] outline-none"
                        />
                      ) : (
                        <p className="min-w-0 flex-1 truncate text-[26px] leading-[1.1]">{t.name}</p>
                      )}
                      <button aria-label="Close" onClick={close} className="p-[4px]">
                        <CloseIcon />
                      </button>
                    </div>
                    <p className="mt-[2px] text-[12px] text-[#9a9a9a]">
                      Residents {t.residents.length}/{MAX_RESIDENTS}
                    </p>
                    {editing ? (
                      <textarea
                        value={draft.bio}
                        onChange={(e) => setDraft({ ...draft, bio: e.target.value })}
                        maxLength={120}
                        rows={2}
                        placeholder="Write your town biography."
                        aria-label="Town biography"
                        className="mt-[10px] resize-none border-b border-black/30 bg-transparent text-[15px] leading-[1.3] outline-none"
                      />
                    ) : (
                      t.bio && <p className="mt-[10px] text-[15px] leading-[1.3] break-words">{t.bio}</p>
                    )}
                    <p className="mt-[8px] text-[11px]">since {dotDate(t.createdAt)}</p>
                    <div className="mt-[10px] flex justify-between text-[17px]">
                      {editing ? (
                        <>
                          <TextButton dim onClick={() => askDelete(t)}>Delete</TextButton>
                          <TextButton onClick={save}>Done</TextButton>
                        </>
                      ) : action ? (
                        <TextButton onClick={() => place(t)} className="ml-auto">
                          {action}
                        </TextButton>
                      ) : (
                        <TextButton
                          onClick={() => {
                            setDraft({ name: t.name, bio: t.bio })
                            setEditing(true)
                          }}
                          className="ml-auto"
                        >
                          Edit
                        </TextButton>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {/* new town being written */}
          {adding && (
            <div className="relative flex items-start" style={{ minHeight: ROW }}>
              <div className="absolute top-[22px] right-[9px] bottom-[18px] left-[95px] rounded-[12px] bg-[#ececec]" />
              <span className="relative" style={{ marginLeft: 24, marginTop: 22 }}>
                <Thumb size={84} seed={99} strong />
              </span>
              <div className="relative mt-[30px] mr-[20px] mb-[26px] ml-[18px] flex min-w-0 flex-1 flex-col">
                <div className="flex items-start gap-[8px]">
                  <input
                    autoFocus
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    maxLength={20}
                    placeholder={`New Town ${state.towns.length + 1}`}
                    aria-label="Town name"
                    className="min-w-0 flex-1 border-b border-black/30 bg-transparent text-[26px] leading-[1.1] outline-none placeholder:text-[#9a9a9a]"
                  />
                  <button aria-label="Close" onClick={() => setAdding(null)} className="p-[4px]">
                    <CloseIcon />
                  </button>
                </div>
                <p className="mt-[2px] text-[12px] text-[#9a9a9a]">Residents 0/{MAX_RESIDENTS}</p>
                <textarea
                  value={draft.bio}
                  onChange={(e) => setDraft({ ...draft, bio: e.target.value })}
                  maxLength={120}
                  rows={2}
                  placeholder="Write your town biography."
                  aria-label="Town biography"
                  className="mt-[10px] resize-none border-b border-black/30 bg-transparent text-[15px] leading-[1.3] outline-none"
                />
                <p className="mt-[8px] text-[11px]">since {dotDate(adding.createdAt)}</p>
                <div className="mt-[10px] flex justify-between text-[17px]">
                  <TextButton dim onClick={() => setAdding(null)}>Discard</TextButton>
                  <TextButton onClick={create}>Create</TextButton>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* card waiting to move in (townList for migration) */}
      {card && (
        <div
          ref={cardEl}
          className="pointer-events-none absolute right-[14px] bottom-[34px] z-30 w-[115px] drop-shadow-[0_4px_8px_rgba(0,0,0,0.2)]"
          style={{
            transform: flying ? `translate(${flying.x}px, ${flying.y}px) scale(0.15) rotate(0deg)` : 'rotate(6deg)',
            opacity: flying ? 0.2 : 1,
            transition: 'transform 0.6s cubic-bezier(0.5, 0, 0.75, 0), opacity 0.6s ease-in',
          }}
        >
          <CardView card={card} />
        </div>
      )}

      {popup && <Popup message={popup.message} actions={popup.actions} />}
    </div>
  )
}
