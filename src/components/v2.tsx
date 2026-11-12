// Hand-drawn pieces from the new Figma GUI (prototyping section, Collection 725:* / drawing 705:*, 719:*, 745:694).
// SVGs are the Figma exports, unchanged except for the current color where noted.
import pen from '../assets/proto/v2/pen.svg?raw'
import highlighter from '../assets/proto/v2/highlighter.svg?raw'
import eraser from '../assets/proto/v2/eraser.svg?raw'
import undo from '../assets/proto/v2/undo.svg?raw'
import redo from '../assets/proto/v2/redo.svg?raw'
import wheel from '../assets/proto/v2/color-wheel.svg?raw'
import chipOn from '../assets/proto/v2/chip-on.svg?raw'
import chipA from '../assets/proto/v2/chip-a.svg?raw'
import chipB from '../assets/proto/v2/chip-b.svg?raw'
import sizeBubble from '../assets/proto/v2/size-bubble.svg?raw'
import confirmBubble from '../assets/proto/v2/confirm-bubble.svg?raw'
import pillFinish from '../assets/proto/v2/pill-finish.svg?raw'
import pillBack from '../assets/proto/v2/pill-back.svg?raw'
import pillVillage from '../assets/proto/v2/pill-village.svg?raw'

// Figma exports carry fixed width/height; make them fill the box instead.
const fit = (svg: string) => svg.replace(/width="[\d.]+" height="[\d.]+"/, 'width="100%" height="100%"').replace('style="display: block;"', 'style="display:block;overflow:visible"')

function Raw({ svg, className = '' }: { svg: string; className?: string }) {
  return <span aria-hidden className={`block size-full ${className}`} dangerouslySetInnerHTML={{ __html: fit(svg) }} />
}

// paints one path (by Figma layer id) with the current color
const paint = (svg: string, id: string, attr: 'fill' | 'stroke', color: string) =>
  svg.replace(new RegExp(`(<path id="${id}"[^>]*?)${attr}="[^"]*"`), `$1${attr}="${color}"`).replace(new RegExp(`(<path id="${id}")(?![^>]*${attr}=)`), `$1 ${attr}="${color}"`)

export const PenV2 = ({ color }: { color: string }) => <Raw svg={paint(pen, 'Vector 29', 'fill', color)} />
export const HighlighterV2 = ({ color }: { color: string }) => <Raw svg={paint(highlighter, 'Vector 78', 'fill', color)} />
export const EraserV2 = () => <Raw svg={eraser} />
// Figma exports these grey (= nothing to undo / redo); dark when there is
const ink = (svg: string, on: boolean) => (on ? svg.replaceAll('stroke="#B3B3B3"', 'stroke="black"') : svg)
export const UndoV2 = ({ on }: { on: boolean }) => <Raw svg={ink(undo, on)} />
export const RedoV2 = ({ on }: { on: boolean }) => <Raw svg={ink(redo, on)} />
export const ColorWheelV2 = ({ color }: { color: string }) => <Raw svg={paint(wheel, 'Vector 40', 'stroke', color)} />
export const SizeBubbleV2 = () => <Raw svg={sizeBubble.replace(/<path id="Vector (3[5-9])"[^>]*\/>/g, '')} />
export const ConfirmBubble = () => <Raw svg={confirmBubble} />
export const PillFinish = () => <Raw svg={pillFinish} />
export const PillBack = () => <Raw svg={pillBack} />
export const PillVillage = () => <Raw svg={pillVillage} />

// mood chip outline: selected = filled dark, others = light (two hand-drawn variants alternate)
export function ChipShape({ on, i }: { on: boolean; i: number }) {
  return <Raw svg={on ? chipOn : i % 3 === 1 ? chipA : chipB} />
}
