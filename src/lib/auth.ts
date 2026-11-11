import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { State } from './store'

// Email + password login, Supabase's default rules (valid email, password 6+ characters).
// - With VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY (.env.local): real accounts via Supabase Auth,
//   each account's towns/cards saved in table `user_states` (supabase/migrations/004_user_states.sql).
// - Without a key: a browser-only stand-in (accounts in localStorage) so the flow can be tried now.

export type User = { id: string; username: string } // username = email
export type AuthResult = { ok: true; user: User } | { ok: false; error: string }

export const MIN_PASSWORD = 6

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
const sb: SupabaseClient | null = url && key ? createClient(url, key) : null
export const usingSupabase = !!sb
export const supabase = sb

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const norm = (email: string) => email.trim().toLowerCase()

function check(email: string, password: string): string | null {
  if (!EMAIL.test(norm(email))) return 'Enter a valid email.'
  if (password.length < MIN_PASSWORD) return `Password needs at least ${MIN_PASSWORD} characters.`
  return null
}

// ---------- browser-only stand-in ----------

const USERS = 'subwayseal.users'
const SESSION = 'subwayseal.session'
type LocalUsers = Record<string, { id: string; hash: string }>

const readUsers = (): LocalUsers => {
  try {
    return JSON.parse(localStorage.getItem(USERS) ?? '{}')
  } catch {
    return {}
  }
}

// not real security, just keeps plain passwords out of storage in the stand-in
async function hash(text: string) {
  if (crypto.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
  }
  let h = 0
  for (const c of text) h = (h * 31 + c.charCodeAt(0)) | 0
  return String(h)
}

// ---------- API ----------

export async function currentUser(): Promise<User | null> {
  if (sb) {
    const { data } = await sb.auth.getSession()
    const u = data.session?.user
    return u ? { id: u.id, username: u.email ?? '' } : null
  }
  try {
    const raw = localStorage.getItem(SESSION)
    return raw ? (JSON.parse(raw) as User) : null
  } catch {
    return null
  }
}

export async function signUp(username: string, password: string): Promise<AuthResult> {
  const bad = check(username, password)
  if (bad) return { ok: false, error: bad }
  const name = norm(username)
  if (sb) {
    const { data, error } = await sb.auth.signUp({ email: name, password })
    if (error) return { ok: false, error: /registered|exists/i.test(error.message) ? 'This email already has an account.' : error.message }
    // "Confirm email" on (Supabase default): no session until the link in the email is clicked
    if (!data.session || !data.user) return { ok: false, error: 'Check your email and open the link, then log in.' }
    return { ok: true, user: { id: data.user.id, username: name } }
  }
  const users = readUsers()
  if (users[name]) return { ok: false, error: 'This email already has an account.' }
  const user = { id: crypto.randomUUID(), username: name }
  users[name] = { id: user.id, hash: await hash(`${name}:${password}`) }
  localStorage.setItem(USERS, JSON.stringify(users))
  localStorage.setItem(SESSION, JSON.stringify(user))
  return { ok: true, user }
}

export async function logIn(username: string, password: string): Promise<AuthResult> {
  const bad = check(username, password)
  if (bad) return { ok: false, error: bad }
  const name = norm(username)
  if (sb) {
    const { data, error } = await sb.auth.signInWithPassword({ email: name, password })
    if (error?.message && /confirm/i.test(error.message)) return { ok: false, error: 'Open the link in your email first, then log in.' }
    if (error || !data.user) return { ok: false, error: 'Wrong email or password.' }
    return { ok: true, user: { id: data.user.id, username: data.user.email ?? name } }
  }
  const found = readUsers()[name]
  if (!found || found.hash !== (await hash(`${name}:${password}`))) return { ok: false, error: 'Wrong email or password.' }
  const user = { id: found.id, username: name }
  localStorage.setItem(SESSION, JSON.stringify(user))
  return { ok: true, user }
}

export async function logOut() {
  await flushRemote() // while the session still allows writing this account's row
  if (sb) await sb.auth.signOut()
  localStorage.removeItem(SESSION)
}

export async function changePassword(user: User, password: string): Promise<{ ok: boolean; error?: string }> {
  if (password.length < MIN_PASSWORD) return { ok: false, error: `Password needs at least ${MIN_PASSWORD} characters.` }
  if (sb) {
    const { error } = await sb.auth.updateUser({ password })
    return error ? { ok: false, error: error.message } : { ok: true }
  }
  const users = readUsers()
  users[user.username] = { id: user.id, hash: await hash(`${user.username}:${password}`) }
  localStorage.setItem(USERS, JSON.stringify(users))
  return { ok: true }
}

// ---------- per-account data in Supabase (local cache is always kept too) ----------

export type Remote = { state: State; updatedAt: number }

export async function loadRemote(user: User): Promise<Remote | null> {
  if (!sb) return null
  const { data, error } = await sb.from('user_states').select('state, updated_at').eq('user_id', user.id).maybeSingle()
  if (error) {
    console.warn('user_states load failed (run supabase/migrations/004_user_states.sql?)', error.message)
    return null
  }
  return data ? { state: data.state as State, updatedAt: Date.parse(data.updated_at) || 0 } : null
}

// Saves are batched (800ms). The time is taken when the change happens, so it matches this
// device's local save time; a save that never reaches the server leaves the device copy newer.
let timer = 0
let queued: { user: User; state: State; at: string } | null = null
async function push(job: { user: User; state: State; at: string }) {
  const { error } = await sb!.from('user_states').upsert({ user_id: job.user.id, email: job.user.username, state: job.state, updated_at: job.at })
  if (error) console.warn('user_states save failed', error.message)
}

export function saveRemote(user: User, state: State) {
  if (!sb) return
  clearTimeout(timer)
  queued = { user, state, at: new Date().toISOString() }
  timer = window.setTimeout(flushRemote, 800)
}

// Send the batched save now (log out, account switch, leaving the page).
export async function flushRemote() {
  clearTimeout(timer)
  const job = queued
  queued = null
  if (job) await push(job)
}
