import { supabase, type User } from './auth'
import { deviceId } from './gilbti'

// Day-7 post-test interview (the "7일차 사후 인터뷰" Google Form, in the app). Opens on 11/22 at 22:00 right after that
// day's 10 p.m. interview, and stays until answered (till the end of November). Same memo-sheet look as the
// 10 p.m. interview (components/FinalInterviewOverlay.tsx). Answers: this device first, then Supabase table
// final_interviews (supabase/migrations/017_final_interview.sql); a failed send is retried on the next start.
// The Form's first question (nickname) is left out: the app knows who is answering.

export const FINAL_DAY = '2026-11-22'
const FROM = new Date(2026, 10, 22, 22) // 11/22 22:00, phone's local time
const UNTIL = new Date(2026, 11, 1) // 12/1 00:00
export const finalOpen = (now = new Date()) => now >= FROM && now < UNTIL

type Text = { ko: string; en: string }
export type FinalAnswers = Record<string, string | string[]>
export type FinalQuestion = {
  id: string
  kind: 'short' | 'long' | 'one' | 'many' | 'card'
  prompt: Text
  choices?: Text[] // saved as the Korean label, whatever the app language
  other?: boolean // "기타" with a text field (one / many)
  optional?: boolean
  when?: (a: FinalAnswers) => boolean // only asked when this is true (a follow-up of the question before it)
}
// card: pick one of your own cards (saved as "<name> (<serial label>)", the card id in `<id>_card`)

const t = (ko: string, en: string): Text => ({ ko, en })
const YES = t('예', 'Yes')
const NO = t('아니오', 'No')
const yes = (id: string) => (a: FinalAnswers) => a[id] === '예'
const no = (id: string) => (a: FinalAnswers) => a[id] === '아니오'

export const FINAL_QUESTIONS: FinalQuestion[] = [
  // 1 — on the move? yes → how it felt; no → where/when then
  { id: 'commute_used', kind: 'one', prompt: t('주로 이동 시간에 앱을 사용했나요?', 'Did you mostly use the app while on the move?'), choices: [YES, NO] },
  {
    id: 'commute_feel',
    kind: 'many',
    other: true,
    when: yes('commute_used'),
    prompt: t('그 이동 시간이 어떻게 느껴졌나요?\n(해당하는 것 모두)', 'How did that time feel?\n(pick all that apply)'),
    choices: [t('짧게 느껴졌다', 'It felt short'), t('길게 느껴졌다', 'It felt long'), t('재밌었다', 'It was fun'), t('지루했다', 'It was boring'), t('시간에 쫓겼다', 'I was in a rush'), t('하다가 껐다', 'I closed it halfway')],
  },
  {
    id: 'used_where',
    kind: 'one',
    other: true,
    when: no('commute_used'),
    prompt: t('그럼 주로 언제 사용했나요?', 'Then when did you mostly use it?'),
    choices: [t('버스', 'On the bus'), t('카페', 'At a cafe'), t('길거리', 'On the street'), t('도서관', 'At the library'), t('학교', 'At school')],
  },
  // 2, 3 — pick from your own cards
  { id: 'memorable', kind: 'card', prompt: t('제일 기억에 남는 주민을 골라주세요.', 'Pick the resident you remember most.') },
  { id: 'memorable_why', kind: 'long', when: (a) => !!a.memorable, prompt: t('방금 그 주민을 고른 이유는?', 'Why did you pick them?') },
  { id: 'favorite', kind: 'card', prompt: t('7일 동안의 최애 주민을 골라주세요.', 'Pick your favorite resident of the 7 days.') },
  { id: 'favorite_why', kind: 'long', when: (a) => !!a.favorite, prompt: t('최애로 고른 이유는?', 'Why are they your favorite?') },
  {
    id: 'fun',
    kind: 'many',
    prompt: t('앱을 쓰면서 재미있었던 것을\n모두 골라주세요.', 'What was fun in the app?\n(pick all)'),
    choices: [
      t('그리기', 'Drawing'),
      t('메모 쓰기', 'Writing the memo'),
      t('주민들이 돌아다니는 것 관찰하기', 'Watching residents walk around'),
      t('주민들이 말하는 것 보기', 'Seeing residents talk'),
      t('마을 이사하기 (내 입맛대로 분류하기)', 'Moving towns (sorting my way)'),
      t('콜렉션 보기 (콜멍)', 'Looking at my collection'),
    ],
  },
  { id: 'fun_why', kind: 'long', when: (a) => Array.isArray(a.fun) && a.fun.length > 0, prompt: t('위에서 고른 것들이\n재미있었던 이유는 무엇인가요?', 'Why were those fun?') },
  {
    id: 'wanted',
    kind: 'many',
    prompt: t('업데이트되면 좋겠는 기능을\n모두 골라주세요.', 'Which updates would you like?\n(pick all)'),
    choices: [
      t('주민 컨테스트', 'Resident contest'),
      t('다른 브러시·그리기 도구 추가', 'More brushes and drawing tools'),
      t('마을 꾸미기', 'Decorating towns'),
      t('주민끼리의 관계 형성', 'Residents forming relationships'),
      t('다른 사람 마을 놀러가기', "Visiting other people's towns"),
      t('친구 마을 만들기 (방 만들기)', "Making a friends' town (rooms)"),
    ],
  },
  { id: 'wanted_more', kind: 'long', optional: true, prompt: t('그 외에 추가되면 좋겠는 기능이\n있다면 써주세요.', 'Any other feature you’d like?') },
  { id: 'new_interest', kind: 'long', prompt: t('앱을 쓰면서 새롭게 알게 된 관심사나\n‘나’에 대해 알게 된 점이 있나요?', 'Did you find a new interest, or something\nnew about yourself?') },
  { id: 'observed', kind: 'long', prompt: t('관찰할 때 무엇을 주로 봤나요?\n그 사이에 공통점이 있나요?', 'What did you mostly look at?\nAnything in common?') },
  // yes/no first, the follow-up only on yes
  { id: 'let_go_used', kind: 'one', prompt: t('주민을 놓아준 적이 있나요?', 'Did you ever let a resident go?'), choices: [YES, NO] },
  { id: 'let_go', kind: 'long', when: yes('let_go_used'), prompt: t('주민을 놓아줄 때\n기분이 어땠나요?', 'How did it feel\nto let a resident go?') },
  { id: 'followed', kind: 'one', prompt: t('따라가기 기능을 써봤나요?', 'Did you try following a resident?'), choices: [YES, NO] },
  { id: 'follow_why', kind: 'long', when: yes('followed'), prompt: t('왜 따라가 봤나요?\n기분은 어땠나요?', 'Why did you follow them?\nHow did it feel?') },
  { id: 'moved', kind: 'one', prompt: t('주민을 다른 마을로 이사시켜 본 적이 있나요?', 'Did you ever move a resident to another town?'), choices: [YES, NO] },
  { id: 'moved_why', kind: 'long', when: yes('moved'), prompt: t('왜 옮겼나요?', 'Why did you move them?') },
  {
    id: 'imagined_vs_real',
    kind: 'one',
    prompt: t('상상해서 그린 것과 실제로 보고 그린 것 중\n뭐가 더 재밌었나요?', 'Which was more fun: drawing from\nimagination, or from life?'),
    choices: [t('상상해서 그린 것', 'From imagination'), t('실제로 보고 그린 것', 'From life'), t('비슷했다', 'About the same'), t('둘 중 하나만 해봤다', 'I only tried one')],
  },
  { id: 'imagined_why', kind: 'long', optional: true, when: (a) => !!a.imagined_vs_real, prompt: t('그렇게 생각한 이유는?', 'Why?') },
]

export const OTHER = '기타'

// asked with the answers so far
export const askedQuestions = (a: FinalAnswers) => FINAL_QUESTIONS.filter((q) => !q.when || q.when(a))

// "3", or "3-1" for a follow-up of question 3 (follow-ups = questions with `when`), counting only the asked ones
export function numberOf(q: FinalQuestion, asked: FinalQuestion[] = FINAL_QUESTIONS) {
  let n = 0
  let sub = 0
  for (const x of asked) {
    if (x.when) sub++
    else {
      n++
      sub = 0
    }
    if (x === q) return x.when ? `${n}-${sub}` : String(n)
  }
  return ''
}
export const MAIN_COUNT = FINAL_QUESTIONS.filter((q) => !q.when).length

// answered enough to go on? (optional ones always can)
export function done(q: FinalQuestion, a: FinalAnswers) {
  if (q.optional) return true
  const v = a[q.id]
  const other = String(a[`${q.id}_other`] ?? '').trim()
  if (q.kind === 'many') {
    const list = Array.isArray(v) ? v : []
    if (list.includes(OTHER) && !other) return false
    return list.length > 0
  }
  if (q.kind === 'one' && v === OTHER) return !!other
  return typeof v === 'string' && v.trim() !== ''
}

// ---------- this device ----------

type Saved = { answers: FinalAnswers; at: string; sent: boolean; user: string | null }
const KEY = 'subwayseal.finalInterview'

function readAll(): Saved[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]')
  } catch {
    return []
  }
}
function writeAll(list: Saved[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    /* private mode */
  }
}

// ---------- server ----------

async function send(s: Saved, user: User | null, nickname: string) {
  if (!supabase) return true
  const { error } = await supabase.from('final_interviews').insert({
    answers: s.answers,
    user_id: user?.id ?? null,
    email: user?.username.toLowerCase() ?? null,
    nickname: nickname || null,
    device_id: deviceId(),
    created_at: s.at,
  })
  if (error) console.warn('final_interviews save failed (run supabase/migrations/017_final_interview.sql?)', error.message)
  return !error
}

export async function finalAnswered(user: User | null): Promise<boolean> {
  const who = user?.id ?? null
  if (readAll().some((s) => s.user === who)) return true
  if (!supabase || !user) return false
  const { data, error } = await supabase.from('final_interviews').select('id').eq('user_id', user.id).limit(1)
  if (error) {
    console.warn('final_interviews read failed (run supabase/migrations/017_final_interview.sql?)', error.message)
    return false
  }
  return !!data?.length
}

export async function submitFinal(user: User | null, nickname: string, answers: FinalAnswers) {
  const s: Saved = { answers, at: new Date().toISOString(), sent: false, user: user?.id ?? null }
  writeAll([...readAll(), s])
  if (await send(s, user, nickname)) writeAll(readAll().map((x) => (x.at === s.at ? { ...x, sent: true } : x)))
}

export async function resendFinal(user: User | null, nickname: string) {
  for (const s of readAll()) {
    if (s.sent || s.user !== (user?.id ?? null)) continue
    if (await send(s, user, nickname)) writeAll(readAll().map((x) => (x.at === s.at ? { ...x, sent: true } : x)))
  }
}
