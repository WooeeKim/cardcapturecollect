import type { SupabaseClient } from '@supabase/supabase-js'
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

// ---------- app_events (supabase/migrations/009_app_events.sql) ----------

export type Ev = { session_id: string; device_id: string; user_id: string | null; email: string | null; event: string; at: string; data: Record<string, unknown> | null }

// every event, oldest first (Supabase returns at most 1000 rows per request, so page through)
export async function loadEvents(sb: SupabaseClient): Promise<{ data: Ev[]; error: string }> {
  const out: Ev[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from('app_events').select('session_id, device_id, user_id, email, event, at, data').order('at').range(from, from + 999)
    if (error) return { data: out, error: error.message }
    out.push(...(data as Ev[]))
    if (data.length < 1000) return { data: out, error: '' }
  }
}

// One visit to the drawing screen. Each state event lasts until the next event of the session;
// 'hidden' (app in background) and 'confirm' (final check) count toward neither tab.
export type CardSession = { id: string; who: string; start: string; draw: number; memo: number; result: 'finish' | 'exit' | 'open' }
const STATES = new Set(['draw', 'memo', 'confirm', 'hidden'])

export function cardSessions(events: Ev[]): CardSession[] {
  const by = new Map<string, Ev[]>()
  for (const e of events) if (e.session_id !== '-' && (STATES.has(e.event) || e.event === 'finish' || e.event === 'exit')) by.set(e.session_id, [...(by.get(e.session_id) ?? []), e])
  const out: CardSession[] = []
  for (const [id, evs] of by) {
    const s: CardSession = { id, who: evs[0].email ?? `guest ${evs[0].device_id.slice(0, 6)}`, start: evs[0].at, draw: 0, memo: 0, result: 'open' }
    evs.forEach((e, i) => {
      const next = evs[i + 1]
      if (next && (e.event === 'draw' || e.event === 'memo')) s[e.event] += (Date.parse(next.at) - Date.parse(e.at)) / 1000
      if (e.event === 'finish' || e.event === 'exit') s.result = e.event
    })
    out.push(s)
  }
  return out.sort((a, b) => b.start.localeCompare(a.start))
}
