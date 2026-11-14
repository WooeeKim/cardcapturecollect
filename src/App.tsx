import { useCallback, useEffect, useRef, useState } from 'react'
import { LoginSheet } from './components/LoginSheet'
import { PhoneChrome, Popup } from './components/ui'
import { identify, track, trackScreen } from './lib/analytics'
import { fillInsideImage } from './lib/fillInside'
import { claim, doneOnServer, resendUnsent, savedResult } from './lib/gilbti'
import { loadImage } from './lib/preload'
import { currentUser, deleteAccount, flushRemote, loadRemote, logOut, saveRemote, saveRemoteNow, usingSupabase, type User } from './lib/auth'
import { GUEST_KEY, hasContent, initial, keyFor, load, makePending, mergeGuest, placeCard, save, savedAt, sendPending, townOf, type State } from './lib/store'
import CollectionScreen from './screens/CollectionScreen'
import DrawScreen, { TadaScreen } from './screens/DrawScreen'
import GilbtiScreen from './screens/GilbtiScreen'
import MainScreen from './screens/MainScreen'
import MyPageScreen from './screens/MyPageScreen'
import TownListScreen from './screens/TownListScreen'

type Route =
  | { name: 'main'; townId: string; enter: 'left' | 'right' | 'center'; focus?: string }
  | { name: 'towns' }
  | { name: 'migrate'; cardId: string; back: Route; to: 'main' | 'collection' }
  | { name: 'send' }
  | { name: 'collection'; townId: string; card?: string }
  | { name: 'draw' }
  | { name: 'tada' }
  | { name: 'mypage' }

// old flag that limited guest data to the first account on a device (no longer used)
const LEGACY_GUEST_OWNER = 'subwayseal.guestOwner'
// the "keep your town" login prompt shows once, after the first card moves in
const PROMPTED = 'subwayseal.loginPrompted'
const flag = (k: string) => {
  try {
    return localStorage.getItem(k)
  } catch {
    return null
  }
}
const setFlag = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v)
  } catch {
    /* private mode */
  }
}

const startRoute = (s: State): Route => (s.pending ? { name: 'tada' } : { name: 'main', townId: s.towns[0].id, enter: 'center' })

async function decodeAll(srcs: string[]) {
  const jobs = srcs.filter(Boolean).map((src) => loadImage(new Image(), src))
  await Promise.race([Promise.all(jobs), new Promise((r) => setTimeout(r, 5000))])
}

// 'Since' on My Page: the day of the first card (today if there is none yet), as YY.MM.DD
function sinceOf(s: State) {
  const first = Object.values(s.cards).reduce<string | null>((m, c) => (!m || c.createdAt < m ? c.createdAt : m), null)
  const d = first ? new Date(first) : new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getFullYear() % 100)}.${p(d.getMonth() + 1)}.${p(d.getDate())}`
}

export default function App({ onReady }: { onReady?: () => void }) {
  const [ready, setReady] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const userRef = useRef<User | null>(null)
  const [state, setState] = useState<State>(() => load(GUEST_KEY))
  const [error, setError] = useState('')
  const [route, setRoute] = useState<Route>(() => startRoute(load(GUEST_KEY)))
  const [loginPrompt, setLoginPrompt] = useState(false)
  // Onboarding gate: 길BTI first, then log in, then the app ('first' until both are done).
  // 'mypage' = taken again from My Page (closable).
  const [interview, setInterview] = useState<'first' | 'mypage' | null>(null)
  // town the main screen was last showing
  const [homeId, setHomeId] = useState(state.towns[0].id)

  // switch the whole app to an account (or back to guest).
  // Guest data on this device always joins the account being entered (sign-up or log-in); the guest copy is
  // removed only once the merged data is safely saved, so a failure just means it merges again next time.
  const enter = useCallback(async (u: User | null) => {
    await flushRemote()
    if (!u) {
      setInterview('first') // logged out (or the account couldn't be reached): back to the gate
      userRef.current = null
      setUser(null)
      identify(null)
      const guest = load(GUEST_KEY)
      setState(guest)
      setHomeId(guest.towns[0].id)
      setRoute(startRoute(guest))
      return
    }
    const remote = await loadRemote(u)
    if (!remote.ok) {
      // can't tell what the account holds → don't merge or save over it; stay a guest (session kept, retried next start)
      setError("Couldn't reach your account. Your town stays on this device — try again in a moment.")
      return enter(null)
    }
    // newer copy wins: a save that never reached the server (tab closed, offline) must not be overwritten
    let next = load(keyFor(u.id))
    if (remote.remote && remote.remote.updatedAt >= savedAt(keyFor(u.id))) next = remote.remote.state
    const guest = load(GUEST_KEY)
    let merged = false
    let unplaced = 0
    if (hasContent(guest)) {
      ;({ state: next, unplaced } = mergeGuest(next, guest))
      next = { ...next, insideFilled3: false } // guest drawings may predate the white fill
      merged = true
    }
    let cached = true
    try {
      save(next, keyFor(u.id))
    } catch {
      cached = false
    }
    const stored = await saveRemoteNow(u, next)
    if (merged) {
      // with a server, the server copy is what counts; without one, the device copy is
      if (usingSupabase ? stored : cached) localStorage.removeItem(GUEST_KEY)
      else setError("Couldn't save your guest town to the account yet. It will be added the next time you log in.")
    }
    if (unplaced > 0) setError(`${unplaced} card${unplaced > 1 ? 's' : ''} didn't fit in your towns.`)
    localStorage.removeItem(LEGACY_GUEST_OWNER)
    claim() // this device's 길BTI answers (made as a guest) now belong to the account
    userRef.current = u
    setUser(u)
    identify(u)
    setState(next)
    setHomeId(next.towns[0].id)
    setRoute(startRoute(next))
    return next
  }, [])

  // leaving / hiding the page: send the batched account save instead of dropping it
  useEffect(() => {
    const flush = () => document.visibilityState === 'hidden' && flushRemote()
    document.addEventListener('visibilitychange', flush)
    return () => document.removeEventListener('visibilitychange', flush)
  }, [])

  useEffect(() => {
    currentUser().then(async (u) => {
      const s = (u ? await enter(u) : undefined) ?? load(GUEST_KEY)
      resendUnsent(u)
      const who = userRef.current // null if the account couldn't be reached
      if (!who || !(savedResult() || (await doneOnServer(who)))) setInterview('first')
      // the walkers' drawings are decoded before the first screen shows, so nobody pops in late
      await decodeAll(Object.values(s.cards).map((c) => c.image))
      setReady(true)
      onReady?.()
    })
  }, [enter])

  // every change is saved (this device + the account); if storage is full the change is undone and the user is told
  const commit = useCallback((fn: (s: State) => State) => {
    setState((prev) => {
      const next = fn(prev)
      const u = userRef.current
      try {
        save(next, keyFor(u?.id ?? null))
      } catch {
        setError('Storage is full. Delete some cards to save new ones.')
        return prev
      }
      if (u) saveRemote(u, next)
      return next
    })
  }, [])

  // one-time: drawings made before the white inside-fill get it now (new ones get it when finished)
  useEffect(() => {
    if (!ready || state.insideFilled3) return
    const who = userRef.current
    let stale = false
    ;(async () => {
      const fixed: Record<string, string> = {}
      for (const c of Object.values(state.cards)) {
        if (!c.image) continue
        try {
          fixed[c.id] = await fillInsideImage(c.image)
        } catch {
          /* broken image: leave it */
        }
      }
      if (stale || userRef.current !== who) return
      commit((s) => {
        const cards = { ...s.cards }
        for (const [id, image] of Object.entries(fixed)) if (cards[id]) cards[id] = { ...cards[id], image }
        return { ...s, cards, insideFilled3: true }
      })
    })()
    return () => {
      stale = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, user, state.insideFilled3, commit])

  const existing = (id: string) => (state.towns.some((t) => t.id === id) ? id : state.towns[0].id)
  const goMain = (townId: string, enter: 'left' | 'right' | 'center' = 'center', focus?: string) => {
    setHomeId(townId)
    setRoute({ name: 'main', townId, enter, focus })
  }

  useEffect(() => trackScreen(interview ? 'gilbti' : route.name), [route.name, interview])

  // pending card vanished (e.g. storage reset) → go home
  const lost = (route.name === 'tada' || route.name === 'send') && !state.pending
  useEffect(() => {
    if (lost) goMain(state.towns[0].id)
  })

  let screen
  switch (route.name) {
    case 'main': {
      const town = state.towns.find((t) => t.id === route.townId) ?? state.towns[0]
      screen = (
        <MainScreen
          key={town.id}
          state={state}
          town={town}
          enter={route.enter}
          focusId={route.focus ?? null}
          onTowns={() => setRoute({ name: 'towns' })}
          onCollection={() => setRoute({ name: 'collection', townId: town.id })}
          onOpenCard={(cardId) => setRoute({ name: 'collection', townId: town.id, card: cardId })}
          onMyPage={() => setRoute({ name: 'mypage' })}
          onDraw={() => setRoute({ name: 'draw' })}
          onSwitch={(id, enter) => goMain(id, enter)}
          onMigrate={(cardId) => setRoute({ name: 'migrate', cardId, back: route, to: 'main' })}
        />
      )
      break
    }
    case 'towns':
      screen = <TownListScreen state={state} commit={commit} mode="browse" onBack={() => goMain(existing(homeId))} onGo={(id) => goMain(id)} onPlace={() => {}} />
      break
    case 'migrate': {
      const card = state.cards[route.cardId]
      screen = (
        <TownListScreen
          state={state}
          commit={commit}
          mode="migrate"
          card={card}
          homeId={townOf(state, route.cardId)?.id}
          onBack={() => setRoute(route.back)}
          onGo={() => {}}
          onPlace={(townId) => {
            commit((s) => placeCard(s, route.cardId, townId))
            track('card_moved', { from: route.to })
            if (route.to === 'collection') setRoute({ name: 'collection', townId: route.back.name === 'collection' ? route.back.townId : townId })
            else goMain(townId, 'center', route.cardId)
          }}
        />
      )
      break
    }
    case 'send':
      screen = state.pending && (
        <TownListScreen
          state={state}
          commit={commit}
          mode="send"
          card={state.pending}
          onBack={() => setRoute({ name: 'tada' })}
          onGo={() => {}}
          onPlace={(townId) => {
            const id = state.pending!.id
            commit((s) => sendPending(s, townId))
            track('card_sent')
            goMain(townId, 'center', id)
            if (!userRef.current && !flag(PROMPTED)) {
              setFlag(PROMPTED, '1')
              setTimeout(() => setLoginPrompt(true), 1200)
            }
          }}
        />
      )
      break
    case 'collection':
      screen = (
        <CollectionScreen
          state={state}
          commit={commit}
          townId={existing(route.townId)}
          openCard={route.card}
          onTown={(id) => setRoute({ name: 'collection', townId: id })}
          onBack={() => goMain(existing(homeId))}
        />
      )
      break
    case 'draw':
      screen = (
        <DrawScreen
          onExit={() => goMain(existing(homeId))}
          onFinish={(draft) => {
            // save first: if storage is full, stay here so the drawing isn't lost
            const next = makePending(state, draft)
            try {
              save(next, keyFor(user?.id ?? null))
              if (user) saveRemote(user, next)
            } catch {
              return setError('Storage is full. Delete some cards to save new ones.')
            }
            setState(next)
            track('card_made', { mood: draft.mood })
            setRoute({ name: 'tada' })
          }}
        />
      )
      break
    case 'tada':
      screen = state.pending && <TadaScreen card={state.pending} onChoose={() => setRoute({ name: 'send' })} />
      break
    case 'mypage':
      screen = (
        <MyPageScreen
          user={user}
          cardCount={Object.keys(state.cards).length}
          townCount={state.towns.length}
          since={sinceOf(state)}
          nickname={state.nickname ?? ''}
          intro={state.intro ?? ''}
          onProfile={(nickname, intro) => commit((s) => ({ ...s, nickname: nickname || undefined, intro: intro || undefined }))}
          onBack={() => goMain(existing(homeId))}
          onInterview={() => setInterview('mypage')}
          onLogin={(u) => enter(u).then(() => setRoute({ name: 'mypage' }))}
          onLogout={async () => {
            await logOut()
            await enter(null)
            setRoute({ name: 'mypage' })
          }}
          onReset={() => {
            const fresh = initial()
            track('reset')
            commit(() => fresh)
            setHomeId(fresh.towns[0].id)
          }}
          onDeleteAccount={async () => {
            const u = userRef.current
            if (!u) return
            const res = await deleteAccount(u)
            try {
              localStorage.removeItem(keyFor(u.id))
            } catch {
              /* private mode */
            }
            track('delete_account', { ok: res.ok })
            await enter(null)
            setRoute({ name: 'mypage' })
            return res.note
          }}
        />
      )
      break
  }

  return (
    <>
      {ready &&
        (interview ? (
          <GilbtiScreen
            user={user}
            saved={interview === 'first' ? savedResult() : null}
            onClose={interview === 'mypage' ? () => setInterview(null) : undefined}
            onDone={(r) => {
              // the nickname from the interview, unless the town already has one
              const name = typeof r.answers.name === 'string' ? r.answers.name.trim() : ''
              if (name) commit((s) => (s.nickname ? s : { ...s, nickname: name }))
              setInterview(userRef.current ? null : 'first') // the login didn't stick (account unreachable): stay at the gate
            }}
            onLogin={async (u) => {
              await enter(u)
            }}
          />
        ) : (
          screen
        ))}
      {loginPrompt && (
        <LoginSheet
          prompt
          onClose={() => setLoginPrompt(false)}
          onDone={(u) => {
            setLoginPrompt(false)
            enter(u)
          }}
        />
      )}
      <PhoneChrome />
      {error && <Popup message={error} actions={[{ label: 'Got it!', onClick: () => setError('') }]} />}
    </>
  )
}
