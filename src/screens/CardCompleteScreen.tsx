import CharacterCard from '../components/CharacterCard'
import { PaperBackground } from '../components/Paper'
import PenButton from '../components/PenButton'
import type { Sticker } from '../lib/stickers'

// Figma: 03 세부사항 | 작성 후. 완성된 카드 위로 올라오는 시트에서
// "마을에 데려갈까요?" — 마을 입장권(마을로) / 컬렉션에 보관(카드 목록).
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
  const name = sticker.name || '이 사람'
  return (
    <div className="absolute inset-0 z-30 overflow-hidden text-pencil">
      <PaperBackground />

      <div className="absolute top-[calc(env(safe-area-inset-top)+60px)] left-1/2 w-[min(300px,var(--app-w)-80px,(var(--app-h)-env(safe-area-inset-top)-400px)*250/350)] -translate-x-1/2">
        <div className="animate-float-up" style={{ '--rot': '-2deg' } as React.CSSProperties}>
          <CharacterCard sticker={sticker} number={number} />
        </div>
      </div>

      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" aria-hidden />
      <div className="absolute inset-x-0 bottom-0 animate-sheet-up rounded-t-[27px] bg-card px-[51px] pt-[10px] pb-[calc(env(safe-area-inset-bottom)+40px)] shadow-[0_-5px_25px_rgba(0,0,0,0.2)]">
        <span className="mx-auto block h-[4px] w-[70px] rounded-full bg-pencil" />
        <p className="mt-[34px] text-center font-pen text-[24px] leading-[1.2]">
          <span className="underline decoration-1 underline-offset-[6px]">{name}</span>
          {sticker.name ? '을(를)' : ''} 마을에 데려갈까요?
        </p>
        <div className="mt-[28px] flex flex-col items-stretch gap-[12px] [&>button]:w-full">
          <PenButton onClick={onVillage}>마을 입장권 받기</PenButton>
          <PenButton ghost onClick={onList}>
            컬렉션에 보관
          </PenButton>
        </div>
      </div>
    </div>
  )
}
