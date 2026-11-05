import sampleDrawing from '../assets/sample-drawing.svg'
import CharacterCard from '../components/CharacterCard'
import { PaperBackground } from '../components/Paper'
import PenButton from '../components/PenButton'
import type { Sticker } from '../lib/stickers'

// 예시 카드 (Figma 샘플 그림)
const SAMPLE: Sticker = {
  id: 'sample',
  place: 'Gangnam Station, Seoul',
  name: 'Glasses Walker',
  memo: 'Wondered what song they were humming through the earbuds.',
  mood: 'Calm',
  traits: [],
  imageUrl: sampleDrawing,
  createdAt: new Date().toISOString(),
  village: 1,
  bookLabel: null,
  bookPage: null,
  bookSlot: null,
  decoX: null,
  decoY: null,
}

// Figma: 나은 섹션 00 온보딩 (첫 실행만). 서비스 의미 + 관찰 매너.
export default function OnboardingScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="relative h-full overflow-hidden text-pencil">
      <PaperBackground />

      {/* 겹쳐 놓은 카드: 뒷면 위에 예시 앞면 */}
      <div className="absolute top-[calc(env(safe-area-inset-top)+70px)] left-1/2 h-[min(330px,calc(var(--app-h)-420px))] w-[min(270px,calc(var(--app-w)-110px))] -translate-x-1/2">
        <div className="absolute top-[18px] left-[42px] isolate z-0 w-[78%] rotate-[7deg]">
          <CharacterCard sticker={SAMPLE} number={1} flipped />
        </div>
        <div className="absolute top-0 left-0 isolate z-10 w-[82%] animate-float-up" style={{ '--rot': '-5deg' } as React.CSSProperties}>
          <CharacterCard sticker={SAMPLE} number={1} />
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+40px)] flex flex-col items-center gap-[14px] px-[24px] text-center">
        <h1 className="font-hand text-[30px] leading-[1.2] font-bold">
          Someone you met on the subway,
          <br />
          kept as a card?
        </h1>
        <p className="mb-[22px] font-pen text-[21px] leading-[1.2] text-muted">
          Don’t stare · Don’t sneak photos
          <br />
          Draw only what stayed with you, slowly
        </p>
        <PenButton onClick={onStart}>Go draw</PenButton>
      </div>
    </div>
  )
}
