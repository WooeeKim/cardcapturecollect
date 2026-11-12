import { useCallback, useEffect, useRef, useState } from 'react'
import { LoginSheet } from './components/LoginSheet'
import { PhoneChrome, Popup } from './components/ui'
import { identify, track, trackScreen } from './lib/analytics'
import { currentUser, flushRemote, loadRemote, logOut, saveRemote, type User } from './lib/auth'
import { GUEST_KEY, hasContent, initial, keyFor, load, makePending, mergeGuest, placeCard, save, savedAt, sendPending, townOf, type State } from './lib/store'
import CollectionScreen from './screens/CollectionScreen'
import DrawScreen, { TadaScreen } from './screens/DrawScreen'
import MainScreen from './screens/MainScreen'
import MyPageScreen from './screens/MyPageScreen'
import TownListScreen from './screens/TownListScreen'

type Route =
  | { name: 'main'; townId: string; enter: 'left' | 'right' | 'center'; focus?: string }
  | { name: 'towns' }
  | { name: 'migrate'; cardId: string; back: Route; to: 'main' | 'collection' }
  | { name: 'send' }
  | { name: 'collection'; townId: string }
  | { name: 'draw' }
  | { name: 'tada' }
  | { name: 'mypage' }

// guest data goes to the first account that logs in on this device
const GUEST_OWNER = 'subwayseal.guestOwner'
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

export default function App() {
  const [ready, setReady] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const userRef = useRef<User | null>(null)
  const [state, setState] = useState<State>(() => load(GUEST_KEY))
  const [error, setError] = useState('')
  const [route, setRoute] = useState<Route>(() => startRoute(load(GUEST_KEY)))
  const [loginPrompt, setLoginPrompt] = useState(false)
  // town the main screen was last showing
  const [homeId, setHomeId] = useState(state.towns[0].id)

  // switch the whole app to an account (or back to guest)
  const enter = useCallback(async (u: User | null) => {
    userRef.current = u
    setUser(u)
    identify(u)
    await flushRemote() // a batched save of the previous account goes out first
    let next = load(keyFor(u?.id ?? null))
    if (u) {
      // newer copy wins: a save that never reached the server (tab closed, offline) must not be overwritten
      const remote = await loadRemote(u)
      if (remote && remote.updatedAt >= savedAt(keyFor(u.id))) next = remote.state
      const guest = load(GUEST_KEY)
      if (!flag(GUEST_OWNER) && hasContent(guest)) {
        next = mergeGuest(next, guest)
        setFlag(GUEST_OWNER, u.id)
        localStorage.removeItem(GUEST_KEY)
      }
      try {
        save(next, keyFor(u.id))
      } catch {
        /* cache only */
      }
      saveRemote(u, next)
    }
    setState(next)
    setHomeId(next.towns[0].id)
    setRoute(startRoute(next))
  }, [])

  // leaving / hiding the page: send the batched account save instead of dropping it
  useEffect(() => {
    const flush = () => document.visibilityState === 'hidden' && flushRemote()
    document.addEventListener('visibilitychange', flush)
    return () => document.removeEventListener('visibilitychange', flush)
  }, [])

  useEffect(() => {
    currentUser().then(async (u) => {
      if (u) await enter(u)
      setReady(true)
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

  const existing = (id: string) => (state.towns.some((t) => t.id === id) ? id : state.towns[0].id)
  const goMain = (townId: string, enter: 'left' | 'right' | 'center' = 'center', focus?: string) => {
    setHomeId(townId)
    setRoute({ name: 'main', townId, enter, focus })
  }

  useEffect(() => trackScreen(route.name), [route.name])

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
          onBack={() => goMain(existing(homeId))}
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
        />
      )
      break
  }

  return (
    <>
      {ready && screen}
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
