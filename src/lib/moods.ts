// 9 moods: spread across energy (low ↔ high) and feeling (heavy ↔ light) so they rarely overlap.
// Colors are muted to sit on the grey wireframe look; each hue follows its mood.
export type Mood = {
  name: string
  color: string
  ink: string // chip text color
  pace: number // seconds to cross ~600px
  step: number // seconds per bob
  word: string // speech bubble while walking ('' = none)
}

// Figma Memo tab order (3×3). Same words as before keep their color + pace.
export const MOODS: Mood[] = [
  { name: 'Silent', color: '#8e8e8e', ink: '#ffffff', pace: 26, step: 1.1, word: '…' },
  { name: 'Joyful', color: '#edb443', ink: '#3a2a00', pace: 12, step: 0.55, word: 'yay!' },
  { name: 'Lively', color: '#6fbf73', ink: '#ffffff', pace: 14, step: 0.6, word: 'hey!' },
  { name: 'Elegant', color: '#8c4a5b', ink: '#ffffff', pace: 22, step: 1, word: '' },
  { name: 'Shy', color: '#e9a0af', ink: '#ffffff', pace: 24, step: 1, word: 'oh…' },
  { name: 'Sleepy', color: '#8ea6c9', ink: '#ffffff', pace: 36, step: 1.6, word: 'zzz' },
  { name: 'Busy', color: '#e57b5f', ink: '#ffffff', pace: 10, step: 0.45, word: 'gotta go!' },
  { name: 'Scattered', color: '#ae9bd3', ink: '#ffffff', pace: 16, step: 0.7, word: 'uh…?' },
  { name: 'Gentle', color: '#8fb39a', ink: '#ffffff', pace: 28, step: 1.2, word: 'hmm~' },
]

// words from older cards: still shown with their old color/pace
const OLD: Mood[] = [
  { name: 'Calm', color: '#8fb39a', ink: '#ffffff', pace: 28, step: 1.2, word: 'hmm~' },
  { name: 'Gloomy', color: '#6c7a86', ink: '#ffffff', pace: 32, step: 1.4, word: 'sigh' },
  { name: 'Dreamy', color: '#ae9bd3', ink: '#ffffff', pace: 30, step: 1.3, word: 'la la~' },
  { name: 'Chic', color: '#8c4a5b', ink: '#ffffff', pace: 20, step: 0.9, word: '' },
]

const FALLBACK: Mood = { name: '', color: '#8e8e8e', ink: '#ffffff', pace: 22, step: 1, word: '' }

export function moodOf(name: string): Mood {
  return MOODS.find((m) => m.name === name) ?? OLD.find((m) => m.name === name) ?? FALLBACK
}

// what each mood says while being carried around (picked up in the town); English keys, Korean in i18n.ts
const HELD_LINES: Record<string, string[]> = {
  Silent: ['…!', '……', '(gulp)'],
  Joyful: ['Wheee~!', 'Higher!', 'Hehehe'],
  Lively: ['Whoa, fun!', 'Again!', "So high!"],
  Elegant: ['How rude.', 'Put me down, please.', "You'll crease my outfit."],
  Chic: ['How rude.', 'Put me down, please.', "You'll crease my outfit."],
  Shy: ['Um, excuse me…', "Don't look…", 'So embarrassing…'],
  Sleepy: ['Mm… five more minutes…', "I'm dizzy… zzz", '…snore'],
  Busy: ["I'm busy, put me down!", "I'm late!", "I'll miss my train!"],
  Scattered: ['Huh? Where am I?', 'What? What?', 'Where are we going?'],
  Dreamy: ['Huh? Where am I?', "I'm flying~", 'Where are we going?'],
  Gentle: ['Gently, please~', "It's okay~", 'Slowly~'],
  Calm: ['Gently, please~', "It's okay~", 'Slowly~'],
  Gloomy: ['…why me', 'Sigh…', 'Just put me down'],
}
const HELD_DEFAULT = ['Put me down!', 'Aaah!']

export function heldLines(name: string): string[] {
  return HELD_LINES[name] ?? HELD_DEFAULT
}

// what shows around the head while being carried, matching the lines above (MainScreen FX)
export type HeldFx = 'notes' | 'sparkle' | 'sweat' | 'anger' | 'blush' | 'zzz' | 'dizzy' | 'hearts' | 'shock' | 'cloud'
const HELD_FX: Record<string, HeldFx> = {
  Joyful: 'notes',
  Lively: 'sparkle',
  Busy: 'sweat',
  Elegant: 'anger',
  Chic: 'anger',
  Shy: 'blush',
  Sleepy: 'zzz',
  Scattered: 'dizzy',
  Dreamy: 'dizzy',
  Gentle: 'hearts',
  Calm: 'hearts',
  Silent: 'shock',
  Gloomy: 'cloud',
}
export function heldFx(name: string): HeldFx {
  return HELD_FX[name] ?? 'sweat'
}
