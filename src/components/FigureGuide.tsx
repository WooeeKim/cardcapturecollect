import guide from '../assets/proto/guide-dashed.svg'

// Trace-along figure outline, dashed (Figma 261119 수정 › drawing, Outline 1167:8479). Not saved into the drawing.
export default function FigureGuide() {
  return <img src={guide} alt="" draggable={false} className="block size-full object-contain" />
}
