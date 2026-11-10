import { useCallback, useEffect, useState } from 'react'
import { PhoneChrome, Popup } from './components/ui'
import { load, makePending, placeCard, save, sendPending, townOf, type State } from './lib/store'
import CollectionScreen from './screens/CollectionScreen'
import DrawScreen, { TadaScreen } from './screens/DrawScreen'
import MainScreen from './screens/MainScreen'
import TownListScreen from './screens/TownListScreen'

type Route =
  | { name: 'main'; townId: string; enter: 'left' | 'right' | 'center'; focus?: string }
  | { name: 'towns' }
  | { name: 'migrate'; cardId: string; back: Route; to: 'main' | 'collection' }
  | { name: 'send' }
  | { name: 'collection'; townId: string }
  | { name: 'draw' }
  | { name: 'tada' }

export default function App() {
  const [state, setState] = useState<State>(load)
  const [error, setError] = useState('')
  const [route, setRoute] = useState<Route>(() => {
    const s = load()
    return s.pending ? { name: 'tada' } : { name: 'main', townId: s.towns[0].id, enter: 'center' }
  })
  // town the main screen was last showing
  const [homeId, setHomeId] = useState(state.towns[0].id)

  // every change is saved; if storage is full the change is undone and the user is told
  const commit = useCallback((fn: (s: State) => State) => {
    setState((prev) => {
      const next = fn(prev)
      try {
        save(next)
        return next
      } catch {
        setError('Storage is full. Delete some cards to save new ones.')
        return prev
      }
    })
  }, [])

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
          onMigrate={(cardId) => setRoute({ name: 'migrate', cardId, back: route, to: 'collection' })}
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
              save(next)
            } catch {
              return setError('Storage is full. Delete some cards to save new ones.')
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
  }

  return (
    <>
      {screen}
      <PhoneChrome />
      {error && <Popup message={error} actions={[{ label: 'Got it!', onClick: () => setError('') }]} />}
    </>
  )
}
