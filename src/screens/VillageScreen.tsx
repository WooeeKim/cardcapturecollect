import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import CardSheet from '../components/CardSheet'
import { PaperBackground, TopBar } from '../components/Paper'
import PenButton from '../components/PenButton'
import SketchBorder from '../components/SketchBorder'
import { wobblyLine, wobblyRect } from '../lib/sketch'
import type { Sticker } from '../lib/stickers'

// 분위기대로 걷는다: [한 번 왕복하는 데 걸리는 초, 한 걸음 초, 가끔 하는 말]
const PACE: Record<string, [number, number, string]> = {
  느긋한: [28, 1.2, '음~'],
  피곤한: [34, 1.5, '졸려…'],
  조용한: [26, 1.1, '…'],
  우아한: [24, 1, '후후'],
  들뜬: [12, 0.55, '신난다!'],
  산만한: [14, 0.6, '어? 저기!'],
}
const DEFAULT_PACE: [number, number, string] = [20, 0.9, '']
const MAX_WALKERS = 10
const LANES = 5

function useWidth(ref: React.RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const el = ref.current!
    const read = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    read()
    const observer = new ResizeObserver(read)
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])
  return size
}

// Figma: 나은 섹션 04 마을 · 06 카드 디테일. 카드가 된 사람들이 승강장을 분위기대로 걸어 다니고, 누르면 카드가 열린다.
export default function VillageScreen({
  stickers,
  focusId,
  onCards,
  onDraw,
}: {
  stickers: Sticker[]
  focusId: string | null
  onCards: () => void
  onDraw: () => void
}) {
  const area = useRef<HTMLDivElement>(null)
  const { w, h } = useWidth(area)
  const [openId, setOpenId] = useState<string | null>(null)
  const [follow, setFollow] = useState(focusId)
  const scene = useMemo(
    () => ({
      train: wobblyRect(470, 120, 18, 901),
      windows: [10, 120, 260].map((x, i) => ({ x, d: wobblyRect(84, 46, 8, 910 + i) })),
      door: wobblyRect(56, 92, 4, 920),
      edge: wobblyLine(402, 930),
    }),
    [],
  )
  // 최근 카드부터 마을에 나온다
  const walkers = useMemo(() => stickers.map((s, i) => ({ s, n: i + 1 })).reverse().slice(0, MAX_WALKERS), [stickers])
  const open = walkers.find(({ s }) => s.id === openId)

  return (
    <div className="relative h-full overflow-hidden text-pencil">
      <PaperBackground />
      <TopBar left="카드" title="2호선 마을" right={`${walkers.length}명`} onLeft={onCards} />

      {/* 승강장: 열차 · 승강장 끝선 · 점자 블록 */}
      <svg viewBox="0 0 402 180" preserveAspectRatio="xMidYMin slice" className="pointer-events-none absolute inset-x-0 top-[calc(env(safe-area-inset-top)+88px)] h-[180px] w-full" fill="none" stroke="currentColor" strokeLinecap="round" aria-hidden>
        <path d={scene.train} transform="translate(-40 16)" fill="var(--color-card)" strokeWidth={1.6} />
        {scene.windows.map(({ x, d }) => (
          <path key={x} d={d} transform={`translate(${x} 40)`} strokeWidth={1.2} />
        ))}
        <path d={scene.door} transform="translate(202 42)" strokeWidth={1.2} />
        <path d="M230 42 L230 134" strokeWidth={1.2} />
        <text x={366} y={70} fill="currentColor" stroke="none" className="font-hand text-[18px] font-bold">
          2
        </text>
        <path d={scene.edge} transform="translate(0 150)" strokeWidth={1.6} />
        <path d={Array.from({ length: 34 }, (_, i) => `M${6 + i * 12} 168 L${7 + i * 12} 168`).join(' ')} strokeWidth={3} opacity={0.35} />
      </svg>
      <div className="pointer-events-none absolute top-[calc(env(safe-area-inset-top)+290px)] bottom-[110px] left-[18px] w-[30px] bg-wash">
        <SketchBorder w={30} h={420} r={4} seed={940} double={false} />
      </div>
      <div className="pointer-events-none absolute top-[calc(env(safe-area-inset-top)+282px)] right-[20px] rounded-full bg-card px-[26px] py-[4px] font-hand text-[18px] font-bold">
        강남
        <SketchBorder w={92} h={34} r={17} seed={950} weight={1.4} double={false} />
      </div>
      <svg viewBox="-1 -1 122 36" className="pointer-events-none absolute right-[32px] bottom-[86px] h-[36px] w-[122px]" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" aria-hidden>
        <path d="M0 0 L120 0 L120 10 L0 10 Z M10 10 L10 34 M110 10 L110 34" />
      </svg>

      {walkers.length === 0 && (
        <div className="absolute inset-x-0 top-1/2 flex flex-col items-center gap-[16px]">
          <p className="font-pen text-[22px] text-muted">아직 마을이 조용해요</p>
          <PenButton onClick={onDraw}>그리러 가기</PenButton>
        </div>
      )}

      {/* 걷는 사람들: 줄(깊이)마다 크기가 달라 멀리 있는 사람은 작게 */}
      <div ref={area} className="absolute inset-x-0 top-[calc(env(safe-area-inset-top)+250px)] bottom-[30px]">
        {w > 0 &&
          walkers.map(({ s }, i) => {
            const [dur, step, word] = PACE[s.mood] ?? DEFAULT_PACE
            const lane = (i * 2) % LANES
            const depth = 0.78 + (lane / (LANES - 1)) * 0.34
            const size = 84 * depth
            const top = (lane / (LANES - 1)) * Math.max(0, h - size * 1.5 - 40)
            const delay = -((i * 7.3) % dur)
            const following = follow === s.id
            return (
              <button
                key={s.id}
                aria-label={`${s.name || '이름 없는 사람'} 카드 보기`}
                onClick={() => setOpenId(s.id)}
                className="absolute left-0 flex flex-col items-center"
                style={
                  {
                    top,
                    zIndex: following ? 20 : lane + 1,
                    '--from': '8px',
                    '--to': `${w - size - 16}px`,
                    animation: `walk-across ${dur}s ease-in-out ${delay}s infinite`,
                  } as CSSProperties
                }
              >
                {word && (
                  <span
                    className="absolute -top-[22px] left-[60%] rounded-full bg-card px-[8px] font-pen text-[15px] leading-[1.3] whitespace-nowrap"
                    style={{ animation: `bubble-blink 7s ease-in-out ${delay * 0.6}s infinite` }}
                  >
                    {word}
                    <SketchBorder w={50} h={20} r={10} seed={21 + i} weight={1.1} double={false} />
                  </span>
                )}
                <span className="relative block" style={{ width: size, height: size * 1.5, animation: `walk-face ${dur}s linear ${delay}s infinite` }}>
                  <span className="absolute inset-x-[18%] bottom-[2px] h-[7px] rounded-full bg-pencil/15" />
                  <span className="absolute inset-0 origin-bottom" style={{ animation: `walk-bob ${step}s ease-in-out infinite` }}>
                    <img src={s.imageUrl} alt="" draggable={false} className="size-full object-contain" />
                  </span>
                  {following && <SketchBorder w={64} h={96} r={30} seed={970} weight={1.6} double={false} className="-inset-[6px]! size-[calc(100%+12px)]! [&_path]:[stroke-dasharray:6_4]" />}
                </span>
                <span className="relative mt-[2px] max-w-[110px] truncate rounded-full bg-card px-[9px] font-pen text-[14px] leading-[1.35]">
                  {s.name || '이름 없는 사람'}
                  <SketchBorder w={90} h={20} r={10} seed={9 + i} weight={1} double={false} />
                </span>
              </button>
            )
          })}
      </div>

      {open && (
        <CardSheet
          sticker={open.s}
          number={open.n}
          action={follow === open.s.id ? '그만 따라가기' : '따라가기'}
          onAction={() => {
            setFollow(follow === open.s.id ? null : open.s.id)
            setOpenId(null)
          }}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  )
}
