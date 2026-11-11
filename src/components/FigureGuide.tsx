import guide from '../assets/proto/guide.png'

// Trace-along figure outline, exported from Figma (wireframe 그리기 "Outline"). Not saved into the drawing.
export default function FigureGuide() {
  return <img src={guide} alt="" draggable={false} className="block size-full object-contain" />
}
