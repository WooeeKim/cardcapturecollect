import { supabase, type User } from './auth'
import { type Card, type State, type Town } from './store'
import transferIcon from '../assets/proto/v2/transfer.svg'

// The shared town ("Transfer", was "Sharing Plaza"; supabase/migrations/015_square.sql): every user sees the same town at the end of
// their Town List. A card moved in leaves its owner's town (it stays in their `cards`, just in no town) and lives
// in table `square_cards`; moving it back deletes the row. Up to SQUARE_PER_USER per account, logged-in only.
// Without Supabase (no key in .env.local) it's kept in this browser so the flow can still be tried.
export const SQUARE_ID = 'square'
export const SQUARE_NAME = 'Transfer' // Figma UX › 앱 확정 › Section 1; Korean keeps 공유 플라자 (lib/i18n.ts)
export const SQUARE_PER_USER = 3
// the plaza's face in Town List and Collection (Figma Section 1, Group 156 1133:8067): the grey swirl, not its newest resident
export const SQUARE_THUMB = transferIcon
const SHOW = 50 // the town draws the most recent 50 (plus all of yours) so it stays smooth

export type SquareRow = { card: Card; userId: string; movedAt: string }
export type SquareLoad = { ok: true; rows: SquareRow[] } | { ok: false }

const LOCAL = 'subwayseal.square'
const readLocal = (): SquareRow[] => {
  try {
    return JSON.parse(localStorage.getItem(LOCAL) ?? '[]')
  } catch {
    return []
  }
}
const writeLocal = (rows: SquareRow[]) => localStorage.setItem(LOCAL, JSON.stringify(rows))

type Db = { card_id: string; user_id: string; card: Card; moved_at: string }
const fromDb = (r: Db): SquareRow => ({ card: r.card, userId: r.user_id, movedAt: r.moved_at })

export async function loadSquare(user: User | null): Promise<SquareLoad> {
  if (!supabase) return { ok: true, rows: readLocal().sort((a, b) => b.movedAt.localeCompare(a.movedAt)) }
  const cols = 'card_id, user_id, card, moved_at'
  const [recent, mine] = await Promise.all([
    supabase.from('square_cards').select(cols).order('moved_at', { ascending: false }).limit(SHOW),
    user ? supabase.from('square_cards').select(cols).eq('user_id', user.id) : Promise.resolve({ data: [] as Db[], error: null }),
  ])
  if (recent.error || mine.error) {
    console.warn('square_cards load failed (run supabase/migrations/015_square.sql?)', (recent.error ?? mine.error)!.message)
    return { ok: false }
  }
  const rows = new Map<string, SquareRow>()
  for (const r of [...(recent.data as Db[]), ...(mine.data as Db[])]) rows.set(r.card_id, fromDb(r))
  return { ok: true, rows: [...rows.values()].sort((a, b) => b.movedAt.localeCompare(a.movedAt)) }
}

export type MoveResult = { ok: true } | { ok: false; why: 'cap' | 'error' }

export async function moveIn(user: User, card: Card): Promise<MoveResult> {
  if (!supabase) {
    const rows = readLocal()
    if (rows.filter((r) => r.userId === user.id).length >= SQUARE_PER_USER) return { ok: false, why: 'cap' }
    writeLocal([...rows.filter((r) => r.card.id !== card.id), { card, userId: user.id, movedAt: new Date().toISOString() }])
    return { ok: true }
  }
  const { error } = await supabase.from('square_cards').insert({ card_id: card.id, user_id: user.id, card })
  if (!error) return { ok: true }
  console.warn('square move in failed', error.message)
  return { ok: false, why: /square_cap/.test(error.message) ? 'cap' : 'error' }
}

export async function moveOut(cardId: string): Promise<boolean> {
  if (!supabase) {
    writeLocal(readLocal().filter((r) => r.card.id !== cardId))
    return true
  }
  const { error } = await supabase.from('square_cards').delete().eq('card_id', cardId)
  if (error) console.warn('square move out failed', error.message)
  return !error
}

// The square as a town (always last), and the state the screens draw: your towns + the square, your cards +
// everyone's cards living there. Never saved — `commit` keeps working on the real state.
export function squareTown(rows: SquareRow[]): Town {
  return { id: SQUARE_ID, name: SQUARE_NAME, bio: '', createdAt: '2026-11-19T00:00:00.000Z', tone: 0, residents: rows.map((r) => r.card.id) }
}

export function withSquare(state: State, rows: SquareRow[]): State {
  const cards = { ...state.cards }
  for (const r of rows) cards[r.card.id] ??= r.card
  return { ...state, towns: [...state.towns, squareTown(rows)], cards }
}
