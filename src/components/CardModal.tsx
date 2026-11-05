import { useState } from 'react'
import CharacterCard from './CharacterCard'
import PenButton from './PenButton'
import type { Sticker } from '../lib/stickers'

// Figma: 05 콜렉션 | 자세히 보기. 카드를 크게 보여주고 아래에 행동 버튼을 둔다.
// 마을에 아직 없는 카드는 "마을 입장권 받기"와 "카드 삭제"(한 번 더 확인), 이미 마을에 있으면 "마을에서 찾기".
export default function CardModal({
  sticker,
  number,
  onTicket,
  onFind,
  onDelete,
  onClose,
}: {
  sticker: Sticker
  number: number
  onTicket: () => void
  onFind: () => void
  onDelete: () => void
  onClose: () => void
}) {
  const [flipped, setFlipped] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const inVillage = sticker.village != null

  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-[22px] bg-pencil/50 px-[24px] backdrop-blur-[3px]">
      <button aria-label="닫기" onClick={onClose} className="absolute inset-0" />
      <button aria-label="닫기" onClick={onClose} className="absolute top-[calc(env(safe-area-inset-top)+86px)] right-[24px] z-10 flex size-[40px] items-center justify-center rounded-full bg-pencil font-hand text-[20px] leading-none font-bold text-card">
        ✕
      </button>
      <button aria-label="카드 뒤집기" onClick={() => setFlipped(!flipped)} className="relative w-[min(300px,var(--app-w)-72px,(var(--app-h)-env(safe-area-inset-top)-330px)*250/350)] animate-pop-up">
        <CharacterCard sticker={sticker} number={number} flipped={flipped} />
      </button>
      <div className="relative flex w-[min(300px,100%)] flex-col items-stretch gap-[12px] rounded-[20px] bg-card p-[14px] text-pencil [&>button]:w-full">
        {inVillage ? (
          <PenButton onClick={onFind}>마을에서 찾기</PenButton>
        ) : confirming ? (
          <>
            <p className="text-center font-pen text-[22px] leading-none">이 카드를 지울까요? 되돌릴 수 없어요</p>
            <PenButton onClick={onDelete}>삭제하기</PenButton>
            <PenButton ghost onClick={() => setConfirming(false)}>
              취소
            </PenButton>
          </>
        ) : (
          <>
            <PenButton onClick={onTicket}>마을 입장권 받기</PenButton>
            <PenButton ghost onClick={() => setConfirming(true)}>
              카드 삭제
            </PenButton>
          </>
        )}
      </div>
    </div>
  )
}
