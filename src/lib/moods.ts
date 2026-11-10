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

export const MOODS: Mood[] = [
  { name: 'Silent', color: '#8e8e8e', ink: '#ffffff', pace: 26, step: 1.1, word: '…' },
  { name: 'Calm', color: '#8fb39a', ink: '#ffffff', pace: 28, step: 1.2, word: 'hmm~' },
  { name: 'Sleepy', color: '#8ea6c9', ink: '#ffffff', pace: 36, step: 1.6, word: 'zzz' },
  { name: 'Gloomy', color: '#6c7a86', ink: '#ffffff', pace: 32, step: 1.4, word: 'sigh' },
  { name: 'Shy', color: '#e9a0af', ink: '#ffffff', pace: 24, step: 1, word: 'oh…' },
  { name: 'Dreamy', color: '#ae9bd3', ink: '#ffffff', pace: 30, step: 1.3, word: 'la la~' },
  { name: 'Chic', color: '#8c4a5b', ink: '#ffffff', pace: 20, step: 0.9, word: '' },
  { name: 'Joyful', color: '#edb443', ink: '#3a2a00', pace: 12, step: 0.55, word: 'yay!' },
  { name: 'Busy', color: '#e57b5f', ink: '#ffffff', pace: 10, step: 0.45, word: 'gotta go!' },
]

const FALLBACK: Mood = { name: '', color: '#8e8e8e', ink: '#ffffff', pace: 22, step: 1, word: '' }

export function moodOf(name: string): Mood {
  return MOODS.find((m) => m.name === name) ?? FALLBACK
}
