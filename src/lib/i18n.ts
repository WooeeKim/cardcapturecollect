import { useSyncExternalStore } from 'react'

// App language: English ↔ 한국어 (the globe button). Only words the app itself shows are
// translated; what people type (names, memos, town names) stays as written. Keys are the English text.
export type Lang = 'en' | 'ko'
const ORDER: Lang[] = ['en', 'ko']
const KEY = 'subwayseal.lang'

let lang: Lang = (() => {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'ko' ? v : 'en' // a saved 'ja' (Japanese was removed) falls back to English
  } catch {
    return 'en'
  }
})()
const listeners = new Set<() => void>()

function apply() {
  document.documentElement.lang = lang
}
apply()

export function cycleLang() {
  lang = ORDER[(ORDER.indexOf(lang) + 1) % ORDER.length]
  try {
    localStorage.setItem(KEY, lang)
  } catch {
    /* private mode */
  }
  apply()
  listeners.forEach((f) => f())
}

export function useLang() {
  return useSyncExternalStore(
    (f) => (listeners.add(f), () => listeners.delete(f)),
    () => lang,
  )
}

// tr('You can have up to {n} towns.', { n: 10 })
export function tr(en: string, vars?: Record<string, string | number>) {
  let s = (lang === 'en' ? undefined : DICT[en]) ?? en
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v))
  return s
}

// town names the app made itself ("Town 1", "New Town 3") follow the language; names people typed don't
export function townName(name: string) {
  const m = /^(New )?Town (\d+)$/.exec(name)
  return m ? tr(m[1] ? 'New Town {n}' : 'Town {n}', { n: m[2] }) : name
}

// English key → 한국어
const DICT: Record<string, string> = {
  // common
  'Got it!': '알겠어요!',
  Cancel: '취소',
  Delete: '삭제',
  Discard: '버리기',
  'Let go': '놓아주기',
  'Let this person go?': '이 사람을 놓아줄까요?',
  Save: '저장',
  Edit: '편집',
  Done: '완료',
  Back: '뒤로',
  Close: '닫기',
  Next: '다음',
  Previous: '이전',
  Skip: '건너뛰기',
  Start: '시작',
  Later: '나중에',
  Go: 'Go',
  'Coming Soon': '준비 중',
  'Do you really want to delete?': '정말 삭제할까요?',
  'Change language': '언어 바꾸기',
  'Sign up': '회원가입',
  'Allow notifications?\nWe’ll send you a little nudge now and then.': '알림을 허용할까요?\n가끔 살짝 알려 드릴게요.',
  'Not now': '나중에',
  'Allow': '허용',
  'Invite your\neye catcher!': '눈에 띈 사람을\n초대해 보세요!',
  'Ready to finish?\nYou won’t be able to edit this afterward.': '완성할까요?\n완성하면 다시 고칠 수 없어요.',

  // main / menu / card detail
  Menu: '메뉴',
  'Close menu': '메뉴 닫기',
  Collection: '콜렉션',
  'Town List': '마을 목록',
  'My page': '마이페이지',
  'My Page': '마이페이지',
  'Draw someone': '사람 그리기',
  Follow: '따라가기',
  Migration: '이사하기',
  'Show drawing only': '그림만 보기',

  // town list
  'Add town': '마을 추가',
  Create: '만들기',
  Send: '보내기',
  Reorder: '순서 바꾸기',
  'Town name': '마을 이름',
  'Town biography': '마을 소개',
  'Write your town biography.': '마을 소개를 적어 주세요.',
  'Go to {name}': '{name}(으)로 가기',
  'New Town {n}': '새 마을 {n}',
  'Town {n}': '마을 {n}',
  "There's unsaved changes.\nDo you wanna save?": '저장하지 않은 변경이 있어요.\n저장할까요?',
  'You cannot delete town with resident.': '주민이 있는 마을은 삭제할 수 없어요.',
  'You need at least one town.': '마을은 하나 이상 있어야 해요.',
  'You can have up to {n} towns.': '마을은 {n}개까지 만들 수 있어요.',
  'This person already lives here.': '이 사람은 이미 이 마을에 살아요.',
  'This town is full.': '이 마을은 꽉 찼어요.',

  // collection
  Newest: '최신순',
  Oldest: '오래된순',
  Head: '이장',
  'Someone': '누군가',
  ', head': ', 이장',
  'People in other towns show up here.': '다른 마을 사람들이 여기 보여요.',
  'This town is full. Drop them on someone to swap places.': '이 마을은 꽉 찼어요. 다른 사람 위에 놓으면 자리를 바꿔요.',

  // drawing
  'Discard this drawing?': '이 그림을 버릴까요?',
  'Draw at least one line first.': '먼저 선을 하나라도 그려 주세요.',
  'A few lines will do!': '선 몇 개면 충분해요!',
  Drawing: '그림',
  Memo: '메모',
  'Finish drawing': '그림 완성',
  Mood: '분위기',
  Place: '장소',
  'Where are you?': '어디에 있나요?',
  'Finding where you are…': '위치를 찾는 중…',
  Nickname: '닉네임',
  'Save the moment.': '이 순간을 남겨 보세요.',
  Pencil: '연필',
  Highlighter: '형광펜',
  Eraser: '지우개',
  Undo: '실행 취소',
  Redo: '다시 실행',
  Guide: '가이드',
  Color: '색',
  Colors: '색',
  'Size {n}': '굵기 {n}',
  'Fit drawing': '그림 맞추기',
  'Tap the drawing to pick a color': '그림을 눌러 색을 골라요',
  'Pick a color from the drawing': '그림에서 색 고르기',
  Opacity: '불투명도',
  Finish: '완성',
  'Go Back': '돌아가기',
  'Choose a village': '마을 고르기',

  // moods (names + the little words walkers say)
  Silent: '고요한',
  Joyful: '즐거운',
  Lively: '활기찬',
  Elegant: '우아한',
  Shy: '수줍은',
  Sleepy: '졸린',
  Busy: '바쁜',
  Scattered: '산만한',
  Gentle: '다정한',
  Calm: '차분한',
  Gloomy: '우울한',
  Dreamy: '몽환적인',
  Chic: '시크한',
  'yay!': '야호!',
  'hey!': '안녕!',
  zzz: '쿨쿨',
  'gotta go!': '바빠 바빠!',
  'uh…?': '어…?',
  'hmm~': '흠~',
  sigh: '휴',
  'la la~': '랄라~',
  '…': '…',

  // my page
  'Notification setting': '알림 설정',
  'Subway-TI': '길BTI',
  Notice: '공지사항',
  FAQ: '자주 묻는 질문',
  Feedback: '피드백',
  'Reset (test)': '초기화 (테스트)',
  'Canvas (test)': '캔버스 (테스트)',
  'Canvas: white': '캔버스: 흰 배경',
  'Canvas: cream paper': '캔버스: 미색 종이',
  'Canvas: fine paper': '캔버스: 고운 흰 종이',
  'Canvas: watercolor paper': '캔버스: 수채화지',
  'Canvas: grey paper': '캔버스: 회색 종이',
  'Canvas: lined notebook': '캔버스: 줄 노트',
  'Replay tutorial (test)': '튜토리얼 다시하기 (테스트)',
  'Loading screen (test)': '로딩 화면 보기 (테스트)',
  Reset: '초기화',
  Neighbors: '이웃',
  Developers: '만든 사람들',
  'Delete Account': '계정 삭제',
  'Notices are coming soon.': '공지사항은 곧 열려요.',
  'FAQ is coming soon.': '자주 묻는 질문은 곧 열려요.',
  "Delete your account, your towns and everyone in them?\nThis can't be undone.": '계정과 모든 마을, 마을 사람들을 삭제할까요?\n되돌릴 수 없어요.',
  "Reset all your towns and everyone in them?\nThis can't be undone.": '모든 마을과 마을 사람들을 초기화할까요?\n되돌릴 수 없어요.',
  'Log out?': '로그아웃할까요?',
  'Log out': '로그아웃',
  'Log in/Sign up': '로그인/회원가입',
  'No Profile': '프로필 없음',
  '{n} Person': '사람 {n}명',
  '{n} People': '사람 {n}명',
  '{n} Town': '마을 {n}개',
  '{n} Towns': '마을 {n}개',
  'Since {date}': '{date}부터',
  'Write your introduction...': '자기소개를 적어 주세요...',
  Introduction: '자기소개',
  'Change password': '비밀번호 바꾸기',
  'Edit profile': '프로필 편집',

  // login / sheets
  'Keep your town': '마을을 지켜요',
  'Log in': '로그인',
  'Log in to keep your town and its people in your account.': '로그인하면 마을과 마을 사람들이 계정에 저장돼요.',
  Email: '이메일',
  Password: '비밀번호',
  'Password ({n}+ characters)': '비밀번호 ({n}자 이상)',
  'The two passwords are different.': '두 비밀번호가 달라요.',
  'Password changed.': '비밀번호를 바꿨어요.',
  'Could not change password.': '비밀번호를 바꾸지 못했어요.',
  'Edit my info': '내 정보 수정',
  'New password': '새 비밀번호',
  'New password again': '새 비밀번호 확인',
  'Thanks! We read every note.': '고마워요! 하나하나 다 읽을게요.',
  'What was confusing, fun, or missing?': '헷갈렸던 점, 재밌었던 점, 아쉬운 점이 있나요?',
  'The name you go by in the app.': '앱에서 쓰는 이름이에요.',
  'This email already has an account.': '이미 가입된 이메일이에요.',
  'Check your email and open the link, then log in.': '메일함의 링크를 연 다음 로그인해 주세요.',
  'Open the link in your email first, then log in.': '먼저 메일의 링크를 열고 로그인해 주세요.',
  'Wrong email or password.': '이메일이나 비밀번호가 틀렸어요.',
  'Password needs at least {n} characters.': '비밀번호는 {n}자 이상이어야 해요.',

  // app-wide messages
  "Couldn't reach your account. Your town stays on this device — try again in a moment.": '계정에 연결하지 못했어요. 마을은 이 기기에 그대로 있어요. 잠시 후 다시 해 주세요.',
  "Couldn't save your guest town to the account yet. It will be added the next time you log in.": '게스트 마을을 아직 계정에 저장하지 못했어요. 다음에 로그인할 때 추가돼요.',
  'Storage is full. Let a few people go to make room for new ones.': '저장 공간이 가득 찼어요. 몇 명을 놓아주면 새로운 사람을 데려올 수 있어요.',
  "{n} person didn't fit in your towns.": '{n}명이 마을에 들어가지 못했어요.',
  "{n} people didn't fit in your towns.": '{n}명이 마을에 들어가지 못했어요.',

  // Subway-TI (길BTI)
  'Before you start': '시작하기 전에',
  'A few quick questions about how you ride, watch and record.': '지하철을 타고, 사람을 보고, 기록하는 방식에 대해 몇 가지만 물어볼게요.',
  'About 2 minutes.': '2분 정도 걸려요.',
  'Only our team sees your answers. They help us understand who uses the app.': '답변은 우리 팀만 봐요. 앱을 쓰는 사람을 이해하는 데 써요.',
  'Your Subway-TI': '나의 길BTI',
  'Pick all that fit': '해당하는 것을 모두 골라요',
  'Likes observing': '관찰 좋아함',
  'Not into it': '관심 없음',
  'Likes recording': '기록 좋아함',
  'Not into recording': '기록 관심 없음',
  'About you': '나에 대해',
  Riding: '타는 습관',
  Observing: '관찰',
  Recording: '기록',
  'What should we call you?': '뭐라고 부를까요?',
  'How old are you?': '나이가 어떻게 되나요?',
  'Under 20': '20세 미만',
  '20s': '20대',
  '30s': '30대',
  '40s': '40대',
  '50+': '50대 이상',
  'How often do you ride the subway?': '지하철을 얼마나 자주 타나요?',
  'Every day': '매일',
  'A few times a week': '일주일에 몇 번',
  'A few times a month': '한 달에 몇 번',
  Rarely: '거의 안 타요',
  'When do you usually ride?': '주로 언제 타나요?',
  'Morning commute': '아침 출근길',
  Daytime: '낮',
  'Evening commute': '저녁 퇴근길',
  'Late night': '늦은 밤',
  Weekends: '주말',
  'How long is a usual ride?': '보통 얼마나 타나요?',
  'Under 15 min': '15분 미만',
  '15–30 min': '15–30분',
  '30–60 min': '30–60분',
  'Over an hour': '1시간 넘게',
  'Do you enjoy watching the people around you?': '주변 사람들을 구경하는 걸 좋아하나요?',
  'Not at all': '전혀 아니에요',
  'Love it': '정말 좋아요',
  'What do you mostly notice?': '주로 무엇이 눈에 들어오나요?',
  'Outfits & style': '옷차림과 스타일',
  'Faces & expressions': '얼굴과 표정',
  "What they're doing": '하고 있는 일',
  Conversations: '대화',
  'Things they carry': '들고 있는 물건',
  "I don't really look": '잘 안 봐요',
  'Has watching someone ever changed your day?': '누군가를 관찰하는 일이 그 날을 바꾼 적이 있나요?',
  Never: '없어요',
  'Once or twice': '한두 번',
  Sometimes: '가끔',
  Often: '자주',
  'Do you enjoy recording things — photos, notes, drawings?': '사진, 메모, 그림처럼 무언가를 기록하는 걸 좋아하나요?',
  'Why, or why not?': '그 이유는요?',
  'A line or two is plenty': '한두 줄이면 충분해요',
  'What do you mostly record?': '주로 무엇을 기록하나요?',
  Photos: '사진',
  'Notes & diary': '메모와 일기',
  Drawings: '그림',
  Videos: '영상',
  'Social media posts': 'SNS 게시물',
  'Telling friends about it': '친구에게 이야기하기',
  'Not much': '별로 안 해요',
  'Enjoys both': '둘 다 좋아함',
  'Recording only': '기록만 좋아함',
  'Observing only': '관찰만 좋아함',
  'Interested in neither': '둘 다 관심 없음',
  'You notice people and like keeping what you saw.': '사람을 눈여겨보고, 본 것을 간직하는 걸 좋아해요.',
  "People aren't your thing to watch, but you love keeping things.": '사람 구경엔 관심 없지만, 무언가를 간직하는 건 좋아해요.',
  'You notice everyone around you, and let the moment pass.': '주변 사람을 모두 눈여겨보지만, 그 순간은 흘려보내요.',
  'You ride in your own world. Maybe someone will catch your eye.': '나만의 세계에서 지하철을 타요. 언젠가 누군가 눈에 들어올지도요.',
  // onboarding (OnboardingScreens.tsx, DrawScreen tips, My Page profile picture)
  'Welcome to': '어서 오세요',
  'Draw the people you notice on the subway, and invite them to your town.': '지하철에서 눈에 들어온 사람을 그려서 내 마을에 초대해요.',
  'New here? Sign up. Already have an account? Log in.': '처음이면 회원가입, 계정이 있으면 로그인하세요.',
  'Shown in your towns and on My Page. You can change it later.': '마을과 마이페이지에 보여요. 나중에 바꿀 수 있어요.',
  'Start by drawing yourself today! Follow the grey guide. A few lines will do.': '먼저 오늘의 나를 그려봐요! 회색 가이드를 따라 몇 줄이면 충분해요.',
  'Pencil, highlighter and eraser, with undo and redo next to them. Tap the picked pencil again to change its thickness.': '연필, 형광펜, 지우개예요. 옆에는 되돌리기와 다시하기가 있어요. 고른 연필을 한 번 더 눌러 굵기를 바꿔봐요.',
  'Pick a thickness.': '굵기를 골라요.',
  'Tap the wheel to change the color.': '동그라미를 눌러 색을 바꿔봐요.',
  'Choose a color, then close the panel.': '색을 고른 뒤 창을 닫아요.',
  'Tap to turn the dotted guide off or on.': '눌러서 점선 가이드를 끄고 켜요.',
  'Two fingers zoom, tilt and move the card. Try it!': '두 손가락으로 카드를 확대하고, 기울이고, 옮길 수 있어요. 해봐요!',
  'Tap here to put the card back to its normal size.': '여기를 누르면 카드가 원래 크기로 돌아와요.',
  'Now open Memo.': '이제 메모를 열어요.',
  'Add their mood, where you are, a name and a line about them.': '분위기, 지금 있는 곳, 이름, 한 줄을 적어요.',
  'Skip tutorial': '튜토리얼 건너뛰기',
  'Done? Tap ✓ to see your card.': '다 그렸으면 ✓를 눌러 카드를 확인해봐요.',
  "That's your card! Now tap Go Back and finish it on your own. This first drawing of you becomes your profile picture (change it on My Page).": '이게 내 카드예요! 이제 돌아가기를 눌러 직접 카드를 완성해보세요. 처음 그린 내가 프로필 사진이 돼요 (마이페이지에서 변경 가능).',
  'Change profile picture': '프로필 사진 바꾸기',
  Change: '변경',
  'Profile picture': '프로필 사진',
  'Pick one of your people.': '내 마을 사람 중 한 명을 골라요.',
  // daily 8 p.m. interview (components/InterviewOverlay.tsx)
  'It’s 8p.m.': '저녁 8시,',
  'Interview Time!': '인터뷰 시간이에요!',
  'Why didn’t you draw today?': '오늘은 왜 아무도 안 그렸나요?',
  'In what situation did you collect?': '어떤 상황에서 수집했나요?',
  'Who did you collect, and why?': '누구를, 왜 수집했나요?',
  'How did you feel\nwhile collecting them?': '수집하는 동안\n기분이 어땠나요?',
  Interested: '흥미로웠어요',
  Excited: '신났어요',
  Bored: '지루했어요',
  Indifferent: '그저 그랬어요',
  'Anything else to tell us? (thoughts, ideas to improve)': '또 해줄 말이 있나요? (느낀 점, 개선 점)',
}
