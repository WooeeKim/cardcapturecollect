import sampleDrawing from '../assets/sample-drawing.svg'
import CharacterCard from '../components/CharacterCard'
import { PaperBackground } from '../components/Paper'
import PenButton from '../components/PenButton'
import type { Sticker } from '../lib/stickers'

// 예시 카드 (Figma 샘플 그림)
const SAMPLE: Sticker = {
  id: 'sample',
  place: '2호선 강남역',
  name: '안경 쓴 산책러',
  memo: '이어폰 너머로 흥얼거리던 노래가 궁금했다.',
  mood: '느긋한',
  traits: ['다정한', '침착한'],
  imageUrl: sampleDrawing,
  createdAt: new Date().toISOString(),
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
          지하철에서 만난 사람,
          <br />
          카드로 남겨볼래요?
        </h1>
        <p className="mb-[22px] font-pen text-[21px] leading-[1.2] text-muted">
          얼굴을 빤히 보지 않기 · 몰래 찍지 않기
          <br />
          기억에 남은 모습만, 천천히 그려요
        </p>
        <PenButton onClick={onStart}>그리러 가기</PenButton>
      </div>
    </div>
  )
}
