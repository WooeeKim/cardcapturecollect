import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { State } from './store'

// ID + password login.
// - With VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY (.env.local): real accounts via Supabase Auth,
//   each account's towns/cards saved in table `user_states` (supabase/migrations/004_user_states.sql).
// - Without a key: a browser-only stand-in (accounts in localStorage) so the flow can be tried now.

export type User = { id: string; username: string }
export type AuthResult = { ok: true; user: User } | { ok: false; error: string }

export const MIN_PASSWORD = 4

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
const sb: SupabaseClient | null = url && key ? createClient(url, key) : null
export const usingSupabase = !!sb

// Supabase wants an email and a 6+ char password: map the ID to a fixed fake address
// (hex keeps any characters, Korean included) and prefix the password.
const toEmail = (username: string) =>
  `u${[...new TextEncoder().encode(username)].map((b) => b.toString(16).padStart(2, '0')).join('')}@subwayseal.app`
const toPassword = (password: string) => `ss!${password}`

function check(username: string, password: string): string | null {
  if (!username.trim()) return 'Enter an ID.'
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
    return u ? { id: u.id, username: (u.user_metadata?.username as string) ?? '' } : null
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
  const name = username.trim()
  if (sb) {
    const { data, error } = await sb.auth.signUp({ email: toEmail(name), password: toPassword(password), options: { data: { username: name } } })
    if (error) return { ok: false, error: /registered|exists/i.test(error.message) ? 'This ID is already taken.' : error.message }
    if (!data.session || !data.user) return { ok: false, error: 'Sign-up needs "Confirm email" turned off in Supabase.' }
    return { ok: true, user: { id: data.user.id, username: name } }
  }
  const users = readUsers()
  if (users[name]) return { ok: false, error: 'This ID is already taken.' }
  const user = { id: crypto.randomUUID(), username: name }
  users[name] = { id: user.id, hash: await hash(`${name}:${password}`) }
  localStorage.setItem(USERS, JSON.stringify(users))
  localStorage.setItem(SESSION, JSON.stringify(user))
  return { ok: true, user }
}

export async function logIn(username: string, password: string): Promise<AuthResult> {
  const bad = check(username, password)
  if (bad) return { ok: false, error: bad }
  const name = username.trim()
  if (sb) {
    const { data, error } = await sb.auth.signInWithPassword({ email: toEmail(name), password: toPassword(password) })
    if (error || !data.user) return { ok: false, error: 'Wrong ID or password.' }
    return { ok: true, user: { id: data.user.id, username: (data.user.user_metadata?.username as string) ?? name } }
  }
  const found = readUsers()[name]
  if (!found || found.hash !== (await hash(`${name}:${password}`))) return { ok: false, error: 'Wrong ID or password.' }
  const user = { id: found.id, username: name }
  localStorage.setItem(SESSION, JSON.stringify(user))
  return { ok: true, user }
}

export async function logOut() {
  if (sb) await sb.auth.signOut()
  localStorage.removeItem(SESSION)
}

export async function changePassword(user: User, password: string): Promise<{ ok: boolean; error?: string }> {
  if (password.length < MIN_PASSWORD) return { ok: false, error: `Password needs at least ${MIN_PASSWORD} characters.` }
  if (sb) {
    const { error } = await sb.auth.updateUser({ password: toPassword(password) })
    return error ? { ok: false, error: error.message } : { ok: true }
  }
  const users = readUsers()
  users[user.username] = { id: user.id, hash: await hash(`${user.username}:${password}`) }
  localStorage.setItem(USERS, JSON.stringify(users))
  return { ok: true }
}

// ---------- per-account data in Supabase (local cache is always kept too) ----------

export async function loadRemote(user: User): Promise<State | null> {
  if (!sb) return null
  const { data, error } = await sb.from('user_states').select('state').eq('user_id', user.id).maybeSingle()
  if (error) {
    console.warn('user_states load failed (run supabase/migrations/004_user_states.sql?)', error.message)
    return null
  }
  return (data?.state as State) ?? null
}

let timer = 0
export function saveRemote(user: User, state: State) {
  if (!sb) return
  clearTimeout(timer)
  timer = window.setTimeout(async () => {
    const { error } = await sb!.from('user_states').upsert({ user_id: user.id, state, updated_at: new Date().toISOString() })
    if (error) console.warn('user_states save failed', error.message)
  }, 800)
}
