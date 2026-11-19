import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LoadingLayer, waiting } from './components/Loading'
import { LoginSheet } from './components/LoginSheet'
import NotifyPrompt from './components/NotifyPrompt'
import { syncPush } from './lib/push'
import { PhoneChrome, Popup, WideCol } from './components/ui'
import { fillInsideImage } from './lib/fillInside'
import { answeredByAccount, claim, resendUnsent } from './lib/gilbti'
import InterviewOverlay from './components/InterviewOverlay'
import FinalInterviewOverlay from './components/FinalInterviewOverlay'
import { FINAL_DAY, finalAnswered, finalOpen, resendFinal, submitFinal } from './lib/finalInterview'
import { answered as interviewAnswered, cardsIn, currentSlot, resendInterviews, submit as submitInterview, type Kind, type Slot } from './lib/interview'
import { NicknameScreen, WelcomeScreen } from './screens/OnboardingScreens'
import { loadImage } from './lib/preload'
import { checkAdmin, currentUser, flushRemote, loadRemote, logOut, saveRemote, saveRemoteNow, supabase, usingSupabase, type User } from './lib/auth'
import { viewAsId } from './lib/viewAs'
import { setScreen, startTracking } from './lib/events'
import { GUEST_KEY, hasContent, initial, keyFor, load, makePending, mergeGuest, placeCard, profileCard, save, savedAt, sendPending, swapCards, townOf, unplaceCard, type Card, type State } from './lib/store'
import { SQUARE_ID, SQUARE_NAME, SQUARE_PER_USER, loadSquare, moveIn, moveOut, withSquare, type SquareRow } from './lib/square'
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

// <site>/?interview=drew | didnt | final — shows the 10 p.m. interview (or the day-7 one) right now, whatever the time,
// to check the screens. Nothing is saved or sent; Done just closes it.
const PREVIEW_PARAM = new URLSearchParams(location.search).get('interview')
const PREVIEW_INTERVIEW = PREVIEW_PARAM === 'drew' ? 'drew' : PREVIEW_PARAM === 'didnt' ? 'didnt_draw' : null
const PREVIEW_FINAL = PREVIEW_PARAM === 'final'

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
  // daily 8 p.m. interview waiting to be answered (lib/interview.ts)
  const [interview, setInterview] = useState<{ slot: Slot; kind: Kind; cards: number } | null>(null)
  const [previewing, setPreviewing] = useState(!!PREVIEW_INTERVIEW)
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])
  // shared town (lib/square.ts): everyone's people living there; ok=false while the server can't be read
  const [square, setSquare] = useState<{ rows: SquareRow[]; ok: boolean }>({ rows: [], ok: true })
  const refreshSquare = useCallback(async () => {
    const r = await loadSquare(userRef.current)
    setSquare((prev) => (r.ok ? { rows: r.rows, ok: true } : { rows: prev.rows, ok: false }))
  }, [])
  // what the screens draw: your towns + the shared town at the end, your cards + everyone's there
  const view = useMemo(() => withSquare(state, square.rows), [state, square.rows])
  // Collection is your people only: the plaza shows just the ones you moved there
  const collectionView = useMemo(() => withSquare(state, square.rows.filter((r) => r.userId === user?.id)), [state, square.rows, user?.id])
  const mineInSquare = (id: string) => square.rows.some((r) => r.card.id === id && r.userId === user?.id)

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
    const local = load(keyFor(u.id))
    let next = local
    if (remote.remote && remote.remote.updatedAt >= savedAt(keyFor(u.id))) next = remote.remote.state
    // 길BTI answered on either copy stays answered: the copy that wins may come from a device (or clock) that
    // never saw the flag, and saving it would otherwise drop the flag for every device
    if (local.gilbtiDone || remote.remote?.state.gilbtiDone) next = { ...next, gilbtiDone: true }
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
  // 길BTI is asked once per account: the answer is a flag in the account's saved state (user_states), so every
  // device the account logs in on sees it. `answered` = just finished on this screen. Accounts from before the
  // flag fall back to the answers table, and a yes there sets the flag for next time.
  const advance = useCallback(async (s: State, answered = false) => {
    const u = userRef.current
    if (!u) return setGate('login')
    if (!s.nickname) return setGate('nickname')
    if (!s.gilbtiDone) {
      if (!answered && !(await answeredByAccount(u))) return setGate('gilbti')
      commit((x) => ({ ...x, gilbtiDone: true }))
    }
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
      resendInterviews(u, s.nickname ?? '')
      resendFinal(u, s.nickname ?? '')
      await advance(s)
      // the walkers' drawings are decoded before the first screen shows, so nobody pops in late
      await decodeAll(Object.values(s.cards).map((c) => c.image))
      setReady(true)
      onReady?.()
    })
  }, [enter, advance])

  // 8 p.m. interview: checked at start, every 30s (the server only when the day changes) and when the app comes back.
  // Not during onboarding; while drawing it waits (see `interviewShown`).
  const checkedDay = useRef('')
  useEffect(() => {
    if (!ready || viewAsId || gate || retake || interview || PREVIEW_INTERVIEW || PREVIEW_FINAL) return
    let live = true
    const check = async (force: boolean) => {
      const slot = currentSlot()
      if (!slot || (!force && checkedDay.current === slot.day)) return
      checkedDay.current = slot.day
      if (await interviewAnswered(userRef.current, slot.day)) return
      if (!live) return
      const cards = cardsIn(stateRef.current, slot)
      setInterview({ slot, kind: cards > 0 ? 'drew' : 'didnt_draw', cards })
    }
    check(true)
    const timer = setInterval(() => check(false), 30_000)
    const back = () => document.visibilityState === 'visible' && check(true)
    document.addEventListener('visibilitychange', back)
    return () => {
      live = false
      clearInterval(timer)
      document.removeEventListener('visibilitychange', back)
    }
  }, [ready, gate, retake, interview, user?.id])
  const interviewShown = !!interview && !gate && !retake && route.name !== 'draw' && route.name !== 'tada' && route.name !== 'send'

  // Day-7 interview (lib/finalInterview.ts): from 11/22 22:00, right after that day's 10 p.m. interview; until answered.
  const [final, setFinal] = useState(PREVIEW_FINAL)
  useEffect(() => {
    if (!ready || viewAsId || gate || retake || interview || final || PREVIEW_INTERVIEW || PREVIEW_FINAL) return
    let live = true
    const check = async () => {
      if (!finalOpen()) return
      const u = userRef.current
      // the 11/22 10 p.m. interview comes first
      if (currentSlot()?.day === FINAL_DAY && !(await interviewAnswered(u, FINAL_DAY))) return
      if (!(await finalAnswered(u)) && live) setFinal(true)
    }
    check()
    const timer = setInterval(check, 30_000)
    const back = () => document.visibilityState === 'visible' && check()
    document.addEventListener('visibilitychange', back)
    return () => {
      live = false
      clearInterval(timer)
      document.removeEventListener('visibilitychange', back)
    }
  }, [ready, gate, retake, interview, final, user?.id])
  const finalShown = final && (PREVIEW_FINAL || (!interviewShown && !gate && !retake && route.name !== 'draw' && route.name !== 'tada' && route.name !== 'send'))

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

  const onSquare = route.name === 'main' && route.townId === SQUARE_ID
  const listing = route.name === 'towns' || route.name === 'migrate' || route.name === 'send'
  useEffect(() => {
    if (ready) refreshSquare()
  }, [ready, user?.id, onSquare, listing, refreshSquare])
  useEffect(() => {
    if (!ready || !onSquare) return
    const timer = setInterval(refreshSquare, 30_000)
    const back = () => document.visibilityState === 'visible' && refreshSquare()
    document.addEventListener('visibilitychange', back)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', back)
    }
  }, [ready, onSquare, refreshSquare])

  // usage log (admin → Stats): app session from the first render, then the screen every event happens on
  useEffect(() => startTracking(), [])
  const screenName = !ready ? 'splash' : gate === 'login' ? 'login' : gate === 'nickname' ? 'nickname' : gate === 'gilbti' || retake ? 'gilbti' : route.name
  const screenTown = route.name === 'main' || route.name === 'collection' ? route.townId : undefined
  const tutorialDraw = route.name === 'draw' && !!route.tutorial
  useEffect(() => {
    setScreen(screenName, { town: screenName === 'main' || screenName === 'collection' ? screenTown : undefined, tutorial: screenName === 'draw' ? tutorialDraw : undefined, retake: screenName === 'gilbti' ? retake : undefined })
  }, [screenName, screenTown, tutorialDraw, retake])

  // cards made before "by" existed get the account's nickname once (needs a nickname; not in admin "view as")
  useEffect(() => {
    if (!ready || viewAsId || !state.nickname) return
    const missing = Object.values(state.cards).some((c) => !c.by) || (state.pending && !state.pending.by)
    if (!missing) return
    commit((s) => {
      if (!s.nickname) return s
      const cards = Object.fromEntries(Object.entries(s.cards).map(([id, c]) => [id, c.by ? c : { ...c, by: s.nickname }]))
      return { ...s, cards, pending: s.pending && !s.pending.by ? { ...s.pending, by: s.nickname } : s.pending }
    })
  }, [ready, state.cards, state.pending, state.nickname, commit])

  const existing = (id: string) => (state.towns.some((t) => t.id === id) ? id : state.towns[0].id)
  const existingMain = (id: string) => (id === SQUARE_ID ? id : existing(id)) // the main screen can show the shared town
  const squareInfo = {
    town: view.towns[view.towns.length - 1],
    chief: square.rows[0]?.card,
    mine: square.rows.filter((r) => r.userId === user?.id).length,
    ok: square.ok,
  }
  const goMain = (townId: string, enter: 'left' | 'right' | 'center' = 'center', focus?: string) => {
    setHomeId(townId)
    setRoute({ name: 'main', townId, enter, focus })
  }

  // Sharing Plaza is a town like any other; only its residents live on the server (lib/square.ts).
  // Every move of one of your people goes through here: into / out of the plaza, or between your own towns.
  const squareFull = () => tr('You can have up to {n} people in {name}.', { n: SQUARE_PER_USER, name: tr(SQUARE_NAME) })
  const moveFailed = () => tr("Couldn't move this person. Try again in a moment.")
  // `swap`: someone of yours just left the plaza for this one, so the count isn't growing (the server still checks)
  async function toSquare(card: Card, swap = false): Promise<boolean> {
    const u = userRef.current
    if (viewAsId) return setError(READ_ONLY), false
    if (!u) return setError(tr('Log in to move someone to {name}.', { name: tr(SQUARE_NAME) })), false
    if (!swap && squareInfo.mine >= SQUARE_PER_USER) return setError(squareFull()), false
    const res = await waiting(moveIn(u, card))
    if (!res.ok) return setError(res.why === 'cap' ? squareFull() : moveFailed()), false
    setSquare((sq) => ({ ...sq, rows: [{ card, userId: u.id, movedAt: new Date().toISOString() }, ...sq.rows.filter((r) => r.card.id !== card.id)] }))
    return true
  }
  async function fromSquare(cardId: string): Promise<boolean> {
    if (viewAsId) return setError(READ_ONLY), false
    if (!(await waiting(moveOut(cardId)))) return setError(moveFailed()), false
    setSquare((sq) => ({ ...sq, rows: sq.rows.filter((r) => r.card.id !== cardId) }))
    return true
  }
  async function moveCard(cardId: string, townId: string, at?: number): Promise<boolean> {
    const card = view.cards[cardId]
    if (!card) return false
    const from = townOf(view, cardId)?.id
    if (from === townId && townId === SQUARE_ID) return true // order inside the plaza is by move-in time
    if (townId === SQUARE_ID) {
      if (!(await toSquare(card))) return false
      commit((s) => unplaceCard(s, cardId))
      return true
    }
    if (from === SQUARE_ID) {
      if (!(await fromSquare(cardId))) return false
      // the card comes back even if this device lost it
      commit((s) => placeCard({ ...s, cards: { ...s.cards, [cardId]: s.cards[cardId] ?? card } }, cardId, townId, at))
      return true
    }
    commit((s) => placeCard(s, cardId, townId, at))
    return true
  }
  // Collection drag onto someone in another town: the two trade places, the plaza included
  async function swapCard(a: string, b: string) {
    const ta = townOf(view, a)?.id
    const tb = townOf(view, b)?.id
    if (!ta || !tb) return
    if (ta !== SQUARE_ID && tb !== SQUARE_ID) return commit((s) => swapCards(s, a, b))
    const [inSq, out] = ta === SQUARE_ID ? [a, b] : [b, a]
    const home = ta === SQUARE_ID ? tb : ta
    const at = view.towns.find((t) => t.id === home)!.residents.indexOf(out)
    if (!(await fromSquare(inSq))) return
    const outCard = view.cards[out]!
    const inCard = view.cards[inSq]!
    commit((s) => {
      const t = unplaceCard({ ...s, cards: { ...s.cards, [inSq]: s.cards[inSq] ?? inCard } }, out)
      return placeCard(t, inSq, home, at)
    })
    if (!(await toSquare(outCard, true))) commit((s) => placeCard(s, out, home)) // the plaza said no: back home
  }
  // a person let go while living in the plaza leaves it too
  const forget = (cardId: string) => {
    if (mineInSquare(cardId)) fromSquare(cardId)
  }

  // pending card vanished (e.g. storage reset) → go home
  const lost = (route.name === 'tada' || route.name === 'send') && !state.pending
  useEffect(() => {
    if (lost) goMain(state.towns[0].id)
  })

  let screen
  switch (route.name) {
    case 'main': {
      const town = view.towns.find((t) => t.id === route.townId) ?? state.towns[0]
      const shared = town.id === SQUARE_ID
      screen = (
        <MainScreen
          key={town.id}
          state={view}
          town={town}
          enter={route.enter}
          focusId={route.focus ?? null}
          onTowns={() => setRoute({ name: 'towns' })}
          onCollection={() => setRoute({ name: 'collection', townId: existing(town.id) })}
          onOpenCard={(cardId) => setRoute({ name: 'collection', townId: town.id, card: cardId })}
          canMigrate={(cardId) => !shared || (!viewAsId && mineInSquare(cardId))}
          canOpen={(cardId) => !shared || (!viewAsId && mineInSquare(cardId))}
          onMyPage={() => setRoute({ name: 'mypage' })}
          onDraw={() => setRoute(state.pending ? { name: 'tada' } : { name: 'draw' })} // a finished card left waiting comes first
          onSwitch={(id) => goMain(id)}
          onMigrate={(cardId) => setRoute({ name: 'migrate', cardId, back: route, to: 'main' })}
        />
      )
      break
    }
    case 'towns':
      screen = <TownListScreen state={state} commit={commit} mode="browse" square={squareInfo} loggedIn={!!user} onBack={() => goMain(existingMain(homeId))} onGo={(id) => goMain(id)} onPlace={() => {}} />
      break
    case 'migrate': {
      const card = view.cards[route.cardId]
      const from = townOf(view, route.cardId)?.id
      const done = (townId: string) => {
        if (route.to === 'collection') setRoute({ name: 'collection', townId: route.back.name === 'collection' ? route.back.townId : existing(townId) })
        else goMain(townId, 'center', route.cardId)
      }
      screen = (
        <TownListScreen
          state={state}
          commit={commit}
          mode="migrate"
          card={card}
          homeId={from}
          square={squareInfo}
          loggedIn={!!user}
          onBack={() => setRoute(route.back)}
          onGo={() => {}}
          onPlace={async (townId) => {
            if (viewAsId) return setError(READ_ONLY)
            if (!(await moveCard(route.cardId, townId))) return setRoute(route.back)
            done(townId)
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
          square={squareInfo}
          loggedIn={!!user}
          onBack={() => setRoute({ name: 'tada' })}
          onGo={() => {}}
          onPlace={async (townId) => {
            const pending = state.pending!
            const id = pending.id
            if (townId === SQUARE_ID) {
              // a fresh drawing straight to the plaza: it joins your people, living there instead of in one of your towns
              if (!(await toSquare(pending))) return
              commit((s) => (s.pending?.id === id ? { ...s, cards: { ...s.cards, [id]: pending }, pending: null } : s))
            } else commit((s) => sendPending(s, townId))
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
          state={collectionView}
          commit={commit}
          townId={route.townId === SQUARE_ID ? SQUARE_ID : existing(route.townId)}
          onMoveCard={moveCard}
          onSwap={swapCard}
          onForget={forget}
          openCard={route.card}
          onTown={(id) => setRoute({ name: 'collection', townId: id })}
          onBack={() => goMain(existingMain(homeId))}
          onMigrate={(cardId) => setRoute({ name: 'migrate', cardId, back: { ...route, card: cardId }, to: 'collection' })}
        />
      )
      break
    case 'draw':
      screen = (
        <DrawScreen
          onExit={() => goMain(existingMain(homeId))}
          tutorial={route.tutorial}
          by={state.nickname}
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
      // iPad sideways: no landscape frame for this one; the phone screen in the middle column
      screen = state.pending && (
        <WideCol bg="#f0f0f0">
          <TadaScreen card={state.pending} onChoose={() => setRoute({ name: 'send' })} onBack={() => goMain(existingMain(homeId))} />
        </WideCol>
      )
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
          onBack={() => goMain(existingMain(homeId))}
          onInterview={() => (viewAsId ? setError(READ_ONLY) : setRetake(true))}
          onLogin={(u) => enter(u).then(() => setRoute({ name: 'mypage' }))}
          onLogout={async () => {
            if (viewAsId) return setError(READ_ONLY)
            await waiting(logOut().then(() => enter(null)))
            setRoute({ name: 'mypage' })
          }}
          onTutorial={() => setRoute({ name: 'draw', tutorial: true })}
          onLoadingTest={() => waiting(new Promise((r) => setTimeout(r, 12000)))} // long enough to see one line change
          onReset={() => {
            const fresh = initial()
            commit(() => fresh)
            setHomeId(fresh.towns[0].id)
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
              waiting(advance({ ...state, nickname })) // asks the server whether 길BTI is done
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
            return enter(u)
          }}
        />
      )}
      {ready && interviewShown && (
        <InterviewOverlay
          key={interview!.slot.day}
          kind={interview!.kind}
          onDone={async (answers) => {
            const { slot, kind, cards } = interview!
            await submitInterview(userRef.current, state.nickname ?? '', slot, kind, cards, answers)
            setInterview(null)
          }}
        />
      )}
      {ready && previewing && PREVIEW_INTERVIEW && <InterviewOverlay kind={PREVIEW_INTERVIEW} onDone={() => setPreviewing(false)} />}
      {ready && finalShown && (
        <FinalInterviewOverlay
          onSubmit={(answers) => (PREVIEW_FINAL ? undefined : submitFinal(userRef.current, state.nickname ?? '', answers))}
          onClose={() => setFinal(false)}
        />
      )}
      <NotifyPrompt user={ready && !viewAsId ? (user?.id ?? null) : null} blocked={loginPrompt || !!error || !!gate || retake || interviewShown || finalShown || previewing || (route.name === 'draw' && !!route.tutorial)} />
      <LoadingLayer />
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
