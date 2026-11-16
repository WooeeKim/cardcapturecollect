# 로그 수집 계획 — 화면녹화 대체

목표: 테스터 화면녹화를 받지 않고도 "누가, 언제, 어느 화면에서, 무엇을, 얼마나 오래, 어디서 막혔는지"를 다시 볼 수 있게 한다.
기준 문서: Figma `스케치 확정 → 수집할 데이터` 섹션 (node 961:4331).

## 0. 지금 있는 것 / 비어 있는 것

| Figma 항목 | 현재 | 이 계획에서 |
|---|---|---|
| 몇 명을 그렸는지 | ✅ Stats (user_states 기준) | 개인별로도 |
| 타운 몇 개 추가했는지 | ✅ 현재 개수만 | `town_add` 이벤트로 시점·이력까지 |
| 어떤 무드의 사람을 기록했는지 | ✅ 전체 합계 | 개인별·길BTI별 |
| 그릴 때 소요된 시간 | ✅ draw/memo 시간 (009) | 그대로 + 도구별 시간 |
| 그리다 말고 저장 안 한 사람 | △ 나간 횟수만 | 누가, 몇 획 그리고, 어느 단계에서 나갔는지 |
| 피드백 | ✅ | 그대로 |
| 초기화는 어드민만 | ✅ PR #16 | — |
| 각 유저가 얼마나 긴 시간 썼는지 | ❌ | 앱 세션 + 하트비트 |
| 어떤 화면에 가장 오래 있었는지 | ❌ | `screen_view` 체류시간 |
| 몇 번 이동시켰는지 | ❌ | 이동(마을 옮기기·콜렉션 드래그) 이벤트 |
| 몇시에 썼는지 | △ 카드 만든 시각만 | 앱을 연 시각 (요일×시간) |
| 연필·형광펜·지우개 얼마나 썼는지 | ❌ | 획 단위 `stroke` 이벤트 |
| 길BTI에 따라 행동분석 | ❌ | 모든 지표를 길BTI 유형으로 나눠 보기 |
| 전체평균 / 개인 두 버전 | ❌ | Stats 상단 "전체 ↔ 사람" 전환 |
| 히트맵 | ❌ | 전역 탭 좌표 수집 → 화면 위 히트맵 |
| 화면녹화 | ❌ | 세션 타임라인 + 그리기 과정 재생 |

## 1. 수집 기반 (먼저 고칠 것)

지금 `logEvent`는 보내고 잊는 방식이라 오프라인이면 사라진다. 녹화를 대체하려면 빠짐없이 쌓여야 한다.

- **`track(event, data)` 하나로 통일** (`src/lib/events.ts`). 기존 `logEvent` 호출도 이걸로.
- **로컬 큐 + 묶어 보내기**: localStorage에 쌓고 10초마다 / 50개마다 / 화면 숨김(`visibilitychange`, `pagehide`) 때 한 번에 insert. 실패하면 남겨 두고 다음에 재시도. 큐 상한 2,000개(넘으면 오래된 heartbeat부터 버림).
- **모든 이벤트에 공통으로 붙는 값**
  - `app_session` 앱 세션 id (앱을 열 때 새로 만들고, 30분 이상 백그라운드였다 돌아오면 새로)
  - `seq` 세션 안 순번 (순서 복원용, 시계가 틀려도 안전)
  - `screen` 지금 화면 (main / towns / migrate / send / collection / draw / tada / mypage / login / nickname / gilbti)
  - `at` 클라이언트 시각, `device_id`, `user_id`(서버가 채움)
  - 세션 시작 이벤트에만: 앱 버전(빌드 해시), 언어, 화면 크기, PWA 설치 여부(standalone), OS/브라우저, 알림 권한 상태
- **어드민 "view as"에서는 수집 안 함** (지금과 동일).
- **입력한 글자는 저장하지 않는다.** 길이만 (`len`). 예외: 피드백 본문(지금처럼). 메모·이름 내용은 어차피 카드에 저장된다.

## 2. 이벤트 목록

### A. 앱 세션 / 사용시간
| 이벤트 | data | 쓰임 |
|---|---|---|
| `app_open` | cold/resume, 알림 클릭으로 열었는지(`from: push`), 스플래시 로딩 ms | 몇시에 썼는지, 재방문 |
| `app_hide` / `app_show` | 숨겨진 시간 | 실사용 시간에서 백그라운드 제외 |
| `heartbeat` | — (화면이 보일 때 30초마다) | 앱 닫힘 이벤트가 안 와도 사용시간 계산 |
| `idle` | 60초 동안 입력 없음 | "켜놓고 안 쓴 시간" 분리 |

→ **사용시간** = 세션별 (마지막 heartbeat/이벤트 − app_open) − 숨김 − idle.

### B. 화면 이동 / 체류
| 이벤트 | data |
|---|---|
| `screen_view` | screen, from, townId 등 route 값 |
| `sheet_open` / `sheet_close` | 어떤 시트·팝업(로그인 시트, 프로필 사진, 비밀번호, 확인 팝업 문구 키), 고른 버튼 |

→ **화면별 체류시간** = 다음 `screen_view`까지 (숨김·idle 제외). App.tsx `route`가 바뀔 때 한 곳에서 기록.

### C. 온보딩 깔때기
`login_view` → `signup_submit` / `login_submit` (성공·실패 사유: 비번 짧음, 이미 가입, 메일 미확인 …) → `nickname_set` → `gilbti_start` → `gilbti_q_view {q, ms}` / `gilbti_answer {q, value}` / `gilbti_back` → `gilbti_done {type}` → `tutorial_step {id, ms}` / `tutorial_skip {at_step}` → `notify_prompt {answer}` → 첫 `town_pick`.
→ 어느 단계에서 이탈하는지, 질문별로 얼마나 고민하는지.

### D. 그리기 (녹화 대체의 핵심)
| 이벤트 | data |
|---|---|
| `stroke` | tool(pen/highlighter/eraser), color, size, 점 개수, 그린 시간 ms, 길이 px, bbox |
| `tool_pick` / `size_pick` / `color_pick` | 고른 값, 스포이드 사용 여부 |
| `undo` / `redo` | 그 시점의 획 수 |
| `zoom` / `fit` | 배율 |
| `draw` / `memo` / `confirm` / `hidden` | (기존 그대로) |
| `mood_pick` / `place_edit` / `name_edit` / `memo_edit` | 무드 이름 / 글자 수만 |
| `draw_blocked` | "한 줄은 그려야 해요" 같은 막힘 팝업 |
| `finish` | 무드, 총 획 수, 도구별 획 수, 총 소요 |
| `exit` | 나간 단계(draw/memo/confirm), 그 때까지 획 수, 버리기 확인 팝업을 거쳤는지 |
| `send_to_town` | 고른 마을, 다 그리고 마을 고르기까지 ms |

→ **연필·형광펜·지우개 사용량**(획 수·시간·비율), **undo 비율**(망설임 지표), **저장 안 한 사람**(몇 획 그리고 포기했는지).

### E. 마을 / 이동
| 이벤트 | data |
|---|---|
| `town_swipe` | from, to, 방향 |
| `walker_tap` / `card_open` | cardId |
| `follow` | cardId |
| `migrate` | cardId, from 마을, to 마을 (메인 → 마을 옮기기) |
| `collection_move` / `collection_swap` | cardId, from, to, index (콜렉션 드래그) |
| `let_go` | cardId, 그 사람의 나이(만든 지 며칠) |
| `town_add` / `town_edit` / `town_delete` / `town_reorder` | townId, 이름 글자 수 |
| `menu_open`, `collection_sort`, `collection_page`, `collection_tab` | — |

→ **몇 번 이동시켰는지** = migrate + collection_move + collection_swap.

### F. 마이페이지
`profile_edit`, `profile_picture`, `lang_change {to}`, `notify_toggle {on}`, `feedback`(기존), `gilbti_retake`, `logout`, `password_change`, `delete_account`.

### G. 탭 히트맵 / 막힘 신호 (전역 리스너 한 개)
| 이벤트 | data |
|---|---|
| `tap` | screen, x·y (402×874 프레임 기준 좌표로 정규화), 눌린 요소 이름(aria-label 또는 텍스트 앞 20자), 반응하는 요소였는지 |
| `rage_tap` | 1초 안에 30px 안쪽을 3번 이상 |
| `dead_tap` | 버튼이 아닌 곳을 누름 (눌릴 줄 알았던 곳) |

그리기 캔버스 위 포인터는 `stroke`로 따로 잡으니 `tap`에서 뺀다.

### H. 오류 / 성능
`js_error`(메시지·스택 앞부분·화면), `promise_error`, `save_fail`(저장공간 가득), `remote_save_fail`, `load_ms`(스플래시~첫 화면).

## 3. 서버 (Supabase)

- `012_app_events_v2.sql`: `app_events`에 `app_session text`, `seq int`, `screen text` 컬럼 추가 + 인덱스 `(user_id, at)`, `(app_session, seq)`. 기존 행은 null로 둔다.
- 일괄 insert(배열) 그대로 지금 RLS로 동작.
- 양: 테스터 1명이 하루 30분 쓰면 대략 하트비트 60 + 탭 200 + 획 300 ≈ 600행. 테스터 50명 × 30일 ≈ 90만 행 — 무료 플랜 용량 안.
- 어드민이 전부 내려받는 지금 방식(1000행씩 페이지)은 느려진다 → 기간 필터(최근 7/30일)와 사람 필터를 쿼리에 걸고, 합계는 SQL 뷰/RPC(`stats_daily`, `stats_screen_time`)로 서버에서 계산.

## 4. 어드민 Stats 화면

상단: **[전체 | 사람 고르기 ▾]** + **[길BTI 유형: 전체/둘 다/기록만/관찰만/둘 다 아님]** + 기간.
사람을 고르면 같은 카드·차트가 그 사람 값으로 바뀌고 옆에 전체 평균을 회색으로 같이 표시.

1. **사용시간**: 하루 사용시간(중앙값·평균), 세션 수, 세션 길이 분포, 재방문(D1/D7)
2. **몇시에 썼는지**: 요일 × 시간 히트맵 (app_open 기준)
3. **화면별 체류시간**: 화면별 총·평균 체류 막대
4. **온보딩 깔때기**: 단계별 남은 인원, 길BTI 질문별 평균 고민 시간
5. **그리기**: 기존 draw/memo 시간 + 도구별 획 수·시간 비율, undo 비율, 포기한 그림(몇 획에서)
6. **이동·관리**: 이동 횟수, 마을 추가/삭제, 놓아주기
7. **길BTI별 비교**: 위 지표를 유형 4개로 나란히
8. **세션 타임라인 (녹화 대체)**: 사람 → 세션 고르면 화면 띠그래프 + 이벤트 목록을 시간순으로. 막힘(rage/dead tap, 오류)은 빨간 점.
9. **탭 히트맵**: 화면 골라서 와이어프레임 위에 탭 점 밀도.
10. **그리기 과정 재생**(3단계): 저장된 획을 순서대로 다시 그려 보기.

## 5. 단계

> 2026-11-16: **1단계만 하고 끝.** 2·3단계(온보딩 깔때기, 이동·마이페이지, 탭 히트맵, 세션 타임라인, 그리기 재생)는 하지 않기로 했다. 위 2장의 C·E·F·G 이벤트와 4장의 4·6·8·9·10번 화면도 같은 이유로 만들지 않는다.

| 단계 | 내용 | Figma 항목 커버 |
|---|---|---|
| **1** | 수집 기반(큐·세션·seq) + A 세션 + B 화면 + D 그리기 도구 이벤트 + 012 마이그레이션. Stats에 사용시간·몇시·화면 체류·도구 사용량·포기한 그림, 전체/개인 전환, 길BTI 필터 | 사용시간, 화면 체류, 몇시, 도구, 저장 안 함, 전체/개인, 길BTI |
| ~~**2**~~ 안 함 | C 온보딩, E 이동, F 마이페이지, G 탭/히트맵, H 오류. Stats에 이동 횟수, 깔때기, 세션 타임라인, 히트맵 | 이동 횟수, 히트맵, 화면녹화(타임라인) |
| ~~**3**~~ 안 함 | 획 좌표 저장(다운샘플, finish 때 한 번에 압축 저장)과 그리기 재생 | 화면녹화(그리기 과정) |

## 6. 개인정보

- 입력한 글은 길이만 수집 (피드백 제외).
- 길BTI 소개 문구("답변은 우리 팀만 봐요")에 "앱 사용 기록도 서비스 개선에만 써요" 한 줄 추가 (ko/en/ja).
- 읽기는 지금처럼 `app_admins`만.
- 계정 삭제 시 `on delete cascade`로 같이 삭제(지금 구조 그대로). 게스트 기록은 device_id로만 남음.
