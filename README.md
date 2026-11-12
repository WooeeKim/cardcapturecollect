# card capture collect

> 지하철에서 마주친 사람을 사진 대신 손그림 카드로 남기고, 마을에 모으는 웹앱

KAIST ID304 UX Design (2026 Fall) 팀 프로젝트. 배포 주소: **https://cardcapturecollect.vercel.app**

(브라우저 저장 키 `subwayseal.*`와 Vercel 프로젝트 이름 `subwayseal`은 예전 이름 "찌부씰 · Subway Seal" 때 그대로예요. 저장 키를 바꾸면 기존 사용자 데이터가 사라지니 그대로 둡니다.)

## 컨셉

출퇴근·통학길 지하철에서 흘려보내던 이동 시간에, 주의를 잠깐 주변 사람에게 머물게 합니다.
눈에 들어온 사람의 옷차림과 인상을 짧게 그려 **card**로 남기고(**capture**), 마을에 살게 하며 모읍니다(**collect**).

- **사진 대신 그림**: 도촬 없이 관찰하는 방식
- **결과보다 과정 (Slowness)**: 잘 그리는 것보다 그 순간 머무는 것이 목적
- **기억은 부산물**: 모인 카드를 돌아보며 "내 관심은 이런 거였네"를 발견

## 대상 사용자

**김하나 (23, 대학생)**: 대중교통으로 20분 이상 통학하며, 마주친 사람들의 옷 색 조합·아이템·핏을 눈여겨보는 "고개 드는 관찰자".
들키지 않게, 짧게, 못 그려도 본 옷을 남기고 싶어 합니다.

## 화면

Figma "prototyping" 섹션을 그대로 옮긴 웹앱이에요. 폰 세로 화면 기준입니다.

| 화면 | 할 수 있는 것 |
|---|---|
| 시작 | 앱 이름이 1초쯤 뜬 뒤 블러로 메인에 들어감 |
| 메인 (마을) | 카드 속 사람들이 마을을 걸어 다님. 끌어서 둘러보기, 두 손가락으로 확대. 마을 끝에 닿으면 옆 마을 길잡이가 뜨고, 손가락을 반대쪽 끝까지 끌면 옆 마을로 넘어감(넘길까 말까 하는 구간에서 진동, 안드로이드만). 사람을 탭하면 카드 상세 → Follow(따라가기) / Migration(다른 마을로 이사) |
| Draw | Drawing \| Memo 탭. 펜·형광펜·지우개(도구마다 색·굵기 따로), 색 패널(스펙트럼·투명도·스포이드), 인물 가이드. Memo: 무드 9개, 장소(역 이름), 닉네임, 메모. 전부 채워야 완성 → 보낼 마을 고르기 |
| Town List | 마을 최대 10개, 마을마다 18명. 탭하면 상세(소개·Go·Edit), 오른쪽 손잡이로 순서 바꾸기, +로 새 마을 |
| Collection | 위쪽 마을 띠에서 마을 고르기 → 그 마을 덱(3×2, 첫 칸 = Head) → 아래에 다른 마을 카드. 꾹 눌러 끌어서 덱에 넣기, 카드끼리 자리 바꾸기, 덱 안에서 순서 바꾸기. 탭하면 카드 상세(Discard) |
| 마이페이지 | 로그인·가입, 로그아웃, 비밀번호 변경, 그린 카드 수, 초기화, Feedback |
| 카드 갤러리 | `/#/admin`, 팀 관리자용. 테스터별·마을별 카드 전부 보기 |

- 기술: Vite + React + TypeScript + Tailwind CSS, 계정·저장은 Supabase, 사용성 로그는 PostHog, 배포는 Vercel
- 처음엔 게스트로 시작하고 데이터는 이 기기에 저장돼요. 로그인하면 게스트 데이터가 그 계정에 합쳐지고, 이후로는 계정별로 서버에 저장돼요
- PC 브라우저에서는 폰 비율(402×874) 틀로 보여요 (확인용)
- 장소 자동 입력: 위치 권한을 주면 5km 안 가장 가까운 지하철·기차역으로 채워요. 못 찾으면 마지막에 쓴 장소로 채워요. 역 이름 데이터 © OpenStreetMap contributors (ODbL)
- 폰트: 그리운 묘은흘림체

---

## 개발 환경 세팅 (처음 한 번)

맥 기준. 개발이 처음이어도 위에서부터 순서대로 따라 하면 됩니다.
아래 `코드 블록` 안의 내용은 **터미널**에 복사해 붙여넣고 엔터를 누르세요.

> 터미널 여는 법: `⌘ + Space` → "터미널" 입력 → 엔터

### 1. 개발자 도구 (Git 포함)

```bash
xcode-select --install
```

창이 뜨면 "설치"를 누르세요. 이미 설치돼 있다는 메시지가 나오면 다음 단계로 넘어가면 됩니다.

### 2. Homebrew (맥용 프로그램 설치 도구)

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

- 맥 로그인 비밀번호를 물어보면 입력하세요 (입력해도 화면에 안 보이는 게 정상).
- 설치가 끝나면 터미널에 **"Next steps"** 아래 명령어 2줄이 나옵니다. 그 2줄을 그대로 복사해 실행하세요.
- 확인: `brew --version` → 버전 숫자가 나오면 성공

### 3. Node.js와 GitHub CLI

```bash
brew install node gh
```

확인:

```bash
node -v
npm -v
```

숫자가 나오면 성공. (`node -v`가 `v20.19` 이상이어야 합니다.)

### 4. GitHub 로그인

[GitHub](https://github.com) 계정이 필요합니다. 레포 관리자에게 계정 아이디를 알려주고 **collaborator 초대**를 수락하세요 (초대는 이메일로 옴).

```bash
gh auth login
```

질문에 이렇게 답하세요:

1. `GitHub.com`
2. `HTTPS`
3. Authenticate Git with your GitHub credentials? → `Yes`
4. `Login with a web browser` → 화면에 나온 8자리 코드를 복사 → 엔터 → 브라우저에서 코드 붙여넣고 승인

그다음 커밋에 표시될 이름과 이메일을 설정하세요 (GitHub 계정 이메일 권장):

```bash
git config --global user.name "내이름"
git config --global user.email "내이메일@example.com"
```

### 5. 코드 받기

원하는 폴더로 이동한 뒤 받습니다. 예: 문서 폴더

```bash
cd ~/Documents
git clone https://github.com/WooeeKim/cardcapturecollect.git
cd cardcapturecollect
```

### 6. 의존성 설치

```bash
npm install
```

`node_modules` 폴더가 생기면 성공. `package.json`이 바뀌었을 때(누가 새 패키지를 추가했을 때)도 다시 실행하세요.

### 7. 키 넣기 (`.env.local`)

키가 없어도 앱은 열려요. 이 경우 로그인은 이 브라우저 안의 가짜 계정으로 동작하고, 사용성 로그는 보내지 않아요.

1. 팀 채팅에서 키를 받으세요. 키는 레포에 올리지 않습니다.
2. 예시 파일을 복사해 `.env.local`을 만들고, 받은 값을 채워 넣습니다.

   ```bash
   cp .env.example .env.local
   open -e .env.local
   ```

   | 이름 | 값 |
   |---|---|
   | `VITE_SUPABASE_URL` | Supabase 프로젝트 주소 (예시 파일에 이미 들어 있음) |
   | `VITE_SUPABASE_ANON_KEY` | Supabase anon(publishable) 키 |
   | `VITE_POSTHOG_KEY` | PostHog Project API key (없으면 로그 안 보냄) |
   | `VITE_POSTHOG_HOST` | 기본 `https://us.i.posthog.com` (EU면 `https://eu.i.posthog.com`) |

- `.env.local`은 git이 무시하는 파일이라 커밋되지 않습니다. **`.env.example`에는 키를 넣지 마세요** (이 파일은 커밋됩니다).
- `service_role`/`secret` 키는 절대 쓰지 마세요. 앱에는 anon 키만 씁니다.
- 키를 넣은 뒤에는 개발 서버를 껐다 켜야 적용됩니다.

### 8. 실행하기

```bash
npm run dev -- --host
```

- 개발 서버는 https로 떠요. 아이폰 Safari는 https에서만 위치 권한을 주기 때문이에요. 처음 열 때 인증서 경고가 나오면 계속 진행하세요.
- PC에서 인증서 경고 없이 보려면 `npm run dev -- --mode http` → http://localhost:5173

터미널에 이런 줄이 나옵니다:

```
➜  Network: https://192.168.0.12:5173/
```

1. 아이폰을 **맥과 같은 Wi-Fi**에 연결
2. 아이폰 Safari에서 `Network:` 옆 주소 입력
3. 코드를 저장하면 아이폰 화면이 자동으로 바뀝니다
4. 끝내려면 터미널에서 `Ctrl + C`

**아이폰에서 안 열릴 때**

- 학교 Wi-Fi는 기기끼리 연결을 막는 경우가 많습니다. → 아이폰 **설정 → 개인용 핫스팟** 켜기 → 맥을 그 핫스팟에 연결 → `npm run dev -- --host` 다시 실행 → 새로 나온 `Network:` 주소로 접속
- 맥에서 "들어오는 연결을 허용하시겠습니까?" 창이 뜨면 **허용**

---

## 매일 작업하는 법

`main`이 배포 기준이에요. **main에 올라가면 바로 https://cardcapturecollect.vercel.app 에 배포**되니, main에 직접 올리지 말고 브랜치 → PR로 작업합니다.

```bash
# 1. 최신 main에서 브랜치 만들기
git switch main
git pull
git switch -c fix/무엇을-고치는지

# 2. 코드 수정 후: 빌드가 깨지지 않는지 확인
npm run build

# 3. 저장(커밋). 한 커밋에는 한 가지 일만
git add .
git commit -m "fix: 무엇을 왜 바꿨는지 한 줄로"

# 4. 올리고 PR 만들기
git push -u origin HEAD
gh pr create --base main
```

- PR을 올리면 Vercel이 그 브랜치의 **미리보기 주소**를 PR에 달아 줘요. 폰으로 열어 확인한 뒤 머지하세요.
- `npm run build`가 에러로 끝나면 올리지 마세요.
- 충돌이 나면 혼자 해결하려 하지 말고 팀 채팅에 공유하세요.

---

## Supabase (DB 관리자만, 한 번)

Supabase 대시보드 → **SQL Editor**에서 [supabase/migrations/](supabase/migrations/) 파일을 실행합니다. 새 마이그레이션 파일이 올라오면 그 파일만 실행하고 팀 채팅에 알려주세요.

1. `004_user_states.sql`: 계정별 마을·카드 저장 테이블 (본인 것만 읽고 쓰기)
2. `005_admin_gallery.sql`: 카드 갤러리용 관리자 목록 + 관리자는 모든 사람 데이터 읽기
3. 관리자 추가 (카드 갤러리에 들어갈 사람의 로그인 이메일, 소문자로):

   ```sql
   insert into public.app_admins (email) values ('내이메일@example.com');
   ```

   관리자 목록은 SQL Editor에서만 바꿀 수 있어요 (앱에서는 못 바꿈).

대시보드 설정:

- **Authentication → URL Configuration → Site URL**: `https://cardcapturecollect.vercel.app` (가입 확인 메일 링크가 이 주소로 열림)
- **Authentication → Sign In / Providers → Email → Confirm email**: 테스터가 메일 확인 없이 바로 로그인하게 하려면 끄기
- 로그인 규칙은 Supabase 기본값: **이메일 + 비밀번호 6자 이상**

(`supabase/schema.sql`과 `002_book_label.sql`은 예전 와이어프레임 버전의 스티커 테이블이에요. 지금 앱은 쓰지 않아요.)

## Vercel 배포

- 프로젝트: Vercel `subwayseal` (GitHub `WooeeKim/cardcapturecollect` 연결), **Production Branch = `main`**
- 주소: https://cardcapturecollect.vercel.app (예전 주소 https://subwayseal.vercel.app 도 같은 앱으로 계속 열려요)
- main에 머지되면 자동으로 https://cardcapturecollect.vercel.app 에 배포되고, 다른 브랜치·PR은 미리보기 주소로 배포돼요
- 환경 변수(Vercel → Settings → Environment Variables): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST` (시크릿 키 금지). 바꾼 뒤에는 다시 배포해야 적용돼요

## 사용성 테스트 로그 (PostHog)

- 화면 녹화(세션 리플레이), 히트맵, 화면별 체류시간, 주요 행동 이벤트, 피드백을 PostHog로 보냄. 키가 없으면 아무것도 안 보냄
- 화면마다 주소가 바뀜(`#/main`, `#/draw`, `#/towns`, `#/collection`, `#/mypage` …) → PostHog에서 화면별로 나눠 봄
- 체류시간: `$pageview` 이벤트의 `$prev_pageview_duration`(초)
- 이벤트: `card_made`(mood), `card_sent`, `card_moved`, `log_in`/`sign_up`(ok), `reset`, `feedback`(text) + 자동 클릭 수집
- 로그인한 테스터는 PostHog 사람 목록에 이메일로 보임. 입력칸 글자는 녹화에서 가려짐
- 피드백: 마이페이지 → Feedback

**설정 (한 번)**

1. posthog.com 가입 → 프로젝트 생성 → Project API key를 `.env.local`과 Vercel 환경 변수의 `VITE_POSTHOG_KEY`에
2. PostHog → Settings → Session replay 켜기. 그리기 화면까지 녹화하려면 **Capture canvas** 켜기
3. Settings → Heatmaps 켜기 (Toolbar로 배포 주소를 열어 화면별 확인)
4. 화면을 녹화하므로 테스터에게 미리 알리고 동의 받기

## 문서

- 개발 흐름 설계: [docs/superpowers/specs/2026-10-29-dev-pipeline-design.md](docs/superpowers/specs/2026-10-29-dev-pipeline-design.md)
