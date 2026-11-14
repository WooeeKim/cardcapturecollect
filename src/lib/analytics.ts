import posthog from 'posthog-js'
import type { User } from './auth'
import { viewAsId } from './viewAs'

// Usability-test logging via PostHog: session replay, heatmaps (autocapture clicks),
// time per screen ($pageview + $prev_pageview_duration), custom events, feedback.
// Off unless VITE_POSTHOG_KEY is set (.env.local / Vercel env). The key is a public project key.

// off in the admin's read-only "view as" mode, so admin browsing never shows up as a tester
const key = viewAsId ? undefined : (import.meta.env.VITE_POSTHOG_KEY as string | undefined)
const host = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ?? 'https://us.i.posthog.com'
export const analyticsOn = !!key

if (key) {
  posthog.init(key, {
    api_host: host,
    person_profiles: 'always', // guests get a profile too, merged into the account on login
    capture_pageview: false, // sent per screen below (the app has no real pages)
    capture_pageleave: true,
    enable_heatmaps: true,
    session_recording: { maskAllInputs: true }, // typed text hidden in replays
  })
}

// One "page" per screen: #/draw, #/towns … so replays, heatmaps and time-on-screen split by screen.
let last = ''
export function trackScreen(name: string) {
  if (name === last) return
  last = name
  history.replaceState(null, '', `#/${name}`)
  if (key) posthog.capture('$pageview')
}

export function identify(user: User | null) {
  if (!key) return
  if (user) posthog.identify(user.id, { email: user.username })
  else posthog.reset()
}

export function track(event: string, props?: Record<string, unknown>) {
  if (key) posthog.capture(event, props)
}
