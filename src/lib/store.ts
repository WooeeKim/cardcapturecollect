// Prototype data: towns + cards, kept in this browser's localStorage only.
export const MAX_TOWNS = 10
export const MAX_RESIDENTS = 10

export type Card = {
  id: string
  image: string // PNG data URL
  mood: string
  place: string
  nickname: string
  memo: string
  createdAt: string // ISO
  serial: string // SN261126-07
}

export type Town = {
  id: string
  name: string
  bio: string
  createdAt: string
  tone: number // index into TONES
  residents: string[] // card ids, first one = chief
}

export type State = {
  towns: Town[]
  cards: Record<string, Card>
  pending: Card | null // finished drawing not yet sent to a town
  seq: { day: string; n: number } // serial counter for the day
}

// Ground / sky per town: same two-band look, each town a slightly different tint.
export const TONES: { sky: string; ground: string }[] = [
  { sky: '#f0f0f0', ground: '#c4c4c4' },
  { sky: '#f1efea', ground: '#c9c1b3' },
  { sky: '#eef1ef', ground: '#b7c4bb' },
  { sky: '#efeef2', ground: '#c0bacb' },
  { sky: '#f2eeed', ground: '#c9bab5' },
  { sky: '#edf0f2', ground: '#b6c2cc' },
  { sky: '#f1f0ea', ground: '#cbc5ab' },
  { sky: '#eff1ec', ground: '#bec8b2' },
  { sky: '#f2eef0', ground: '#c8b8c2' },
  { sky: '#ecf0f0', ground: '#b4bfbf' },
]

// Guest data lives under GUEST_KEY; each account under `${GUEST_KEY}:${userId}`.
export const GUEST_KEY = 'subwayseal.proto.v1'
export const keyFor = (userId: string | null) => (userId ? `${GUEST_KEY}:${userId}` : GUEST_KEY)
const today = () => new Date().toISOString()
const uid = () => crypto.randomUUID()

export function newTown(state: Pick<State, 'towns'>, name: string, bio: string): Town {
  const used = new Set(state.towns.map((t) => t.tone))
  const tone = TONES.findIndex((_, i) => !used.has(i))
  return { id: uid(), name, bio, createdAt: today(), tone: tone < 0 ? 0 : tone, residents: [] }
}

export function initial(): State {
  const base = { towns: [] as Town[] }
  return { towns: [newTown(base, 'Town 1', '')], cards: {}, pending: null, seq: { day: '', n: 0 } }
}

export function load(key = GUEST_KEY): State {
  try {
    const raw = localStorage.getItem(key)
    if (raw) return JSON.parse(raw) as State
  } catch {
    // private mode / broken data → start fresh
  }
  return initial()
}

// Throws on quota errors so the caller can tell the user instead of silently losing data.
export function save(state: State, key = GUEST_KEY) {
  localStorage.setItem(key, JSON.stringify(state))
}

// YYMMDD of a date in local time
export function ymd(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${String(d.getFullYear()).slice(2)}${p(d.getMonth() + 1)}${p(d.getDate())}`
}

// "since 26.11.10"
export function dotDate(iso: string) {
  const s = ymd(new Date(iso))
  return `${s.slice(0, 2)}.${s.slice(2, 4)}.${s.slice(4)}`
}

export function hasContent(state: State) {
  return Object.keys(state.cards).length > 0 || state.pending !== null || state.towns.length > 1 || state.towns.some((t) => t.name !== 'Town 1' || t.bio)
}

// Guest data joins an account: empty account → takes the guest data as is; otherwise guest towns/cards are added on.
export function mergeGuest(account: State, guest: State): State {
  if (!hasContent(guest)) return account
  if (!hasContent(account)) return guest
  return {
    towns: [...account.towns, ...guest.towns],
    cards: { ...account.cards, ...guest.cards },
    pending: account.pending ?? guest.pending,
    seq: account.seq.day >= guest.seq.day ? account.seq : guest.seq,
  }
}

export function townOf(state: State, cardId: string) {
  return state.towns.find((t) => t.residents.includes(cardId))
}

// ---- towns ----

export function addTown(state: State, town: Town): State {
  if (state.towns.length >= MAX_TOWNS) return state
  return { ...state, towns: [...state.towns, town] }
}

export function updateTown(state: State, id: string, patch: Partial<Pick<Town, 'name' | 'bio'>>): State {
  return { ...state, towns: state.towns.map((t) => (t.id === id ? { ...t, ...patch } : t)) }
}

export function canDeleteTown(state: State, id: string): 'ok' | 'residents' | 'last' {
  const t = state.towns.find((x) => x.id === id)
  if (t && t.residents.length > 0) return 'residents'
  if (state.towns.length <= 1) return 'last'
  return 'ok'
}

export function deleteTown(state: State, id: string): State {
  if (canDeleteTown(state, id) !== 'ok') return state
  return { ...state, towns: state.towns.filter((t) => t.id !== id) }
}

export function moveTown(state: State, from: number, to: number): State {
  const towns = [...state.towns]
  const [t] = towns.splice(from, 1)
  towns.splice(to, 0, t)
  return { ...state, towns }
}

// ---- cards ----

// Put a card into a town at `index` (end by default), removing it from wherever it lived.
// Returns the same state if the target town is full (and the card isn't already there).
export function placeCard(state: State, cardId: string, townId: string, index?: number): State {
  const target = state.towns.find((t) => t.id === townId)
  if (!target) return state
  const inside = target.residents.includes(cardId)
  if (!inside && target.residents.length >= MAX_RESIDENTS) return state
  const towns = state.towns.map((t) => {
    const residents = t.residents.filter((id) => id !== cardId)
    if (t.id !== townId) return residents.length === t.residents.length ? t : { ...t, residents }
    const at = Math.min(index ?? residents.length, residents.length)
    residents.splice(at, 0, cardId)
    return { ...t, residents }
  })
  return { ...state, towns }
}

export function deleteCard(state: State, cardId: string): State {
  const cards = { ...state.cards }
  delete cards[cardId]
  return { ...state, cards, towns: state.towns.map((t) => ({ ...t, residents: t.residents.filter((id) => id !== cardId) })) }
}

export function makePending(state: State, input: Omit<Card, 'id' | 'createdAt' | 'serial'>): State {
  const now = new Date()
  const day = ymd(now)
  const n = state.seq.day === day ? state.seq.n + 1 : 1
  const card: Card = { ...input, id: uid(), createdAt: now.toISOString(), serial: `SN${day}-${String(n).padStart(2, '0')}` }
  return { ...state, pending: card, seq: { day, n } }
}

export function sendPending(state: State, townId: string): State {
  const card = state.pending
  if (!card) return state
  const next = placeCard({ ...state, cards: { ...state.cards, [card.id]: card } }, card.id, townId)
  // town was full → keep it pending
  if (!next.towns.some((t) => t.residents.includes(card.id))) return state
  return { ...next, pending: null }
}

// Self-check: `npx tsx src/lib/store.ts`
const argv = (globalThis as { process?: { argv: string[] } }).process?.argv
if (argv?.[1]?.endsWith('store.ts')) {
  const assert = (ok: boolean, msg: string) => {
    if (!ok) throw new Error(msg)
  }
  let s = initial()
  const home = s.towns[0].id
  const second = newTown(s, 'Two', '')
  s = addTown(s, second)
  const draw = (st: State) => sendPending(makePending(st, { image: '', mood: 'Calm', place: '', nickname: '', memo: '' }), home)
  for (let i = 0; i < 12; i++) s = draw(s)
  assert(s.towns[0].residents.length === MAX_RESIDENTS, 'town caps at 10')
  assert(s.pending !== null, 'overflow stays pending')
  assert(s.seq.n === 12 && s.pending!.serial.endsWith('-12'), 'serial counts per day')
  const chief = s.towns[0].residents[0]
  s = placeCard(s, chief, second.id)
  assert(s.towns[1].residents[0] === chief && s.towns[0].residents.length === 9, 'migration moves card')
  assert(canDeleteTown(s, second.id) === 'residents', 'cannot delete inhabited town')
  s = placeCard(s, s.towns[0].residents[3], home, 0)
  assert(s.towns[0].residents.length === 9, 'reorder keeps count')
  s = deleteCard(s, chief)
  assert(canDeleteTown(s, second.id) === 'ok', 'empty town deletable')
  s = deleteTown(s, second.id)
  assert(canDeleteTown(s, home) !== 'ok', 'last/inhabited town stays')
  const oneCard = () => {
    const g = initial()
    return sendPending(makePending(g, { image: '', mood: 'Calm', place: '', nickname: '', memo: '' }), g.towns[0].id)
  }
  const guest = oneCard()
  const g2 = oneCard()
  assert(mergeGuest(initial(), g2) === g2, 'empty account takes guest data')
  const merged = mergeGuest(s, guest)
  assert(merged.towns.length === s.towns.length + 1 && Object.keys(merged.cards).length === Object.keys(s.cards).length + 1, 'merge keeps both')
  assert(mergeGuest(s, initial()) === s, 'empty guest changes nothing')
  console.log('store ok')
}
