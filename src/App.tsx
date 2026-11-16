import { useCallback, useEffect, useRef, useState } from 'react'
import { LoginSheet } from './components/LoginSheet'
import NotifyPrompt from './components/NotifyPrompt'
import { syncPush } from './lib/push'
import { PhoneChrome, Popup } from './components/ui'
import { fillInsideImage } from './lib/fillInside'
import { claim, doneOnServer, resendUnsent, savedResult } from './lib/gilbti'
import { NicknameScreen, WelcomeScreen } from './screens/OnboardingScreens'
import { loadImage } from './lib/preload'
import { checkAdmin, currentUser, deleteAccount, flushRemote, loadRemote, logOut, saveRemote, saveRemoteNow, supabase, usingSupabase, type User } from './lib/auth'
import { viewAsId } from './lib/viewAs'
import { GUEST_KEY, hasContent, initial, keyFor, load, makePending, mergeGuest, placeCard, profileCard, save, savedAt, sendPending, townOf, type State } from './lib/store'
import CollectionScreen from './screens/CollectionScreen'
import DrawScreen, { TadaScreen } from './screens/DrawScreen'
import GilbtiScreen from './screens/GilbtiScreen'
import MainScreen from './screens/MainScreen'
import MyPageScreen from './screens/MyPageScreen'
import TownListScreen from './screens/TownListScreen'
import { tr, useLang } from './lib/i18n'

type Route =
  | { name: 'main'; townId: string; enter: 'left' | 'right' | 'center'; focus?: string }
  | { name: 'towns' }
  | { name: 'migrate'; cardId: string; back: Route; to: 'main' | 'collection' }
  | { name: 'send' }
  | { name: 'collection'; townId: string; card?: string }
  | { name: 'draw'; tutorial?: boolean } // tutorial = onboarding "draw yourself" (that card becomes the profile picture)
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

const READ_ONLY = 'Admin view: read-only. Nothing here is saved or sent.'

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
  useLang() // re-render everything when the language changes
  const [ready, setReady] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const userRef = useRef<User | null>(null)
  const [isAdmin, setIsAdmin] = useState(false) // app_admins only: shows My Page → Reset
  const [state, setState] = useState<State>(() => load(GUEST_KEY))
  const [error, setError] = useState('')
  const [route, setRoute] = useState<Route>(() => startRoute(load(GUEST_KEY)))
  const [loginPrompt, setLoginPrompt] = useState(false)
  // Onboarding: log in / sign up → nickname → 길BTI → draw yourself (route draw + tutorial) → pick a town.
  // `gate` = the step still missing; null = in the app. `retake` = 길BTI opened again from My Page.
  const [gate, setGate] = useState<'login' | 'nickname' | 'gilbti' | null>(null)
  const [retake, setRetake] = useState(false)
  // town the main screen was last showing
  const [homeId, setHomeId] = useState(state.towns[0].id)

  // switch the whole app to an account (or back to guest).
  // Guest data on this device always joins the account being entered (sign-up or log-in); the guest copy is
  // removed only once the merged data is safely saved, so a failure just means it merges again next time.
  const enter = useCallback(async (u: User | null) => {
    await flushRemote()
    if (!u) {
      setGate('login') // logged out (or the account couldn't be reached): back to the first screen
      userRef.current = null
      setUser(null)
      const guest = load(GUEST_KEY)
      setState(guest)
      setHomeId(guest.towns[0].id)
      setRoute(startRoute(guest))
      return
    }
    const remote = await loadRemote(u)
    if (!remote.ok) {
      // can't tell what the account holds → don't merge or save over it; stay a guest (session kept, retried next start)
      setError(tr("Couldn't reach your account. Your town stays on this device — try again in a moment."))
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
      else setError(tr("Couldn't save your guest town to the account yet. It will be added the next time you log in."))
    }
    if (unplaced > 0) setError(tr(unplaced > 1 ? "{n} people didn't fit in your towns." : "{n} person didn't fit in your towns.", { n: unplaced }))
    localStorage.removeItem(LEGACY_GUEST_OWNER)
    claim() // this device's 길BTI answers (made as a guest) now belong to the account
    userRef.current = u
    setUser(u)
    setState(next)
    setHomeId(next.towns[0].id)
    setRoute(startRoute(next))
    return next
  }, [])

  // next missing onboarding step for this account; all done and no card yet → draw yourself
  // `answered`: 길BTI was just finished on this screen — don't re-ask storage/server (a failed save or read
  // would send the user straight back to the same result screen; the answers are resent on next start)
  const advance = useCallback(async (s: State, answered = false) => {
    const u = userRef.current
    if (!u) return setGate('login')
    if (!s.nickname) return setGate('nickname')
    if (!answered && !(savedResult(u) || (await doneOnServer(u)))) return setGate('gilbti')
    setGate(null)
    if (!Object.keys(s.cards).length && !s.pending) setRoute({ name: 'draw', tutorial: true })
  }, [])

  // keep this phone's notification subscription under whoever is logged in (lib/push.ts)
  useEffect(() => {
    if (ready && !viewAsId) syncPush()
  }, [ready, user?.id])

  // admin = listed in app_admins; re-checked whenever the account changes (log in / out)
  useEffect(() => {
    let live = true
    setIsAdmin(false)
    checkAdmin(user).then((ok) => live && setIsAdmin(ok))
    return () => {
      live = false
    }
  }, [user])

  // leaving / hiding the page: send the batched account save instead of dropping it
  useEffect(() => {
    const flush = () => document.visibilityState === 'hidden' && flushRemote()
    document.addEventListener('visibilitychange', flush)
    return () => document.removeEventListener('visibilitychange', flush)
  }, [])

  useEffect(() => {
    if (viewAsId) {
      // admin "view as": that account's saved state, shown read-only (lib/viewAs.ts)
      ;(async () => {
        const { data, error } = supabase
          ? await supabase.from('user_states').select('state, email').eq('user_id', viewAsId).maybeSingle()
          : { data: null, error: { message: 'No Supabase key' } }
        if (error || !data) setError(error ? `Couldn't load this account: ${error.message}` : 'Nothing saved for this account (or you are not an admin).')
        const s = (data?.state as State | undefined) ?? initial()
        setUser({ id: viewAsId!, username: (data?.email as string | null) ?? viewAsId! })
        setState(s)
        setHomeId(s.towns[0].id)
        setRoute(startRoute(s))
        await decodeAll(Object.values(s.cards).map((c) => c.image))
        setReady(true)
        onReady?.()
      })()
      return
    }
    currentUser().then(async (u) => {
      const s = (u ? await enter(u) : undefined) ?? load(GUEST_KEY)
      resendUnsent(u)
      await advance(s)
      // the walkers' drawings are decoded before the first screen shows, so nobody pops in late
      await decodeAll(Object.values(s.cards).map((c) => c.image))
      setReady(true)
      onReady?.()
    })
  }, [enter, advance])

  // every change is saved (this device + the account); if storage is full the change is undone and the user is told
  const commit = useCallback((fn: (s: State) => State) => {
    if (viewAsId) return setState(fn) // view as: in memory only, never saved
    setState((prev) => {
      const next = fn(prev)
      const u = userRef.current
      try {
        save(next, keyFor(u?.id ?? null))
      } catch {
        setError(tr('Storage is full. Let a few people go to make room for new ones.'))
        return prev
      }
      if (u) saveRemote(u, next)
      return next
    })
  }, [])

  // one-time: drawings made before the white inside-fill get it now (new ones get it when finished)
  useEffect(() => {
    if (!ready || state.insideFilled3 || viewAsId) return
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
            goMain(townId, 'center', id)
            if (!viewAsId && !userRef.current && !flag(PROMPTED)) {
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
          tutorial={route.tutorial}
          onFinish={(draft) => {
            // save first: if storage is full, stay here so the drawing isn't lost
            let next = makePending(state, draft)
            if (route.tutorial) next = { ...next, profile: next.pending!.id } // "draw yourself" → profile picture
            if (viewAsId) {
              setState(next)
              return setRoute({ name: 'tada' })
            }
            try {
              save(next, keyFor(user?.id ?? null))
              if (user) saveRemote(user, next)
            } catch {
              return setError(tr('Storage is full. Let a few people go to make room for new ones.'))
            }
            setState(next)
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
          canReset={isAdmin && !viewAsId}
          profile={profileCard(state)}
          cards={Object.values(state.cards).sort((a, b) => b.createdAt.localeCompare(a.createdAt))}
          onPickProfile={(id) => commit((s) => ({ ...s, profile: id }))}
          cardCount={Object.keys(state.cards).length}
          townCount={state.towns.length}
          since={sinceOf(state)}
          nickname={state.nickname ?? ''}
          intro={state.intro ?? ''}
          onProfile={(nickname, intro) => commit((s) => ({ ...s, nickname: nickname || undefined, intro: intro || undefined }))}
          onBack={() => goMain(existing(homeId))}
          onInterview={() => (viewAsId ? setError(READ_ONLY) : setRetake(true))}
          onLogin={(u) => enter(u).then(() => setRoute({ name: 'mypage' }))}
          onLogout={async () => {
            if (viewAsId) return setError(READ_ONLY)
            await logOut()
            await enter(null)
            setRoute({ name: 'mypage' })
          }}
          onReset={() => {
            const fresh = initial()
            commit(() => fresh)
            setHomeId(fresh.towns[0].id)
          }}
          onDeleteAccount={async () => {
            if (viewAsId) return READ_ONLY
            const u = userRef.current
            if (!u) return
            const res = await deleteAccount(u)
            try {
              localStorage.removeItem(keyFor(u.id))
            } catch {
              /* private mode */
            }
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
        (gate === 'login' ? (
          <WelcomeScreen
            onLogin={async (u) => {
              const s = await enter(u)
              if (s) await advance(s)
            }}
          />
        ) : gate === 'nickname' ? (
          <NicknameScreen
            initial=""
            onDone={(nickname) => {
              commit((s) => ({ ...s, nickname }))
              advance({ ...state, nickname })
            }}
          />
        ) : gate === 'gilbti' || retake ? (
          <GilbtiScreen
            user={user}
            nickname={state.nickname ?? ''}
            onClose={retake ? () => setRetake(false) : undefined}
            onDone={() => {
              if (retake) return setRetake(false)
              advance(state, true)
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
      <NotifyPrompt user={ready && !viewAsId ? (user?.id ?? null) : null} blocked={loginPrompt || !!error || !!gate || retake || (route.name === 'draw' && !!route.tutorial)} />
      <PhoneChrome />
      {viewAsId && ready && (
        <div className="pointer-events-none absolute inset-x-0 bottom-[40px] z-[101] flex justify-center">
          <span className="max-w-[90%] truncate rounded-full bg-black/75 px-[14px] py-[6px] font-[system-ui] text-[14px] text-white">
            Viewing as {state.nickname || user?.username} · read-only
          </span>
        </div>
      )}
      {error && <Popup message={error} actions={[{ label: tr('Got it!'), onClick: () => setError('') }]} />}
    </>
  )
}
