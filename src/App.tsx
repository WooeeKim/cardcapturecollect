import { useCallback, useEffect, useState } from 'react'
import GridBackground from './components/GridBackground'
import TopTabs, { type Tab } from './components/TopTabs'
import { DEFAULT_LABEL } from './lib/labels'
import { deleteSticker, listStickers, updateSticker, type Sticker } from './lib/stickers'
import { supabase } from './lib/supabase'
import CanvasScreen from './screens/CanvasScreen'
import CardCompleteScreen from './screens/CardCompleteScreen'
import CardListScreen from './screens/CardListScreen'
import OnboardingScreen from './screens/OnboardingScreen'
import Splash from './screens/Splash'
import StickerBookScreen from './screens/StickerBookScreen'
import SubwayDecoScreen from './screens/SubwayDecoScreen'
import VillageScreen from './screens/VillageScreen'
import VillageSelectScreen, { summarizeVillages } from './screens/VillageSelectScreen'

// 위 탭 3개(지하철 꾸미기 · 캔버스 · 스티커북)에 카드 방향 화면(마을 · 카드 목록)을 더한다
type Screen = Tab | 'village' | 'cards'

export default function App() {
  const [started, setStarted] = useState(false)
  // 온보딩은 첫 실행에만 (기기에 기억)
  const [onboarded, setOnboarded] = useState(readOnboarded)
  const [tab, setTab] = useState<Screen>('canvas')
  const [stickers, setStickers] = useState<Sticker[]>([])
  const [error, setError] = useState('')
  // 지금 보고 있는 스티커북(라벨). 스티커북과 지하철 꾸미기가 같이 쓴다.
  const [label, setLabel] = useState(DEFAULT_LABEL)
  // 방금 만든 카드 (03 카드 완성 화면에 보여준다)
  const [made, setMade] = useState<{ sticker: Sticker; number: number } | null>(null)
  // 카드 목록에서 "마을에서 찾기"로 고른 사람
  const [focus, setFocus] = useState<string | null>(null)
  // 04 이정표 선택 중인지, 지금 보는 마을, 방금 이사 온 사람 이름
  const [choosing, setChoosing] = useState(false)
  // 컬렉션에서 입장권을 눌러 마을 고르기로 온 경우 (뒤로 가면 컬렉션으로)
  const [fromList, setFromList] = useState(false)
  const [villageNo, setVillageNo] = useState<number | null>(null)
  const [movedIn, setMovedIn] = useState('')

  const refresh = useCallback(() => {
    return listStickers()
      .then((list) => {
        setStickers(list)
        setError('')
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  if (!started) return <Splash onStart={() => setStarted(true)} />

  if (!onboarded) return (
      <OnboardingScreen
        onStart={() => {
          writeOnboarded()
          setOnboarded(true)
          setTab('canvas')
        }}
      />
    )

  // 지하철 꾸미기는 가로 화면이라 탭 없이 전체를 쓴다
  if (tab === 'deco') return (
      <SubwayDecoScreen
        stickers={stickers}
        label={label}
        onLabel={setLabel}
        onChange={refresh}
        onBack={() => setTab('canvas')}
      />
    )

  if (made && choosing) return (
      <VillageSelectScreen
        sticker={made.sticker}
        stickers={stickers}
        onBack={() => {
          setChoosing(false)
          if (fromList) {
            setMade(null)
            setFromList(false)
          }
        }}
        onPick={async (village) => {
          await updateSticker(made.sticker.id, { village }).catch((e) => setError(e instanceof Error ? e.message : String(e)))
          await refresh()
          setMovedIn(made.sticker.name || 'Someone new')
          setVillageNo(village)
          setFocus(made.sticker.id)
          setMade(null)
          setChoosing(false)
          setFromList(false)
          setTab('village')
        }}
      />
    )

  if (made) return (
      <CardCompleteScreen
        sticker={made.sticker}
        number={made.number}
        onVillage={() => setChoosing(true)}
        onList={() => {
          setMade(null)
          setTab('cards')
        }}
      />
    )

  // 카드 방향 화면들은 자기 위 막대가 있어 탭 없이 전체를 쓴다
  if (tab === 'canvas') return (
      <CanvasScreen
        onClose={() => setTab('cards')}
        onSaved={(sticker) => {
          refresh()
          setMade({ sticker, number: stickers.length + 1 })
        }}
      />
    )

  if (tab === 'cards') return (
      <CardListScreen
        stickers={stickers}
        onVillage={() => {
          setVillageNo(null)
          setTab('village')
        }}
        onDraw={() => setTab('canvas')}
        onTicket={(sticker, number) => {
          setFromList(true)
          setMade({ sticker, number })
          setChoosing(true)
        }}
        onDelete={async (sticker) => {
          await deleteSticker(sticker).catch((e) => setError(e instanceof Error ? e.message : String(e)))
          await refresh()
        }}
        onFind={(id) => {
          setFocus(id)
          setVillageNo(stickers.find((s) => s.id === id)?.village ?? null)
          setTab('village')
        }}
      />
    )

  if (tab === 'village') return (
      <VillageScreen
        key={`${focus ?? ''}-${villageNo ?? ''}`}
        stickers={stickers}
        village={villageNo ?? stickers.find((s) => s.id === focus)?.village ?? summarizeVillages(stickers)[0]?.village ?? 1}
        focusId={focus}
        movedIn={movedIn}
        onMovedInShown={() => setMovedIn('')}
        onLeave={async (id) => {
          await updateSticker(id, { village: null }).catch((e) => setError(e instanceof Error ? e.message : String(e)))
          await refresh()
        }}
        onCards={() => setTab('cards')}
        onDraw={() => setTab('canvas')}
      />
    )

  return (
    <div className="relative h-full overflow-hidden">
      <GridBackground />
      <div className="absolute inset-x-0 top-[calc(env(safe-area-inset-top)+18px)] z-10">
        <TopTabs tab={tab} onChange={setTab} />
      </div>
      {(!supabase || error) && (
        <p className="absolute inset-x-0 top-[calc(env(safe-area-inset-top)+2px)] z-10 text-center text-[10px] font-medium text-muted">
          {error ? `DB error: ${error}` : 'DB not connected · saved in memory only (check .env.local)'}
        </p>
      )}
      <StickerBookScreen stickers={stickers} label={label} onLabel={setLabel} onChange={refresh} />
    </div>
  )
}

const ONBOARDED_KEY = 'subwayseal.onboarded'

function readOnboarded() {
  try {
    return localStorage.getItem(ONBOARDED_KEY) === 'yes'
  } catch {
    return false
  }
}

function writeOnboarded() {
  try {
    localStorage.setItem(ONBOARDED_KEY, 'yes')
  } catch {
    // 시크릿 모드 등 — 다음 실행 때 온보딩이 다시 보인다
  }
}
