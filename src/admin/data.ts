import type { Card, State, Town } from '../lib/store'

// One saved account (user_states row) and one drawing, flattened with who made it and where it lives.
export type Row = { user_id: string; email: string | null; state: State; updated_at: string }
export type Item = { card: Card; owner: Row; town: Town | null; pending: boolean }

export const when = (iso: string) => new Date(iso).toLocaleString()
export const who = (r: Row) => r.state.nickname || r.email || r.user_id.slice(0, 8)
export const cardCount = (r: Row) => Object.keys(r.state.cards).length + (r.state.pending ? 1 : 0)

// every drawing (placed + the one waiting to be sent), newest first
export function flatten(rows: Row[]): Item[] {
  const out: Item[] = []
  for (const owner of rows) {
    const s = owner.state
    for (const card of Object.values(s.cards)) out.push({ card, owner, town: s.towns.find((t) => t.residents.includes(card.id)) ?? null, pending: false })
    if (s.pending) out.push({ card: s.pending, owner, town: null, pending: true })
  }
  return out.sort((a, b) => b.card.createdAt.localeCompare(a.card.createdAt))
}

// local YYYY-MM-DD
export const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
