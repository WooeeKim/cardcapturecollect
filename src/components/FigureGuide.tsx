// 따라 그리기용 사람 실루엣 (트레이싱 가이드). 저장 이미지에는 들어가지 않는다.
// 머리가 큰 캐릭터 비율(약 5등신)이고, 얼굴은 비워 둔다.
// 왼쪽 반만 그리고 좌우 반전해 대칭을 맞춘다.
const HALF =
  'M45 31 L45 37' + // 목
  ' C38 38 32 39 30 43' + // 어깨
  ' C28 50 23 66 19 83' + // 팔 바깥선 → 손목
  ' C16 87 15 93 17 97 C19 100 23 99 24 95 C25 91 25 88 24 84' + // 손
  ' C27 70 31 58 34 50' + // 팔 안쪽선 → 겨드랑이
  ' C35 62 34 74 34 84' + // 몸통 옆선
  ' C34 105 35 128 37 144' + // 다리 바깥선
  ' C33 147 33 151 38 151 L46 151 C47 148 47 146 46 144' + // 발
  ' C47 128 48 108 50 97' // 다리 안쪽선 → 가랑이

export default function FigureGuide() {
  return (
    <svg viewBox="0 0 100 155" className="block size-full" fill="none" stroke="#bdbdbd" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <g strokeWidth={1.2} vectorEffect="non-scaling-stroke">
        <ellipse cx={50} cy={18} rx={13} ry={15} vectorEffect="non-scaling-stroke" />
        <path d={HALF} vectorEffect="non-scaling-stroke" />
        <path d={HALF} transform="translate(100 0) scale(-1 1)" vectorEffect="non-scaling-stroke" />
      </g>
    </svg>
  )
}
