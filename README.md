# 찌부씰 · Subway Seal

> 지하철에서 마주친 사람을 사진 대신 그림으로, 띠부씰처럼 남기는 웹앱

KAIST ID304 UX Design (2026 Fall) 팀 프로젝트.

## 컨셉

출퇴근·통학길 지하철에서 흘려보내던 이동 시간에, 주의를 잠깐 주변 사람에게 머물게 합니다.
눈에 들어온 사람의 옷차림과 인상을 짧게 그려 스티커(씰)로 만들고, 스티커북에 모아 나만의 지하철을 꾸밉니다.

- **사진 대신 그림** — 도촬 없이 관찰하는 방식
- **결과보다 과정 (Slowness)** — 잘 그리는 것보다 그 순간 머무는 것이 목적
- **기억은 부산물** — 모인 스티커를 돌아보며 "내 관심은 이런 거였네"를 발견

## 핵심 경험

1. **기억에 남는 이동** — 의미 없이 지나가던 이동 시간을 기억할 만한 순간으로
2. **사진으로 못 남긴 스타일을 쉽게** — 그림 실력 부담 없이 빠르게 그려 씰로
3. **타인에 대한 관심** — 무관심 대신 다정한 관심, 그리고 내 취향에 대한 회고

## 대상 사용자

**김하나 (23, 대학생)** — 대중교통으로 20분 이상 통학하며, 마주친 사람들의 옷 색 조합·아이템·핏을 눈여겨보는 "고개 드는 관찰자".
들키지 않게, 짧게, 못 그려도 본 옷을 남기고 싶어 합니다.

## 상태

와이어프레임 프로토타입. 화면 4개가 Figma UX 디자인(132:* 프레임)대로 들어가 있고, 그린 스티커는 팀 공용 DB에 저장됩니다.

| 화면 | 할 수 있는 것 |
|---|---|
| 스플래시 | 역 이름판 탭하면 시작 |
| 캔버스 | 손가락으로 그리기(연필·지우개·두께 5단계·색 10개), 장소·이름 입력, 뒤집어서 메모, ✓로 저장. 두 손가락 탭 = 실행 취소, 세 손가락 탭 = 다시 실행 |
| 스티커북 | 라벨 6개 = 책 6권. 아래 스티커를 고르고 빈 칸을 탭해 붙이기, 오른쪽 숫자로 쪽 이동 |
| 지하철 꾸미기 | 가로 화면. 라벨로 책을 고르면 그 책의 스티커만 보이고, 고른 뒤 지하철 칸을 탭해 붙이기 |

- 기술: Vite + React + TypeScript + Tailwind CSS, 저장은 Supabase (DB + 이미지 저장소)
- 대상: iPhone Safari. PC 브라우저에서는 폰 비율(402×874) 틀로 보여 줍니다 (확인용)
- 로그인 없음. 팀 내부 테스트용이라 키를 가진 사람은 누구나 모든 스티커를 읽고 쓸 수 있습니다
- 개발 흐름 설계: [docs/superpowers/specs/2026-10-29-dev-pipeline-design.md](docs/superpowers/specs/2026-10-29-dev-pipeline-design.md)

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
git clone https://github.com/WooeeKim/subwayseal.git
cd subwayseal
```

### 6. 의존성 설치

```bash
npm install
```

`node_modules` 폴더가 생기면 성공. `package.json`이 바뀌었을 때(누가 새 패키지를 추가했을 때)도 다시 실행하세요.

### 7. DB 키 넣기 (Supabase)

그린 스티커는 팀 공용 Supabase DB에 저장됩니다. 키가 없어도 앱은 열리지만, 화면 위에 "DB 미연결" 문구가 뜨고 새로고침하면 그림이 사라집니다.

1. 팀 채팅에서 **anon(publishable) 키**를 받으세요. 키는 레포에 올리지 않습니다.
2. 예시 파일을 복사해 `.env.local`을 만듭니다.

   ```bash
   cp .env.example .env.local
   ```

3. `.env.local`을 열어 `VITE_SUPABASE_ANON_KEY=` 뒤에 받은 키를 붙여넣고 저장합니다.

   ```bash
   open -e .env.local
   ```

- `.env.local`은 git이 무시하는 파일이라 커밋되지 않습니다. **`.env.example`에는 키를 넣지 마세요** (이 파일은 커밋됩니다).
- `service_role`/`secret` 키는 절대 쓰지 마세요. 앱에는 anon 키만 씁니다.
- 키를 넣은 뒤에는 개발 서버를 껐다 켜야 적용됩니다.

**DB 관리자만 (한 번):** 테이블·저장소는 Supabase 대시보드 → SQL Editor에서 만듭니다. 처음엔 [supabase/schema.sql](supabase/schema.sql)을, 그다음 [supabase/migrations/](supabase/migrations/) 안의 파일을 번호 순서대로 실행합니다. 새 마이그레이션 파일이 올라오면 그 파일만 실행하고 팀 채팅에 알려주세요. (현재 팀 DB에는 `002_book_label.sql`까지 적용됨)

### 8. 아이폰에서 열기

```bash
npm run dev -- --host
```

터미널에 이런 줄이 나옵니다:

```
➜  Network: http://192.168.0.12:5173/
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

모두 `main` 브랜치에서 작업합니다. 충돌을 줄이려면 아래 순서를 지켜주세요.

```bash
# 1. 작업 시작 전: 최신 코드 받기
git pull --rebase

# 2. 코드 수정 후, 올리기 전: 빌드가 깨지지 않는지 확인
npm run build

# 3. 저장(커밋)
git add .
git commit -m "무엇을 바꿨는지 한 줄로"

# 4. 올리기 직전에 한 번 더 최신 코드 받기 → 올리기
git pull --rebase
git push
```

**규칙**

- 한 사람이 한 컴포넌트 파일을 맡습니다. 같은 파일을 동시에 고치면 충돌이 납니다.
- `npm run build`가 에러로 끝나면 올리지 마세요. 다른 팀원 모두가 막힙니다.
- `git pull --rebase` 중 "CONFLICT"가 나오면 혼자 해결하려 하지 말고 팀 채팅에 공유하세요.

---

## prototyping 브랜치 (Figma "prototyping" 섹션 웹 프로토타입)

- 화면: 메인 마을(걷기·핀치줌·끝에서 당겨 마을 넘기기·카드 상세·Follow·Migration), Town List, Collection, Draw
- 데이터: 이 브라우저 localStorage에만 저장 (DB 사용 안 함)
- PC 미리보기: `npm run dev -- --mode http` → http://localhost:5173 (Figma 프레임 402×874 그대로, 창이 작으면 통째로 축소)
- https가 필요하면(위치 권한): `npm run dev` → 인증서 경고에서 계속 진행
- 역 이름 데이터 © OpenStreetMap contributors (ODbL), 폰트: 그리운 묘은흘림체 원본 파일
