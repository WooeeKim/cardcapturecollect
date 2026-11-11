import { STATIONS } from './stations'

const MAX_KM = 5

// Nearest subway station to a coordinate, or '' when nothing is within MAX_KM.
export function nearestStation(lat: number, lng: number): string {
  let best = ''
  let bestKm = MAX_KM
  for (const [name, a, b] of STATIONS) {
    const km = haversine(lat, lng, a, b)
    if (km < bestKm) {
      bestKm = km
      best = name
    }
  }
  return best ? `${best} Station` : ''
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
  const r = Math.PI / 180
  const dLat = (lat2 - lat1) * r
  const dLng = (lng2 - lng1) * r
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLng / 2) ** 2
  return 12742 * Math.asin(Math.sqrt(h))
}

// Last place used on a card: the starting value when location is denied or no station is near.
const LAST = 'subwayseal.lastPlace'
export function lastPlace() {
  try {
    return localStorage.getItem(LAST) ?? ''
  } catch {
    return ''
  }
}
export function rememberPlace(place: string) {
  try {
    if (place) localStorage.setItem(LAST, place)
  } catch {
    /* private mode */
  }
}

// Ask the browser for the current spot. Resolves '' if denied / unavailable.
export function locatePlace(): Promise<string> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve('')
    navigator.geolocation.getCurrentPosition(
      (p) => resolve(nearestStation(p.coords.latitude, p.coords.longitude)),
      () => resolve(''),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
    )
  })
}

// Self-check: `npx tsx src/lib/place.ts`
const argv = (globalThis as { process?: { argv: string[] } }).process?.argv
if (argv?.[1]?.endsWith('place.ts')) {
  const got = nearestStation(37.5495, 126.9139)
  if (got !== 'Hapjeong Station') throw new Error(`expected Hapjeong Station, got ${got}`)
  const kaist = nearestStation(36.3721, 127.3604)
  if (kaist !== 'Wolpyeong Station') throw new Error(`expected Wolpyeong Station near KAIST, got ${kaist}`)
  if (nearestStation(33.0, 125.0) !== '') throw new Error('open sea should be out of range')
  console.log('place ok')
}
