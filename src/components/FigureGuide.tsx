// 따라 그리기용 사람 실루엣 (트레이싱 가이드). 저장 이미지에는 들어가지 않는다.
// Figma 나은 섹션 "Figure Guide": 약 6등신(머리 크고 다리 짧은 친근한 비율), 정면, 팔은 몸에서 살짝 뗀다.
// 얼굴은 비워 두고, 왼쪽 반만 그려 좌우 반전해 대칭을 맞춘다.
const HALF =
  'M44 43 L44 50' + // 목
  ' C36 52 26 53 19 59' + // 어깨
  ' C15 78 11 100 9 127' + // 팔 바깥선 → 손목
  ' C7 132 7 139 10 142 C13 145 16 142 16 137 C16 133 16 130 15 127' + // 손
  ' C18 108 22 90 25 75' + // 팔 안쪽선 → 겨드랑이
  ' C26 88 26 100 27 110 C26 118 26 125 27 134' + // 몸통 옆선
  ' C27 165 29 200 31 226' + // 다리 바깥선
  ' C26 229 25 235 30 236 L46 236 C47 233 47 230 46 227' + // 발
  ' C46 200 47 166 49 138 L50 137' // 다리 안쪽선 → 가랑이

export default function FigureGuide() {
  return (
    <svg viewBox="0 0 100 240" className="block size-full" fill="none" stroke="#bdbdbd" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <g strokeWidth={1.2} vectorEffect="non-scaling-stroke">
        <ellipse cx={50} cy={24} rx={16} ry={20} vectorEffect="non-scaling-stroke" />
        <path d={HALF} vectorEffect="non-scaling-stroke" />
        <path d={HALF} transform="translate(100 0) scale(-1 1)" vectorEffect="non-scaling-stroke" />
      </g>
    </svg>
  )
}
