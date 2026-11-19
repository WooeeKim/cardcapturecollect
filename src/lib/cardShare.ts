import { currentUser, supabase } from './auth'
import { renderCardPng } from './cardImage'
import { track } from './events'
import type { Card } from './store'

// Save a card as an image, or share it as a link (<site>/c/<id>, served by api/card.js).
// iPhone only opens the share sheet straight from a tap, so the image is made ahead (prepareCard on screen open)
// and the link is made first, then shared with a second tap (cardShare UI).

const cache = new Map<string, Promise<Blob>>()
export function prepareCard(card: Card) {
  const key = `${card.id}:${card.image.length}:${card.nickname}:${card.memo}:${card.mood}:${card.place}:${card.by}`
  let p = cache.get(key)
  if (!p) {
    p = renderCardPng(card)
    cache.set(key, p)
    p.catch(() => cache.delete(key))
  }
  return p
}

const fileName = (card: Card) => `${card.serial || 'card'}.png`

export type SaveResult = 'shared' | 'downloaded' | 'cancelled' | 'failed'

// phone: share sheet with the image ("Save Image" saves it to Photos); elsewhere: a PNG download
export async function saveCardImage(card: Card): Promise<SaveResult> {
  let blob: Blob
  try {
    blob = await prepareCard(card)
  } catch {
    track('card_save', { result: 'failed' })
    return 'failed'
  }
  const file = new File([blob], fileName(card), { type: 'image/png' })
  let result: SaveResult = 'downloaded'
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
      result = 'shared'
    } catch (e) {
      result = (e as Error).name === 'AbortError' ? 'cancelled' : 'downloaded'
    }
  }
  if (result === 'downloaded') {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = fileName(card)
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
  }
  track('card_save', { result })
  return result
}

// ---------- link ----------

const SHARED = 'subwayseal.sharedCards' // card id → share id, so sharing the same card again reuses its link
const readShared = (): Record<string, string> => {
  try {
    return JSON.parse(localStorage.getItem(SHARED) ?? '{}')
  } catch {
    return {}
  }
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
const newId = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => ALPHABET[b % ALPHABET.length]).join('')

export const linkFor = (id: string) => `${location.origin}/c/${id}`

export type LinkResult = { ok: true; url: string } | { ok: false; error: 'no-server' | 'login' | 'failed' }

// Upload the card image + its words and get a public link. Supabase: 015_card_shares.sql.
export async function makeCardLink(card: Card): Promise<LinkResult> {
  if (!supabase) return { ok: false, error: 'no-server' }
  const user = await currentUser()
  if (!user) return { ok: false, error: 'login' }
  const known = readShared()[card.id]
  if (known) return { ok: true, url: linkFor(known) }
  try {
    const blob = await prepareCard(card)
    const id = newId()
    const path = `${user.id}/${id}.png`
    const up = await supabase.storage.from('card-shares').upload(path, blob, { contentType: 'image/png', upsert: false })
    if (up.error) throw up.error
    const ins = await supabase.from('card_shares').insert({
      id,
      user_id: user.id,
      card_id: card.id,
      nickname: card.nickname || null,
      memo: card.memo || null,
      mood: card.mood || null,
      place: card.place || null,
      serial: card.serial || null,
      by_name: card.by || null,
      image_path: path,
    })
    if (ins.error) throw ins.error
    try {
      localStorage.setItem(SHARED, JSON.stringify({ ...readShared(), [card.id]: id }))
    } catch {
      /* private mode: a new link next time */
    }
    track('card_share', { result: 'link_made' })
    return { ok: true, url: linkFor(id) }
  } catch (e) {
    console.warn('card share failed (run supabase/migrations/015_card_shares.sql?)', (e as Error).message)
    track('card_share', { result: 'failed' })
    return { ok: false, error: 'failed' }
  }
}

// second tap: phone share sheet with the link, or copy it
export async function sendLink(url: string, title: string): Promise<'shared' | 'copied' | 'cancelled'> {
  if (navigator.share) {
    try {
      await navigator.share({ url, title })
      track('card_share', { result: 'shared' })
      return 'shared'
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled'
    }
  }
  await navigator.clipboard?.writeText(url).catch(() => {})
  track('card_share', { result: 'copied' })
  return 'copied'
}

export async function copyLink(url: string) {
  await navigator.clipboard?.writeText(url).catch(() => {})
  track('card_share', { result: 'copied' })
}
