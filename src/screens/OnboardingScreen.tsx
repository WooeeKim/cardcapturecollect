import { PaperBackground } from '../components/Paper'
import PenButton from '../components/PenButton'
import { wobblyCircle, wobblyLine } from '../lib/sketch'

// Figma 00 온보딩의 "지하철 라인 쫘르륵" 자리: 402×874 화면 기준 중심 좌표(%)와 길이
const LINES = [
  { x: 24.5, y: 19.5, len: 130, seed: 11 },
  { x: 66, y: 29.5, len: 130, seed: 12 },
  { x: 24.5, y: 73, len: 130, seed: 13 },
  { x: 72, y: 85.5, len: 130, seed: 14 },
]

// 손으로 쭉 그은 지하철 노선: 가로선 + 역 동그라미 두 개
function Line({ len, seed }: { len: number; seed: number }) {
  return (
    <svg width={len} height="24" viewBox={`-6 -12 ${len + 12} 24`} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
      <path d={wobblyLine(len, seed, 3)} />
      <path d={wobblyCircle(len * 0.28, 0, 5, seed + 20)} fill="var(--color-card)" />
      <path d={wobblyCircle(len * 0.74, 0, 5, seed + 40)} fill="var(--color-card)" />
    </svg>
  )
}

// Figma: 나은 섹션 00 온보딩 (첫 실행만). 질문 한 줄 + 마을로 가는 버튼.
export default function OnboardingScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="relative h-full overflow-hidden text-pencil">
      <PaperBackground />

      {LINES.map((l) => (
        <span key={l.seed} className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 text-pencil/70" style={{ left: `${l.x}%`, top: `${l.y}%` }}>
          <Line len={l.len} seed={l.seed} />
        </span>
      ))}

      <div className="absolute inset-x-0 top-[41%] flex -translate-y-1/2 flex-col items-center gap-[16px] px-[24px] text-center">
        <h1 className="font-hand text-[30px] leading-[1.2] font-bold tracking-[-0.02em]">Who catches your eyes?</h1>
        <PenButton onClick={onStart}>Go to town</PenButton>
      </div>
    </div>
  )
}
