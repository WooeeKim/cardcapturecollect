import { useEffect, useMemo, useState } from 'react'
import Chip from '../components/Chip'
import { PaperBackground, TopBar } from '../components/Paper'
import PenButton from '../components/PenButton'
import SketchBorder from '../components/SketchBorder'
import { wobblyLine } from '../lib/sketch'
import { createSticker, type Sticker } from '../lib/stickers'

const MOODS = ['우아한', '피곤한', '산만한', '느긋한', '들뜬', '조용한']
const TRAITS = ['다정한', '침착한', '유머러스한', '수줍은', '씩씩한', '꼼꼼한']
const MAX_TRAITS = 2
const MEMO_MAX = 80

// Figma: 나은 섹션 02 카드 상세 입력. 방금 그린 그림에 이름 · 장소 · 분위기(하나) · 성격(두 개까지) · 메모를 붙여 카드로 저장한다.
export default function CardDetailScreen({ image, onBack, onSaved }: { image: Blob; onBack: () => void; onSaved: (sticker: Sticker) => void }) {
  const [name, setName] = useState('')
  const [place, setPlace] = useState('')
  const [mood, setMood] = useState('')
  const [traits, setTraits] = useState<string[]>([])
  const [memo, setMemo] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const lines = useMemo(() => ({ field: wobblyLine(230, 150, 1.6) }), [])

  // 그림 미리보기 URL (화면을 떠나면 해제)
  const [preview, setPreview] = useState('')
  useEffect(() => {
    const url = URL.createObjectURL(image)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [image])

  // 성격은 두 개까지. 이미 두 개면 먼저 고른 것을 빼고 새로 고른 것을 넣는다.
  function toggleTrait(t: string) {
    setTraits((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t].slice(-MAX_TRAITS)))
  }

  async function save() {
    setSaving(true)
    setMessage('')
    try {
      onSaved(await createSticker({ place: place.trim(), name: name.trim(), memo: memo.trim(), mood, traits, image }))
    } catch (e) {
      setMessage(`저장 실패: ${e instanceof Error ? e.message : String(e)}`)
      setSaving(false)
    }
  }

  const field = (label: string, value: string, set: (v: string) => void, placeholder: string) => (
    <label className="relative block pb-[10px]">
      <span className="text-[11px] leading-none text-muted">{label}</span>
      <input
        value={value}
        onChange={(e) => set(e.target.value)}
        placeholder={placeholder}
        maxLength={20}
        className="mt-[4px] block w-full bg-transparent font-pen text-[26px] leading-[1.1] text-pencil caret-pencil outline-none placeholder:text-muted placeholder:opacity-50"
      />
      <svg viewBox="0 -2 230 4" preserveAspectRatio="none" className="absolute inset-x-0 bottom-[4px] h-[4px] w-full overflow-visible text-pencil" aria-hidden>
        <path d={lines.field} fill="none" stroke="currentColor" strokeWidth={1.1} opacity={0.8} vectorEffect="non-scaling-stroke" />
      </svg>
    </label>
  )

  return (
    <div className="absolute inset-0 z-20 overflow-hidden">
      <PaperBackground />
      <TopBar left="뒤로" title="카드 만들기" right="완성" onLeft={onBack} onRight={save} rightDisabled={saving} />

      <div className="absolute inset-x-0 top-[calc(env(safe-area-inset-top)+88px)] bottom-0 overflow-y-auto px-[24px] pb-[120px] text-pencil">
        <div className="mt-[8px] flex gap-[20px]">
          <div className="relative h-[156px] w-[104px] shrink-0 rounded-[8px] bg-card">
            {preview && <img src={preview} alt="방금 그린 그림" className="absolute inset-[5px] size-[calc(100%-10px)] object-contain" />}
            <SketchBorder w={104} h={156} r={8} seed={701} double={false} />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-[14px] pt-[6px]">
            {field('이름', name, setName, '안경 쓴 산책러')}
            {field('어디서 봤나요', place, setPlace, '2호선 강남역')}
          </div>
        </div>

        <section className="mt-[22px]">
          <h2 className="text-[11px] leading-none text-muted">분위기</h2>
          <div className="mt-[10px] flex flex-wrap gap-[8px]">
            {MOODS.map((m, i) => (
              <Chip key={m} label={m} seed={121 + i} on={mood === m} onClick={() => setMood(mood === m ? '' : m)} />
            ))}
          </div>
        </section>

        <section className="mt-[22px]">
          <h2 className="text-[11px] leading-none text-muted">성격</h2>
          <div className="mt-[10px] flex flex-wrap gap-[8px]">
            {TRAITS.map((t, i) => (
              <Chip key={t} label={t} seed={141 + i} on={traits.includes(t)} onClick={() => toggleTrait(t)} />
            ))}
          </div>
        </section>

        <section className="mt-[22px]">
          <h2 className="text-[11px] leading-none text-muted">한 줄 메모</h2>
          <div className="relative mt-[10px]">
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              maxLength={MEMO_MAX}
              rows={3}
              placeholder="기억에 남은 모습을 짧게 적어요"
              className="block w-full resize-none bg-transparent px-[14px] py-[12px] font-pen text-[21px] leading-[1.2] text-pencil outline-none placeholder:text-muted placeholder:opacity-50"
            />
            <SketchBorder w={354} h={96} r={10} seed={731} weight={1} double={false} className="[&_path]:[stroke-dasharray:4_3]" />
          </div>
        </section>
        {message && <p className="mt-[8px] text-center font-pen text-[18px] text-muted">{message}</p>}
      </div>

      <div className="absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+28px)] flex justify-center">
        <PenButton onClick={save} disabled={saving}>
          {saving ? '만드는 중…' : '카드로 만들기'}
        </PenButton>
      </div>
    </div>
  )
}
