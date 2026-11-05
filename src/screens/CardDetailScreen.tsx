import { useEffect, useState } from 'react'
import { PaperBackground, TopBar } from '../components/Paper'
import { formatDate } from '../components/StickerFrame'
import { createSticker, type Sticker } from '../lib/stickers'

// Figma 03 무드 선택: 4×3 격자. 위에서 아래로 갈수록 진한 회색 칠 (Silent는 고른 상태라 흰색)
const MOODS = ['조용한', '즐거운', '차분한', '우아한', '수줍은', '졸린', '바쁜', '산만한', '밝은', '다정한', '부드러운', '활기찬']
const MOOD_FILL = ['#d6d6d6', '#c1c1c1', '#a8a8a8', '#8f8f8f', '#707070']
const MEMO_MAX = 80

// 점선 칸: Figma 03 "작성 전"의 이름·장소·메모 입력 모양
const dashed = 'rounded-[10px] border-2 border-dashed border-[#707070] bg-white/60 backdrop-blur-[2px]'

// Figma: 03 세부사항 (작성 전 → 작성 중 → 무드 선택). 방금 그린 그림 위에서 바로 장소·별명·분위기·메모를 쓰고 카드로 저장한다.
export default function CardDetailScreen({ image, onBack, onSaved }: { image: Blob; onBack: () => void; onSaved: (sticker: Sticker) => void }) {
  const [name, setName] = useState('')
  const [place, setPlace] = useState('')
  const [mood, setMood] = useState('')
  const [memo, setMemo] = useState('')
  const [picking, setPicking] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  // 그림 미리보기 URL (화면을 떠나면 해제)
  const [preview, setPreview] = useState('')
  useEffect(() => {
    const url = URL.createObjectURL(image)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [image])

  async function save() {
    setSaving(true)
    setMessage('')
    try {
      onSaved(await createSticker({ place: place.trim(), name: name.trim(), memo: memo.trim(), mood, traits: [], image }))
    } catch (e) {
      setMessage(`저장 실패: ${e instanceof Error ? e.message : String(e)}`)
      setSaving(false)
    }
  }

  return (
    <div className="absolute inset-0 z-20 overflow-hidden">
      <PaperBackground />
      <TopBar left="뒤로" title="카드 만들기" right="완성" onLeft={onBack} onRight={save} rightDisabled={saving} />

      {/* 카드 도화지: 그림 위에 날짜·장소(위), 별명·분위기·메모(아래)를 얹는다 */}
      <div className="absolute top-[calc(env(safe-area-inset-top)+96px)] left-1/2 w-[min(360px,var(--app-w)-40px)] -translate-x-1/2 text-pencil">
        <div className="relative aspect-[360/515] overflow-hidden rounded-[10px] bg-[#f2f2f2]">
          {preview && <img src={preview} alt="방금 그린 그림" className="absolute inset-[10px] size-[calc(100%-20px)] object-contain" />}

          <span className="absolute top-[12px] left-[14px] font-hand text-[18px] leading-none font-bold">{formatDate(new Date().toISOString())}</span>
          <input
            value={place}
            onChange={(e) => setPlace(e.target.value)}
            placeholder="어디서 봤나요"
            maxLength={20}
            aria-label="장소"
            className={`absolute top-[6px] right-[8px] w-[52%] px-[7px] py-[5px] text-right font-pen text-[20px] leading-[1.1] text-[#3d3d3d] outline-none placeholder:text-[#3d3d3d]/60 ${dashed}`}
          />

          <div className="absolute inset-x-[10px] bottom-[10px] flex flex-col gap-[10px]">
            <div className="flex items-center justify-between gap-[8px]">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="별명"
                maxLength={20}
                aria-label="별명"
                className={`w-[168px] px-[7px] py-[5px] text-center font-pen text-[20px] leading-[1.1] text-[#3d3d3d] outline-none placeholder:text-[#3d3d3d]/60 ${dashed}`}
              />
              <button
                type="button"
                onClick={() => setPicking(true)}
                className="rounded-full bg-pencil px-[13px] pt-[6px] pb-[4px] font-pen text-[21px] leading-[1.1] text-card transition-transform ease-spring active:scale-95"
              >
                {mood || '+ 분위기'}
              </button>
            </div>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              maxLength={MEMO_MAX}
              placeholder="순간을 남겨요"
              aria-label="한 줄 메모"
              className={`block h-[86px] w-full resize-none px-[7px] py-[5px] font-pen text-[18px] leading-[1.1] text-[#3d3d3d] outline-none placeholder:text-[#3d3d3d]/60 ${dashed}`}
            />
          </div>
        </div>
        {message && <p className="pt-[10px] text-center font-pen text-[18px] text-muted">{message}</p>}
      </div>

      {picking && (
        <div className="absolute inset-0 z-10 bg-black/40 backdrop-blur-[2px]">
          <button aria-label="닫기" onClick={() => setPicking(false)} className="absolute inset-0" />
          <div className="absolute top-1/2 left-1/2 w-[min(360px,var(--app-w)-40px)] -translate-x-1/2 -translate-y-1/2">
            <div className="grid grid-cols-4 gap-x-[7px] gap-y-[10px] p-[10px]">
              {MOODS.map((m, i) => {
                const on = mood === m
                return (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={on}
                    onClick={() => {
                      setMood(on ? '' : m)
                      setPicking(false)
                    }}
                    className="rounded-full py-[8px] font-pen text-[19px] leading-none whitespace-nowrap text-pencil transition-transform ease-spring active:scale-95"
                    style={{ background: on ? '#ffffff' : MOOD_FILL[Math.min(Math.floor(i / 4) + (i % 4), MOOD_FILL.length - 1)] }}
                  >
                    {m}
                  </button>
                )
              })}
            </div>
            <div className="mt-[6px] flex justify-end px-[10px]">
              <button type="button" onClick={() => setPicking(false)} className="rounded-full bg-pencil px-[13px] pt-[6px] pb-[4px] font-pen text-[21px] leading-[1.1] text-card">
                분위기 ✕
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
