import { useSyncExternalStore } from 'react'

// App language: English → 한국어 → 日本語 → English (the globe button). Only words the app itself shows are
// translated; what people type (names, memos, town names) stays as written. Keys are the English text.
export type Lang = 'en' | 'ko' | 'ja'
const ORDER: Lang[] = ['en', 'ko', 'ja']
const KEY = 'subwayseal.lang'

let lang: Lang = (() => {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'ko' || v === 'ja' ? v : 'en'
  } catch {
    return 'en'
  }
})()
const listeners = new Set<() => void>()

function apply() {
  document.documentElement.lang = lang
  document.documentElement.dataset.lang = lang // Japanese switches to the Hachi Maru Pop font (index.css)
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
  let s = (lang === 'en' ? undefined : DICT[en]?.[lang === 'ko' ? 0 : 1]) ?? en
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v))
  return s
}

// town names the app made itself ("Town 1", "New Town 3") follow the language; names people typed don't
export function townName(name: string) {
  const m = /^(New )?Town (\d+)$/.exec(name)
  return m ? tr(m[1] ? 'New Town {n}' : 'Town {n}', { n: m[2] }) : name
}

// [한국어, 日本語]
const DICT: Record<string, [string, string]> = {
  // common
  'Got it!': ['알겠어요!', 'わかった!'],
  Cancel: ['취소', 'キャンセル'],
  Delete: ['삭제', '削除'],
  Discard: ['버리기', '捨てる'],
  'Let go': ['놓아주기', '見送る'],
  'Let this person go?': ['이 사람을 놓아줄까요?', 'この人を見送りますか?'],
  Save: ['저장', '保存'],
  Edit: ['편집', '編集'],
  Done: ['완료', '完了'],
  Back: ['뒤로', '戻る'],
  Close: ['닫기', '閉じる'],
  Next: ['다음', '次へ'],
  Previous: ['이전', '前へ'],
  Skip: ['건너뛰기', 'スキップ'],
  Start: ['시작', 'スタート'],
  Later: ['나중에', 'あとで'],
  Go: ['Go', 'Go'],
  'Coming Soon': ['준비 중', '準備中'],
  'Do you really want to delete?': ['정말 삭제할까요?', '本当に削除しますか?'],
  'Change language': ['언어 바꾸기', '言語を変える'],
  'Sign up': ['회원가입', '新規登録'],
  'Allow notifications?\nWe’ll send you a little nudge now and then.': ['알림을 허용할까요?\n가끔 살짝 알려 드릴게요.', '通知を許可しますか?\nときどき、そっとお知らせします。'],
  'Not now': ['나중에', 'あとで'],
  'Allow': ['허용', '許可'],
  'Invite your\neye catcher!': ['눈에 띈 사람을\n초대해 보세요!', '気になった人を\n招待しよう!'],
  'Ready to finish?\nYou won’t be able to edit this afterward.': ['완성할까요?\n완성하면 다시 고칠 수 없어요.', '完成にしますか?\nあとから直せません。'],

  // main / menu / card detail
  Menu: ['메뉴', 'メニュー'],
  'Close menu': ['메뉴 닫기', 'メニューを閉じる'],
  Collection: ['콜렉션', 'コレクション'],
  'Town list': ['마을 목록', '町リスト'],
  'Town List': ['마을 목록', '町リスト'],
  'My page': ['마이페이지', 'マイページ'],
  'My Page': ['마이페이지', 'マイページ'],
  'Draw someone': ['사람 그리기', '人を描く'],
  Follow: ['따라가기', 'ついていく'],
  Migration: ['이사하기', '引っ越し'],
  'Show drawing only': ['그림만 보기', '絵だけ見る'],

  // town list
  'Add town': ['마을 추가', '町を追加'],
  Create: ['만들기', '作る'],
  Send: ['보내기', '送る'],
  Reorder: ['순서 바꾸기', '並べ替え'],
  'Town name': ['마을 이름', '町の名前'],
  'Town biography': ['마을 소개', '町の紹介'],
  'Write your town biography.': ['마을 소개를 적어 주세요.', '町の紹介を書いてね。'],
  'Go to {name}': ['{name}(으)로 가기', '{name}へ行く'],
  'New Town {n}': ['새 마을 {n}', '新しい町 {n}'],
  'Town {n}': ['마을 {n}', '町 {n}'],
  "There's unsaved changes.\nDo you wanna save?": ['저장하지 않은 변경이 있어요.\n저장할까요?', '保存していない変更があります。\n保存しますか?'],
  'You cannot delete town with resident.': ['주민이 있는 마을은 삭제할 수 없어요.', '住民がいる町は削除できません。'],
  'You need at least one town.': ['마을은 하나 이상 있어야 해요.', '町は少なくとも一つ必要です。'],
  'You can have up to {n} towns.': ['마을은 {n}개까지 만들 수 있어요.', '町は{n}個まで作れます。'],
  'This person already lives here.': ['이 사람은 이미 이 마을에 살아요.', 'この人はもうこの町に住んでいます。'],
  'This town is full.': ['이 마을은 꽉 찼어요.', 'この町はいっぱいです。'],

  // collection
  Newest: ['최신순', '新しい順'],
  Oldest: ['오래된순', '古い順'],
  Head: ['대표', '代表'],
  'Someone': ['누군가', 'だれか'],
  ', head': [', 대표', '、代表'],
  'People in other towns show up here.': ['다른 마을 사람들이 여기 보여요.', 'ほかの町の人たちがここに出ます。'],
  'This town is full. Drop them on someone to swap places.': ['이 마을은 꽉 찼어요. 다른 사람 위에 놓으면 자리를 바꿔요.', 'この町はいっぱいです。ほかの人の上に置くと入れ替わります。'],

  // drawing
  'Discard this drawing?': ['이 그림을 버릴까요?', 'この絵を捨てますか?'],
  'Draw at least one line first.': ['먼저 선을 하나라도 그려 주세요.', 'まず線を一本でも描いてね。'],
  'A few lines will do!': ['선 몇 개면 충분해요!', '線を少し描くだけでOK!'],
  Drawing: ['그림', '絵'],
  Memo: ['메모', 'メモ'],
  'Finish drawing': ['그림 완성', '絵を仕上げる'],
  Mood: ['분위기', '雰囲気'],
  Place: ['장소', '場所'],
  'Where are you?': ['어디에 있나요?', 'どこにいる?'],
  'Finding where you are…': ['위치를 찾는 중…', '場所をさがし中…'],
  Nickname: ['닉네임', 'ニックネーム'],
  'Save the moment.': ['이 순간을 남겨 보세요.', 'この瞬間を残そう。'],
  Pencil: ['연필', 'えんぴつ'],
  Highlighter: ['형광펜', '蛍光ペン'],
  Eraser: ['지우개', '消しゴム'],
  Undo: ['실행 취소', '元に戻す'],
  Redo: ['다시 실행', 'やり直す'],
  Guide: ['가이드', 'ガイド'],
  Color: ['색', '色'],
  Colors: ['색', '色'],
  'Size {n}': ['굵기 {n}', '太さ {n}'],
  'Fit drawing': ['그림 맞추기', '絵を合わせる'],
  'Tap the drawing to pick a color': ['그림을 눌러 색을 골라요', '絵をタップして色を選んでね'],
  'Pick a color from the drawing': ['그림에서 색 고르기', '絵から色を選ぶ'],
  Opacity: ['불투명도', '不透明度'],
  Finish: ['완성', '完成'],
  'Go Back': ['돌아가기', '戻る'],
  'Choose a village': ['마을 고르기', '町を選ぶ'],

  // moods (names + the little words walkers say)
  Silent: ['고요한', '静か'],
  Joyful: ['즐거운', '楽しい'],
  Lively: ['활기찬', '元気'],
  Elegant: ['우아한', '上品'],
  Shy: ['수줍은', '照れ屋'],
  Sleepy: ['졸린', '眠い'],
  Busy: ['바쁜', '忙しい'],
  Scattered: ['산만한', 'そわそわ'],
  Gentle: ['다정한', 'やさしい'],
  Calm: ['차분한', '穏やか'],
  Gloomy: ['우울한', 'ゆううつ'],
  Dreamy: ['몽글몽글', 'ゆめごこち'],
  Chic: ['시크한', 'クール'],
  'yay!': ['야호!', 'やった!'],
  'hey!': ['안녕!', 'やあ!'],
  zzz: ['쿨쿨', 'すやすや'],
  'gotta go!': ['바빠 바빠!', 'いそがなきゃ!'],
  'uh…?': ['어…?', 'あれ…?'],
  'hmm~': ['흠~', 'ふむ~'],
  sigh: ['휴', 'はぁ'],
  'la la~': ['랄라~', 'ららら~'],
  '…': ['…', '…'],

  // my page
  'Notification setting': ['알림 설정', '通知設定'],
  'Subway-TI': ['길BTI', '駅BTI'],
  Notice: ['공지사항', 'お知らせ'],
  FAQ: ['자주 묻는 질문', 'よくある質問'],
  Feedback: ['피드백', 'フィードバック'],
  'Reset (test)': ['초기화 (테스트)', 'リセット (テスト)'],
  'Replay tutorial (test)': ['튜토리얼 다시하기 (테스트)', 'チュートリアルをもう一度 (テスト)'],
  'Loading screen (test)': ['로딩 화면 보기 (테스트)', 'ローディング画面 (テスト)'],
  Reset: ['초기화', 'リセット'],
  Neighbors: ['이웃', 'ご近所さん'],
  Developers: ['만든 사람들', '開発者'],
  'Delete Account': ['계정 삭제', 'アカウント削除'],
  'Notices are coming soon.': ['공지사항은 곧 열려요.', 'お知らせはもうすぐ公開です。'],
  'FAQ is coming soon.': ['자주 묻는 질문은 곧 열려요.', 'よくある質問はもうすぐ公開です。'],
  "Delete your account, your towns and everyone in them?\nThis can't be undone.": ['계정과 모든 마을, 마을 사람들을 삭제할까요?\n되돌릴 수 없어요.', 'アカウントとすべての町、町の人たちを削除しますか?\n元に戻せません。'],
  "Reset all your towns and everyone in them?\nThis can't be undone.": ['모든 마을과 마을 사람들을 초기화할까요?\n되돌릴 수 없어요.', 'すべての町と町の人たちをリセットしますか?\n元に戻せません。'],
  'Log out?': ['로그아웃할까요?', 'ログアウトしますか?'],
  'Log out': ['로그아웃', 'ログアウト'],
  'Log in/Sign up': ['로그인/회원가입', 'ログイン/新規登録'],
  'No Profile': ['프로필 없음', 'プロフィールなし'],
  '{n} Person': ['사람 {n}명', '{n}人'],
  '{n} People': ['사람 {n}명', '{n}人'],
  '{n} Town': ['마을 {n}개', '町 {n}個'],
  '{n} Towns': ['마을 {n}개', '町 {n}個'],
  'Since {date}': ['{date}부터', '{date}から'],
  'Write your introduction...': ['자기소개를 적어 주세요...', '自己紹介を書いてね...'],
  Introduction: ['자기소개', '自己紹介'],
  'Change password': ['비밀번호 바꾸기', 'パスワードを変える'],
  'Edit profile': ['프로필 편집', 'プロフィール編集'],

  // login / sheets
  'Keep your town': ['마을을 지켜요', '町をとっておこう'],
  'Log in': ['로그인', 'ログイン'],
  'Log in to keep your town and its people in your account.': ['로그인하면 마을과 마을 사람들이 계정에 저장돼요.', 'ログインすると町と町の人たちがアカウントに保存されます。'],
  Email: ['이메일', 'メール'],
  Password: ['비밀번호', 'パスワード'],
  'Password ({n}+ characters)': ['비밀번호 ({n}자 이상)', 'パスワード ({n}文字以上)'],
  'The two passwords are different.': ['두 비밀번호가 달라요.', '2つのパスワードが違います。'],
  'Password changed.': ['비밀번호를 바꿨어요.', 'パスワードを変更しました。'],
  'Could not change password.': ['비밀번호를 바꾸지 못했어요.', 'パスワードを変更できませんでした。'],
  'Edit my info': ['내 정보 수정', '自分の情報を編集'],
  'New password': ['새 비밀번호', '新しいパスワード'],
  'New password again': ['새 비밀번호 확인', '新しいパスワード (確認)'],
  'Thanks! We read every note.': ['고마워요! 하나하나 다 읽을게요.', 'ありがとう! ぜんぶ読みます。'],
  'What was confusing, fun, or missing?': ['헷갈렸던 점, 재밌었던 점, 아쉬운 점이 있나요?', 'わかりにくかったこと、楽しかったこと、足りないことは?'],
  'The name you go by in the app.': ['앱에서 쓰는 이름이에요.', 'アプリで使う名前です。'],
  'This email already has an account.': ['이미 가입된 이메일이에요.', 'このメールはもう登録されています。'],
  'Check your email and open the link, then log in.': ['메일함의 링크를 연 다음 로그인해 주세요.', 'メールのリンクを開いてからログインしてね。'],
  'Open the link in your email first, then log in.': ['먼저 메일의 링크를 열고 로그인해 주세요.', 'まずメールのリンクを開いて、ログインしてね。'],
  'Wrong email or password.': ['이메일이나 비밀번호가 틀렸어요.', 'メールかパスワードが違います。'],
  'Password needs at least {n} characters.': ['비밀번호는 {n}자 이상이어야 해요.', 'パスワードは{n}文字以上にしてね。'],

  // app-wide messages
  "Couldn't reach your account. Your town stays on this device — try again in a moment.": ['계정에 연결하지 못했어요. 마을은 이 기기에 그대로 있어요. 잠시 후 다시 해 주세요.', 'アカウントにつながりませんでした。町はこの端末に残っています。少ししてからもう一度試してね。'],
  "Couldn't save your guest town to the account yet. It will be added the next time you log in.": ['게스트 마을을 아직 계정에 저장하지 못했어요. 다음에 로그인할 때 추가돼요.', 'ゲストの町をまだアカウントに保存できませんでした。次にログインしたときに追加されます。'],
  'Storage is full. Let a few people go to make room for new ones.': ['저장 공간이 가득 찼어요. 몇 명을 놓아주면 새로운 사람을 데려올 수 있어요.', '保存容量がいっぱいです。何人か見送ると、新しい人を迎えられます。'],
  "{n} person didn't fit in your towns.": ['{n}명이 마을에 들어가지 못했어요.', '{n}人が町に入りきりませんでした。'],
  "{n} people didn't fit in your towns.": ['{n}명이 마을에 들어가지 못했어요.', '{n}人が町に入りきりませんでした。'],

  // Subway-TI (길BTI)
  'Before you start': ['시작하기 전에', 'はじめる前に'],
  'A few quick questions about how you ride, watch and record.': ['지하철을 타고, 사람을 보고, 기록하는 방식에 대해 몇 가지만 물어볼게요.', '電車の乗り方、人の見方、記録のしかたについて少しだけ質問します。'],
  'About 2 minutes.': ['2분 정도 걸려요.', '2分くらいで終わります。'],
  'Only our team sees your answers. They help us understand who uses the app.': ['답변은 우리 팀만 봐요. 앱을 쓰는 사람을 이해하는 데 써요.', '回答はチームだけが見ます。アプリを使う人を知るために使います。'],
  'Your Subway-TI': ['나의 길BTI', 'あなたの駅BTI'],
  'Pick all that fit': ['해당하는 것을 모두 골라요', '当てはまるものをすべて選んでね'],
  'Likes observing': ['관찰 좋아함', '観察が好き'],
  'Not into it': ['관심 없음', '興味なし'],
  'Likes recording': ['기록 좋아함', '記録が好き'],
  'Not into recording': ['기록 관심 없음', '記録に興味なし'],
  'About you': ['나에 대해', 'あなたについて'],
  Riding: ['타는 습관', '乗りかた'],
  Observing: ['관찰', '観察'],
  Recording: ['기록', '記録'],
  'What should we call you?': ['뭐라고 부를까요?', 'なんて呼べばいい?'],
  'How old are you?': ['나이가 어떻게 되나요?', '年齢は?'],
  'Under 20': ['20세 미만', '20歳未満'],
  '20s': ['20대', '20代'],
  '30s': ['30대', '30代'],
  '40s': ['40대', '40代'],
  '50+': ['50대 이상', '50代以上'],
  'How often do you ride the subway?': ['지하철을 얼마나 자주 타나요?', '地下鉄にどれくらい乗る?'],
  'Every day': ['매일', '毎日'],
  'A few times a week': ['일주일에 몇 번', '週に数回'],
  'A few times a month': ['한 달에 몇 번', '月に数回'],
  Rarely: ['거의 안 타요', 'ほとんど乗らない'],
  'When do you usually ride?': ['주로 언제 타나요?', 'いつ乗ることが多い?'],
  'Morning commute': ['아침 출근길', '朝の通勤'],
  Daytime: ['낮', '昼間'],
  'Evening commute': ['저녁 퇴근길', '夕方の帰り道'],
  'Late night': ['늦은 밤', '深夜'],
  Weekends: ['주말', '週末'],
  'How long is a usual ride?': ['보통 얼마나 타나요?', 'ふだん何分くらい乗る?'],
  'Under 15 min': ['15분 미만', '15分未満'],
  '15–30 min': ['15–30분', '15–30分'],
  '30–60 min': ['30–60분', '30–60分'],
  'Over an hour': ['1시간 넘게', '1時間以上'],
  'Do you enjoy watching the people around you?': ['주변 사람들을 구경하는 걸 좋아하나요?', 'まわりの人を眺めるのは好き?'],
  'Not at all': ['전혀 아니에요', 'ぜんぜん'],
  'Love it': ['정말 좋아요', '大好き'],
  'What do you mostly notice?': ['주로 무엇이 눈에 들어오나요?', 'おもに何に目がいく?'],
  'Outfits & style': ['옷차림과 스타일', '服装やスタイル'],
  'Faces & expressions': ['얼굴과 표정', '顔や表情'],
  "What they're doing": ['하고 있는 일', 'していること'],
  Conversations: ['대화', '会話'],
  'Things they carry': ['들고 있는 물건', '持ち物'],
  "I don't really look": ['잘 안 봐요', 'あまり見ない'],
  'Has noticing someone ever changed something in your day or life?': ['누군가를 눈여겨본 일이 하루나 삶을 바꾼 적이 있나요?', '誰かに目をとめたことで、一日や人生が変わったことはある?'],
  Never: ['없어요', 'ない'],
  'Once or twice': ['한두 번', '1、2回'],
  Sometimes: ['가끔', 'ときどき'],
  Often: ['자주', 'よくある'],
  'Do you enjoy recording things — photos, notes, drawings?': ['사진, 메모, 그림처럼 무언가를 기록하는 걸 좋아하나요?', '写真・メモ・絵など、記録するのは好き?'],
  'Why, or why not?': ['그 이유는요?', 'それはなぜ?'],
  'A line or two is plenty': ['한두 줄이면 충분해요', '一、二行で十分です'],
  'What do you mostly record?': ['주로 무엇을 기록하나요?', 'おもに何を記録する?'],
  Photos: ['사진', '写真'],
  'Notes & diary': ['메모와 일기', 'メモや日記'],
  Drawings: ['그림', '絵'],
  Videos: ['영상', '動画'],
  'Social media posts': ['SNS 게시물', 'SNSの投稿'],
  'Telling friends about it': ['친구에게 이야기하기', '友だちに話す'],
  'Not much': ['별로 안 해요', 'あまりしない'],
  'Enjoys both': ['둘 다 좋아함', 'どっちも好き'],
  'Recording only': ['기록만 좋아함', '記録だけ好き'],
  'Observing only': ['관찰만 좋아함', '観察だけ好き'],
  'Interested in neither': ['둘 다 관심 없음', 'どっちも興味なし'],
  'You notice people and like keeping what you saw.': ['사람을 눈여겨보고, 본 것을 간직하는 걸 좋아해요.', '人に目をとめて、見たものを残すのが好き。'],
  "People aren't your thing to watch, but you love keeping things.": ['사람 구경엔 관심 없지만, 무언가를 간직하는 건 좋아해요.', '人を眺めるのは興味ないけど、残すのは大好き。'],
  'You notice everyone around you, and let the moment pass.': ['주변 사람을 모두 눈여겨보지만, 그 순간은 흘려보내요.', 'まわりの人みんなに気づくけど、その瞬間は流していく。'],
  'You ride in your own world. Maybe someone will catch your eye.': ['나만의 세계에서 지하철을 타요. 언젠가 누군가 눈에 들어올지도요.', '自分の世界で電車に乗っている。いつか誰かが目にとまるかも。'],
  // onboarding (OnboardingScreens.tsx, DrawScreen tips, My Page profile picture)
  'Welcome to': ['어서 오세요', 'ようこそ'],
  'Draw the people you notice on the subway, and invite them to your town.': ['지하철에서 눈에 들어온 사람을 그려서 내 마을에 초대해요.', '電車で目にとまった人を描いて、自分の町に招待しよう。'],
  'New here? Sign up. Already have an account? Log in.': ['처음이면 회원가입, 계정이 있으면 로그인하세요.', 'はじめてなら新規登録、アカウントがあればログイン。'],
  'Shown in your towns and on My Page. You can change it later.': ['마을과 마이페이지에 보여요. 나중에 바꿀 수 있어요.', '町とマイページに表示されます。あとで変えられます。'],
  'Start by drawing yourself today! Follow the dotted guide. A few lines will do.': ['먼저 오늘의 나를 그려봐요! 점선 가이드를 따라 몇 줄이면 충분해요.', 'まずは今日の自分を描いてみよう!点線のガイドにそって、数本の線で十分。'],
  'Pencil, highlighter and eraser, with undo and redo next to them. Tap the picked pencil again to change its thickness.': [
    '연필, 형광펜, 지우개예요. 옆에는 되돌리기와 다시하기가 있어요. 고른 연필을 한 번 더 눌러 굵기를 바꿔봐요.',
    'えんぴつ、蛍光ペン、消しゴム。となりは元に戻す・やり直し。選んだえんぴつをもう一度押して太さを変えてみよう。',
  ],
  'Pick a thickness.': ['굵기를 골라요.', '太さを選ぼう。'],
  'Tap the wheel to change the color.': ['동그라미를 눌러 색을 바꿔봐요.', '丸を押して色を変えてみよう。'],
  'Choose a color, then close the panel.': ['색을 고른 뒤 창을 닫아요.', '色を選んだら、パネルを閉じよう。'],
  'Tap to turn the dotted guide off or on.': ['눌러서 점선 가이드를 끄고 켜요.', '押して点線ガイドをオフ・オンしよう。'],
  'Two fingers zoom, tilt and move the paper. Try it!': ['두 손가락으로 종이를 확대하고, 기울이고, 옮길 수 있어요. 해봐요!', '2本の指で紙を拡大・傾け・移動できます。やってみよう!'],
  'Tap here to put the paper back to its normal size.': ['여기를 누르면 종이가 원래 크기로 돌아와요.', 'ここを押すと紙が元のサイズに戻ります。'],
  'Now open Memo.': ['이제 메모를 열어요.', '次はメモを開こう。'],
  'Add their mood, where you are, a name and a line about them.': ['분위기, 지금 있는 곳, 이름, 한 줄을 적어요.', '雰囲気、いる場所、名前、ひとことを書こう。'],
  'Skip tutorial': ['튜토리얼 건너뛰기', 'チュートリアルをスキップ'],
  'Done? Tap ✓ to see your card.': ['다 그렸으면 ✓를 눌러 카드를 확인해봐요.', '描けたら✓を押してカードを見てみよう。'],
  "That's your card! Now tap Go Back and finish it on your own. This first drawing of you becomes your profile picture (change it on My Page).": ['이게 내 카드예요! 이제 돌아가기를 눌러 직접 카드를 완성해보세요. 처음 그린 내가 프로필 사진이 돼요 (마이페이지에서 변경 가능).', 'これがあなたのカード！「戻る」を押して、今度は自分でカードを完成させてみよう。最初に描いた自分がプロフィール写真になります(マイページで変更可)。'],
  'Change profile picture': ['프로필 사진 바꾸기', 'プロフィール写真を変える'],
  Change: ['변경', '変更'],
  'Profile picture': ['프로필 사진', 'プロフィール写真'],
  'Pick one of your people.': ['내 마을 사람 중 한 명을 골라요.', '自分の町の人からひとり選ぼう。'],
  // daily 8 p.m. interview (components/InterviewOverlay.tsx)
  'It’s 8p.m.': ['저녁 8시,', '夜8時、'],
  'Interview Time!': ['인터뷰 시간이에요!', 'インタビューの時間!'],
  'Why didn’t you draw today?': ['오늘은 왜 아무도 안 그렸나요?', '今日はどうして誰も描かなかった?'],
  'In what situation did you collect?': ['어떤 상황에서 수집했나요?', 'どんな場面で集めた?'],
  'Who did you collect, and why?': ['누구를, 왜 수집했나요?', '誰を、なぜ集めた?'],
  'How did you feel\nwhile collecting them?': ['수집하는 동안\n기분이 어땠나요?', '集めているとき、\nどんな気分だった?'],
  Interested: ['흥미로웠어요', '興味があった'],
  Excited: ['신났어요', 'ワクワクした'],
  Bored: ['지루했어요', '退屈だった'],
  Indifferent: ['그저 그랬어요', 'なんとも思わなかった'],
  'Other feelings...': ['다른 기분...', 'ほかの気持ち...'],
}
