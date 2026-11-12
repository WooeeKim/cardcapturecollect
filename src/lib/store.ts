// Prototype data: towns + cards, kept in this browser's localStorage only.
export const MAX_TOWNS = 10
export const MAX_RESIDENTS = 18

export type Card = {
  id: string
  image: string // PNG data URL
  thumb?: string // square crop of the head area (where the guide's head is), for town / collection thumbnails
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
  nickname?: string // name shown in the app (separate from the login email)
  intro?: string // short self-introduction on My Page
  insideFilled3?: boolean // one-time: old drawings got their unpainted insides filled white (App.tsx)
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

export const STARTER_TOWN = 'Town 1'

export function initial(): State {
  const base = { towns: [] as Town[] }
  return { towns: [newTown(base, STARTER_TOWN, '')], cards: {}, pending: null, seq: { day: '', n: 0 } }
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
  try {
    localStorage.setItem(`${key}:savedAt`, String(Date.now()))
  } catch {
    // the state itself is saved; without a time the account copy wins on next login
  }
}

// When this device last saved `key` (ms), 0 if never. Used to pick the newer of this device vs the account copy.
export function savedAt(key = GUEST_KEY): number {
  try {
    return Number(localStorage.getItem(`${key}:savedAt`)) || 0
  } catch {
    return 0
  }
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
  return Object.keys(state.cards).length > 0 || state.pending !== null || state.towns.length > 1 || state.towns.some((t) => t.name !== STARTER_TOWN || t.bio)
}

// Guest data joins an account (sign-up or log-in). Safe to run again on the same data: towns/cards the
// account already has (same id) are skipped. Rules:
// - empty account → takes the guest data as is
// - guest's untouched starter town is dropped; a clashing town name gets " (2)", " (3)"…; tones are re-picked
// - towns beyond MAX_TOWNS don't come over, their cards move into towns that still have room
// - both sides have a card waiting to be sent → the account's stays waiting, the guest's moves into a town
// - a guest serial already used by the account is renumbered
// `unplaced` = cards that found no room anywhere (kept in `cards`, just not in a town).
export function mergeGuest(account: State, guest: State): { state: State; unplaced: number } {
  if (!hasContent(guest)) return { state: account, unplaced: 0 }
  if (!hasContent(account)) return { state: guest, unplaced: 0 }

  // ---- cards (+ serials) ----
  const top = new Map<string, number>() // day → highest serial number
  const note = (serial: string) => {
    const m = /^SN(\d{6})-(\d+)$/.exec(serial)
    if (m) top.set(m[1], Math.max(top.get(m[1]) ?? 0, Number(m[2])))
  }
  const accountCards = [...Object.values(account.cards), ...(account.pending ? [account.pending] : [])]
  const known = new Set(accountCards.map((c) => c.id))
  const used = new Set(accountCards.map((c) => c.serial))
  const incoming = [...Object.values(guest.cards), ...(guest.pending ? [guest.pending] : [])]
    .filter((c) => !known.has(c.id))
    .sort((x, y) => x.createdAt.localeCompare(y.createdAt))
  for (const c of [...accountCards, ...incoming]) note(c.serial)
  const added: Record<string, Card> = {}
  for (const c of incoming) {
    let serial = c.serial
    if (used.has(serial)) {
      const day = serial.slice(2, 8)
      const n = (top.get(day) ?? 0) + 1
      top.set(day, n)
      serial = `SN${day}-${String(n).padStart(2, '0')}`
    }
    used.add(serial)
    added[c.id] = { ...c, serial }
  }

  // ---- waiting card ----
  const guestPending = guest.pending && added[guest.pending.id]
  const pending = account.pending ?? guestPending ?? null
  const homeless: string[] = guestPending && pending !== guestPending ? [guestPending.id] : []
  const cards = { ...account.cards, ...added }
  if (pending && pending === guestPending) delete cards[pending.id]

  // ---- towns ----
  const towns = [...account.towns]
  const names = new Set(towns.map((t) => t.name))
  const tones = new Set(towns.map((t) => t.tone))
  for (const g of guest.towns) {
    if (towns.some((t) => t.id === g.id)) continue
    const residents = g.residents.filter((id) => added[id])
    if (residents.length === 0 && !g.bio && g.name === STARTER_TOWN) continue
    if (towns.length >= MAX_TOWNS) {
      homeless.push(...residents)
      continue
    }
    let name = g.name
    for (let k = 2; names.has(name); k++) name = `${g.name} (${k})`
    names.add(name)
    let tone = g.tone
    if (tones.has(tone)) {
      const free = TONES.findIndex((_, i) => !tones.has(i))
      if (free >= 0) tone = free
    }
    tones.add(tone)
    towns.push({ ...g, name, tone, residents })
  }

  // ---- serial counter ----
  const day = account.seq.day >= guest.seq.day ? account.seq.day : guest.seq.day
  const seq = { day, n: Math.max(top.get(day) ?? 0, account.seq.day === day ? account.seq.n : 0, guest.seq.day === day ? guest.seq.n : 0) }

  let state: State = { towns, cards, pending, seq, nickname: account.nickname || guest.nickname, intro: account.intro || guest.intro }
  let unplaced = 0
  for (const id of homeless) {
    const room = state.towns.find((t) => t.residents.length < MAX_RESIDENTS)
    if (room) state = placeCard(state, id, room.id)
    else unplaced++
  }
  return { state, unplaced }
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

// Two cards trade places (each takes the other's town and slot). Used by Collection drag.
export function swapCards(state: State, a: string, b: string): State {
  if (a === b) return state
  const towns = state.towns.map((t) =>
    t.residents.includes(a) || t.residents.includes(b) ? { ...t, residents: t.residents.map((id) => (id === a ? b : id === b ? a : id)) } : t,
  )
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
  const over = MAX_RESIDENTS + 2
  for (let i = 0; i < over; i++) s = draw(s)
  assert(s.towns[0].residents.length === MAX_RESIDENTS, `town caps at ${MAX_RESIDENTS}`)
  assert(s.pending !== null, 'overflow stays pending')
  assert(s.seq.n === over && s.pending!.serial.endsWith(`-${over}`), 'serial counts per day')
  const chief = s.towns[0].residents[0]
  s = placeCard(s, chief, second.id)
  assert(s.towns[1].residents[0] === chief && s.towns[0].residents.length === MAX_RESIDENTS - 1, 'migration moves card')
  assert(canDeleteTown(s, second.id) === 'residents', 'cannot delete inhabited town')
  {
    const a = s.towns[0].residents[1]
    const sw = swapCards(s, a, chief)
    assert(sw.towns[0].residents[1] === chief && sw.towns[1].residents[0] === a, 'swap trades town + slot')
  }
  s = placeCard(s, s.towns[0].residents[3], home, 0)
  assert(s.towns[0].residents.length === MAX_RESIDENTS - 1, 'reorder keeps count')
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
  assert(mergeGuest(initial(), g2).state === g2, 'empty account takes guest data')
  const merged = mergeGuest(s, guest).state
  assert(merged.towns.length === s.towns.length + 1 && Object.keys(merged.cards).length === Object.keys(s.cards).length + 1, 'merge keeps both')
  assert(mergeGuest(s, initial()).state === s, 'empty guest changes nothing')
  // same-name town gets a suffix and its own tone; serial clash is renumbered; merging twice adds nothing
  const acc = oneCard()
  const m1 = mergeGuest(acc, guest).state
  assert(m1.towns.length === 2 && m1.towns[1].name === 'Town 1 (2)', 'same name gets (2)')
  assert(m1.towns[0].tone !== m1.towns[1].tone, 'tones differ')
  const serials = Object.values(m1.cards).map((c) => c.serial)
  assert(new Set(serials).size === 2 && m1.seq.n === 2, 'serials unique, counter moves on')
  const m2 = mergeGuest(m1, guest).state
  assert(m2.towns.length === 2 && Object.keys(m2.cards).length === 2, 'merge is idempotent')
  // untouched starter town is dropped, its waiting card moves into a town when the account has one waiting too
  const gp = makePending(initial(), { image: '', mood: 'Calm', place: '', nickname: '', memo: '' })
  const ap = makePending(acc, { image: '', mood: 'Calm', place: '', nickname: '', memo: '' })
  const m3 = mergeGuest(ap, gp).state
  assert(m3.towns.length === 1 && m3.pending?.id === ap.pending!.id && m3.towns[0].residents.includes(gp.pending!.id), 'both waiting: guest card placed')
  // town cap: overflow towns' cards go to towns with room
  let full = initial()
  for (let i = 1; i < MAX_TOWNS; i++) full = addTown(full, newTown(full, `T${i}`, ''))
  full = sendPending(makePending(full, { image: '', mood: 'Calm', place: '', nickname: '', memo: '' }), full.towns[0].id)
  const m4 = mergeGuest(full, guest)
  assert(m4.state.towns.length === MAX_TOWNS && m4.unplaced === 0 && Object.values(m4.state.cards).every((c) => townOf(m4.state, c.id)), 'cap kept, cards rehomed')
  console.log('store ok')
}
