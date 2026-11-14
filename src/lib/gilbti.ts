import { track } from './analytics'
import { supabase, type User } from './auth'

// 길BTI (Subway-TI): the pre-interview that profiles testers (Figma slides "Pre-Interview: Profiling Our Users").
// Two spectrums — enjoys observing × enjoys recording — make four personas; the other answers add context.
// Answers are kept on this device and sent to Supabase table gilbti_responses (supabase/migrations/007_gilbti.sql).

export type Section = 'About you' | 'Riding' | 'Observing' | 'Recording'
export type Question =
  | { id: string; section: Section; kind: 'text'; prompt: string; placeholder: string; long?: boolean; optional?: boolean }
  | { id: string; section: Section; kind: 'one' | 'many'; prompt: string; choices: string[] }
  | { id: string; section: Section; kind: 'scale'; prompt: string; low: string; high: string }

export const QUESTIONS: Question[] = [
  { id: 'name', section: 'About you', kind: 'text', prompt: 'What should we call you?', placeholder: 'Nickname', optional: true },
  { id: 'age', section: 'About you', kind: 'one', prompt: 'How old are you?', choices: ['Under 20', '20s', '30s', '40s', '50+'] },
  { id: 'ride_freq', section: 'Riding', kind: 'one', prompt: 'How often do you ride the subway?', choices: ['Every day', 'A few times a week', 'A few times a month', 'Rarely'] },
  { id: 'ride_when', section: 'Riding', kind: 'many', prompt: 'When do you usually ride?', choices: ['Morning commute', 'Daytime', 'Evening commute', 'Late night', 'Weekends'] },
  { id: 'ride_length', section: 'Riding', kind: 'one', prompt: 'How long is a usual ride?', choices: ['Under 15 min', '15–30 min', '30–60 min', 'Over an hour'] },
  { id: 'observe', section: 'Observing', kind: 'scale', prompt: 'Do you enjoy watching the people around you?', low: 'Not at all', high: 'Love it' },
  {
    id: 'observe_what',
    section: 'Observing',
    kind: 'many',
    prompt: 'What do you mostly notice?',
    choices: ['Outfits & style', 'Faces & expressions', "What they're doing", 'Conversations', 'Things they carry', "I don't really look"],
  },
  { id: 'observe_change', section: 'Observing', kind: 'one', prompt: 'Has noticing someone ever changed something in your day or life?', choices: ['Never', 'Once or twice', 'Sometimes', 'Often'] },
  { id: 'record', section: 'Recording', kind: 'scale', prompt: 'Do you enjoy recording things — photos, notes, drawings?', low: 'Not at all', high: 'Love it' },
  { id: 'record_why', section: 'Recording', kind: 'text', prompt: 'Why, or why not?', placeholder: 'A line or two is plenty', long: true, optional: true },
  { id: 'record_what', section: 'Recording', kind: 'many', prompt: 'What do you mostly record?', choices: ['Photos', 'Notes & diary', 'Drawings', 'Videos', 'Social media posts', 'Not much'] },
]

export type Answer = string | string[] | number
export type Answers = Record<string, Answer>
export type TypeId = 'both' | 'record' | 'observe' | 'neither'

// the 2×2 on the slide: rows = recording, columns = observing
export const TYPES: Record<TypeId, { name: string; line: string }> = {
  both: { name: 'Enjoys both', line: 'You notice people and like keeping what you saw.' },
  record: { name: 'Recording only', line: "People aren't your thing to watch, but you love keeping things." },
  observe: { name: 'Observing only', line: 'You notice everyone around you, and let the moment pass.' },
  neither: { name: 'Interested in neither', line: 'You ride in your own world. Maybe someone will catch your eye.' },
}

// 4–5 on the 1–5 scale = "likes it"
export const LIKES = 4
export function typeOf(observe: number, record: number): TypeId {
  const o = observe >= LIKES
  const r = record >= LIKES
  return o && r ? 'both' : r ? 'record' : o ? 'observe' : 'neither'
}

export function answered(q: Question, a: Answer | undefined) {
  if (q.kind === 'text') return !!q.optional || (typeof a === 'string' && a.trim() !== '')
  if (q.kind === 'many') return Array.isArray(a) && a.length > 0
  return a !== undefined && a !== ''
}

// ---------- this device ----------

export type Result = { answers: Answers; type: TypeId; observe: number; record: number; at: string; sent: boolean }

const RESULT = 'subwayseal.gilbti'
const DEVICE = 'subwayseal.device'

const read = (k: string) => {
  try {
    return localStorage.getItem(k)
  } catch {
    return null
  }
}
const write = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v)
  } catch {
    /* private mode */
  }
}

export function deviceId() {
  let id = read(DEVICE)
  if (!id) {
    id = crypto.randomUUID()
    write(DEVICE, id)
  }
  return id
}

export function savedResult(): Result | null {
  try {
    return JSON.parse(read(RESULT) ?? 'null')
  } catch {
    return null
  }
}

// ---------- server ----------

async function send(r: Result, user: User | null): Promise<boolean> {
  if (!supabase) return true // no server configured: the device copy is all there is
  const name = typeof r.answers.name === 'string' ? r.answers.name.trim() : ''
  const { error } = await supabase.from('gilbti_responses').insert({
    device_id: deviceId(),
    user_id: user?.id ?? null,
    email: user?.username.toLowerCase() ?? null,
    nickname: name || null,
    type: r.type,
    observe: r.observe,
    record: r.record,
    answers: r.answers,
    created_at: r.at,
  })
  if (error) console.warn('gilbti_responses save failed (run supabase/migrations/007_gilbti.sql?)', error.message)
  return !error
}

// Finish: keep it on this device first, then send (a failed send is retried on the next start).
export async function submit(answers: Answers, user: User | null): Promise<Result> {
  const observe = Number(answers.observe) || 1
  const record = Number(answers.record) || 1
  const r: Result = { answers, type: typeOf(observe, record), observe, record, at: new Date().toISOString(), sent: false }
  write(RESULT, JSON.stringify(r))
  track('gilbti_done', { type: r.type, observe, record })
  if (await send(r, user)) write(RESULT, JSON.stringify({ ...r, sent: true }))
  return r
}

// App start: answers that never reached the server go now.
export async function resendUnsent(user: User | null) {
  const r = savedResult()
  if (r && !r.sent && (await send(r, user))) write(RESULT, JSON.stringify({ ...r, sent: true }))
}

// Logged in on a device that has no answers yet: did this account already answer somewhere else?
// (needs the "own answers" read policy from 008_gilbti_own_read.sql; without it the interview just asks again)
export async function doneOnServer(user: User): Promise<boolean> {
  if (!supabase) return false
  const { data, error } = await supabase.from('gilbti_responses').select('id').eq('user_id', user.id).limit(1)
  if (error) console.warn('gilbti_responses read failed (run supabase/migrations/008_gilbti_own_read.sql?)', error.message)
  return !error && !!data?.length
}

// After login: this device's guest answers now belong to the account.
export async function claim() {
  if (!supabase) return
  const { error } = await supabase.rpc('claim_gilbti', { device: deviceId() })
  if (error) console.warn('claim_gilbti failed (run supabase/migrations/007_gilbti.sql?)', error.message)
}
