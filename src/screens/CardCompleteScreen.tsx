import CharacterCard from '../components/CharacterCard'
import { PaperBackground } from '../components/Paper'
import PenButton from '../components/PenButton'
import type { Sticker } from '../lib/stickers'

// 카드 주변 반짝임 (x, y, 크기)
const SPARKLES = [
  [12, 22, 9],
  [88, 16, 7],
  [92, 70, 10],
  [8, 64, 6],
]

// Figma: 나은 섹션 03 카드 완성. 과정의 의미 한 줄 + 마을로 풀어주기 / 카드 목록.
export default function CardCompleteScreen({
  sticker,
  number,
  onVillage,
  onList,
}: {
  sticker: Sticker
  number: number
  onVillage: () => void
  onList: () => void
}) {
  return (
    <div className="absolute inset-0 z-30 overflow-hidden text-pencil">
      <PaperBackground />
      <p className="absolute inset-x-0 top-[calc(env(safe-area-inset-top)+36px)] text-center font-hand text-[26px] leading-none font-bold">완성!</p>

      <div className="absolute top-[calc(env(safe-area-inset-top)+84px)] left-1/2 w-[min(300px,var(--app-w)-80px,(var(--app-h)-env(safe-area-inset-top)-330px)*250/350)] -translate-x-1/2">
        <div className="animate-float-up" style={{ '--rot': '-2deg' } as React.CSSProperties}>
          <CharacterCard sticker={sticker} number={number} />
        </div>
        {SPARKLES.map(([x, y, r], i) => (
          <svg key={i} viewBox="-12 -12 24 24" className="absolute -translate-1/2" style={{ left: `${x}%`, top: `${y}%`, width: r * 2.4, height: r * 2.4 }} aria-hidden>
            <path d={`M0 -${r} L0.5 ${r} M-${r} 0 L${r} 0.4 M-${r * 0.6} -${r * 0.6} L${r * 0.6} ${r * 0.6}`} stroke="currentColor" strokeWidth={1.2} strokeLinecap="round" opacity={0.8} />
          </svg>
        ))}
      </div>

      <div className="absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+24px)] flex flex-col items-center gap-[14px]">
        <p className="mb-[10px] text-center font-hand text-[23px] leading-[1.25] font-bold">
          한 사람을 오래 바라본 시간이
          <br />
          카드 한 장이 됐어요
        </p>
        <PenButton onClick={onVillage}>마을에 풀어주기</PenButton>
        <PenButton ghost onClick={onList}>
          카드 목록 보기
        </PenButton>
      </div>
    </div>
  )
}
