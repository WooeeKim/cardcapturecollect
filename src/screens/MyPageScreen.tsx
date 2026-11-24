import { useState } from 'react'
import backIcon from '../assets/proto/v2/back40.svg'
import boxSvg from '../assets/proto/v2/mp-box.svg'
import personSvg from '../assets/proto/v2/mp-person.svg'
import lineImg from '../assets/proto/v2/mp-line.svg'
import underline from '../assets/proto/v2/mp-underline.svg'
import toggleOn from '../assets/proto/v2/mp-toggle.svg'
import pill from '../assets/proto/v2/tl-edit.svg'
import { FeedbackSheet, LoginSheet, PasswordSheet, Sheet } from '../components/LoginSheet'
import { setSound, soundEnabled } from '../lib/sound'
import { ToggleIcon } from '../components/drawIcons'
import { Bottom, LangButton, Popup, type PopupAction } from '../components/ui'
import { PillBack, PillFinish } from '../components/v2'
import { type User } from '../lib/auth'
import { tr } from '../lib/i18n'
import { useWide } from '../lib/wide'
import { syncPush } from '../lib/push'
import type { Card } from '../lib/store'

// My Page (Figma mypage-login 830:814 / mypage-logout 838:2079 / edit 838:2365).
const NOTIFY = 'subwayseal.notify'
const readNotify = () => {
  try {
    return localStorage.getItem(NOTIFY) !== 'off'
  } catch {
    return true
  }
}

export default function MyPageScreen({
  user,
  profile,
  cards,
  onPickProfile,
  cardCount,
  townCount,
  since,
  nickname,
  intro,
  onProfile,
  onBack,
  onInterview,
  onLogin,
  onLogout,
  onReset,
  onTutorial,
  onLoadingTest,
  canReset,
}: {
  user: User | null
  canReset: boolean // app_admins only (also shows Replay tutorial / Loading screen test)
  profile: Card | null // profile picture card (store.profileCard)
  cards: Card[] // newest first, to pick the profile picture from
  onPickProfile: (cardId: string) => void
  cardCount: number
  townCount: number
  since: string // YY.MM.DD
  nickname: string
  intro: string
  onProfile: (nickname: string, intro: string) => void
  onBack: () => void
  onInterview: () => void
  onLogin: (user: User) => unknown
  onLogout: () => void
  onReset: () => void
  onTutorial: () => void
  onLoadingTest: () => void
}) {
  // iPad sideways (Figma iPad · mypage 1024:2825): profile box on the left, settings list on the right
  const wide = useWide()
  const [sheet, setSheet] = useState<'login' | 'password' | 'feedback' | 'picture' | null>(null)
  const [popup, setPopup] = useState<{ message: string; actions: PopupAction[] } | null>(null)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(nickname)
  const [about, setAbout] = useState(intro)
  const [notify, setNotify] = useState(readNotify)
  const [sound, setSoundOn] = useState(soundEnabled)

  const gotIt = (message: string) => setPopup({ message, actions: [{ label: tr('Got it!'), onClick: () => setPopup(null) }] })
  const startEdit = () => {
    setName(nickname)
    setAbout(intro)
    setEditing(true)
  }
  const toggleNotify = () => {
    const next = !notify
    setNotify(next)
    try {
      localStorage.setItem(NOTIFY, next ? 'on' : 'off')
    } catch {
      /* private mode */
    }
    // turning it on before the phone was asked: ask now (this tap counts as the user's gesture on iPhone)
    if (next && typeof Notification !== 'undefined' && Notification.permission === 'default') Notification.requestPermission().then(syncPush, () => {})
    else syncPush()
  }
  // list rows: Figma pitch 59.8, first at 359
  const ROW0 = 359
  const PITCH = 59.8
  const toggle = (on: boolean) => (on ? <img src={toggleOn} alt="" className="h-[26px] w-[49px]" /> : <span className="block h-[23px] w-[46px]"><ToggleIcon on={false} /></span>)
  type Row = { label: string; tone?: string; soon?: boolean; right?: React.ReactNode; onClick?: () => void; disabled?: boolean }
  const rows: Row[] = ([
    {
      label: tr('Notification setting'),
      onClick: toggleNotify,
      right: toggle(notify),
    },
    // sound on/off: developer accounts only (regular accounts have no sound for now)
    canReset && { label: tr('Sound effects'), onClick: () => { setSound(!sound); setSoundOn(!sound) }, right: toggle(sound) },
    { label: tr('Subway-TI'), onClick: onInterview },
    { label: tr('Notice'), onClick: () => gotIt(tr('Notices are coming soon.')) },
    { label: tr('FAQ'), onClick: () => gotIt(tr('FAQ is coming soon.')) },
    { label: tr('Feedback'), onClick: () => setSheet('feedback') },
    canReset && {
      // testing helper for admins only: wipes towns, cards, nickname and intro on this device / account
      label: tr('Reset (test)'),
      onClick: () =>
        setPopup({
          message: tr("Reset all your towns and everyone in them?\nThis can't be undone."),
          actions: [
            { label: tr('Reset'), onClick: () => { setPopup(null); onReset() } },
            { label: tr('Cancel'), onClick: () => setPopup(null) },
          ],
        }),
    },
    // admin testing helpers, same rule as Reset
    canReset && { label: tr('Replay tutorial (test)'), onClick: onTutorial },
    canReset && { label: tr('Loading screen (test)'), onClick: onLoadingTest },
    { label: tr('Neighbors'), tone: 'warm-a8 text-[#7e7e7e]', soon: true },
    { label: tr('Developers'), tone: 'warm-a8 text-[#7e7e7e]', soon: true },
    // account deletion is blocked on purpose for the test period — the row stays, greyed out, with no action
    { label: tr('Delete Account'), tone: 'warm-a8 text-[#b8b8b8]', disabled: true },
  ] as (Row | false)[]).filter((r): r is Row => !!r)

  return (
    <div className="mp-page relative h-full overflow-hidden bg-[#f9f9f9] font-hand">
      <button aria-label={tr('Back')} onClick={onBack} className={`absolute z-10 size-[40px] ${wide ? 'top-[30px] left-[40px]' : 'top-[77px] left-[24px]'}`}>
        <img src={backIcon} alt="" className="size-full" />
      </button>
      <p className={`absolute left-1/2 -translate-x-1/2 text-[24px] leading-[1.3] ${wide ? 'top-[36px]' : 'top-[88px]'}`}>{tr('My Page')}</p>
      <LangButton className={`z-10 ${wide ? 'top-[30px] left-[1104px]' : 'top-[84px] left-[333px]'}`} />

      {/* settings list (scrolls on short phones; iPad sideways: the right column, first row at y 140) */}
      <div className={`absolute overflow-y-auto [scrollbar-width:none] ${wide ? 'w-[402px]' : 'inset-x-0'}`} style={wide ? { left: 623, top: 121, bottom: 130 } : { top: 340, bottom: 99 }}>
        <div className="relative" style={{ height: ROW0 - 340 + rows.length * PITCH + 10 }}>
          {rows.map((r, i) => {
            const top = ROW0 - 340 + i * PITCH
            const Tag = r.onClick ? 'button' : 'div'
            return (
              <div key={r.label}>
                <Tag
                  onClick={r.onClick}
                  aria-disabled={r.disabled || undefined}
                  className={`absolute left-[37px] flex h-[44px] w-[328px] items-center justify-between text-left text-[24px] leading-[normal] ${r.tone ?? ''} ${r.disabled ? 'opacity-60' : ''}`}
                  style={{ top: top - 6 }}
                >
                  {r.label}
                  {r.soon && <span className="text-[14px]">{tr('Coming Soon')}</span>}
                  {r.right}
                </Tag>
                {/* light grey hand-drawn divider (Figma 06 마이페이지, Vector 540–545) */}
                {i < rows.length - 1 && <img src={lineImg} alt="" className="pointer-events-none absolute left-[34px] h-[3.5px] w-[333.8px] max-w-none" style={{ top: top + 42.5 }} />}
              </div>
            )
          })}
        </div>
      </div>

      {/* bottom: log out / log in */}
      <Bottom>
        <button style={wide ? { left: 829 } : undefined} onClick={() => (user ? setPopup({ message: tr('Log out?'), actions: [{ label: tr('Log out'), onClick: () => { setPopup(null); onLogout() } }, { label: tr('Cancel'), onClick: () => setPopup(null) }] }) : setSheet('login'))} className="absolute top-[785px] left-1/2 -translate-x-1/2 px-[10px] pb-[8px] text-[24px] leading-[normal] whitespace-nowrap text-[#8e8e8e]">
          {tr(user ? 'Log out' : 'Log in/Sign up')}
          <img src={underline} alt="" className="absolute bottom-[2px] left-1/2 h-[3px] w-[calc(100%-12px)] max-w-none -translate-x-1/2" />
        </button>
      </Bottom>

      {/* dim behind the box while editing */}
      {editing && <div className="animate-fade-in absolute inset-0 z-20 bg-black/35" />}

      {/* profile box */}
      <div className={`absolute w-[370px] transition-[height] duration-300 ${wide ? 'top-[140px] left-[79px]' : 'top-[149px] left-[16px]'} ${editing ? 'z-30 h-[318px]' : 'h-[171px]'}`}>
        <img src={boxSvg} alt="" className="absolute inset-0 size-full" />
        <button
          disabled={!editing || !cards.length}
          onClick={() => setSheet('picture')}
          aria-label={tr('Change profile picture')}
          className="absolute top-[20px] left-[21px] flex size-[70px] items-end justify-center overflow-hidden rounded-full border-[2.33px] border-[#2e2e2e] bg-white"
        >
          {profile ? <img src={profile.thumb || profile.image} alt="" className="size-full object-cover" /> : <img src={personSvg} alt="" className="mb-[-3px] h-[57.6px] w-[37.3px]" />}
          {editing && !!cards.length && <span className="absolute inset-x-0 bottom-0 bg-black/55 py-[1px] text-center text-[12px] text-white">{tr('Change')}</span>}
        </button>
        {editing ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
            placeholder={tr('Nickname')}
            aria-label={tr('Nickname')}
            className="absolute top-[14px] left-[112px] w-[230px] rounded-[6px] border-2 border-dashed border-[#707070] bg-white/70 px-[6px] text-[24px] leading-[1.3] outline-none placeholder:text-[#9a9a9a]"
          />
        ) : (
          <p className={`absolute top-[17px] left-[112px] w-[240px] truncate text-[24px] leading-[normal] ${nickname ? '' : 'text-[#9a9a9a]'}`}>{nickname || tr('No Profile')}</p>
        )}
        <p className="warm-75 absolute top-[54px] left-[112px] text-[14px] leading-[normal] text-[#464646]">
          {tr(cardCount === 1 ? '{n} Person' : '{n} People', { n: cardCount })}
        </p>
        <p className="warm-75 absolute top-[72px] left-[112px] text-[14px] leading-[normal] text-[#464646]">
          {tr(townCount === 1 ? '{n} Town' : '{n} Towns', { n: townCount })}
        </p>
        {user && <p className="absolute top-[54px] right-[18px] max-w-[120px] truncate text-[12px] text-[#9a9a9a]">{user.username}</p>}
        {editing ? (
          <>
            <textarea
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              maxLength={120}
              rows={4}
              placeholder={tr('Write your introduction...')}
              aria-label={tr('Introduction')}
              className="absolute top-[103px] left-[21px] h-[110px] w-[328px] resize-none rounded-[8px] border-2 border-dashed border-[#707070] bg-white/70 px-[8px] py-[6px] text-[17px] leading-[1.2] outline-none placeholder:text-[#c9c9c9]"
            />
            {user && (
              <button onClick={() => setSheet('password')} className="absolute top-[222px] left-[23px] text-[15px] text-[#686868] underline underline-offset-2">
                {tr('Change password')}
              </button>
            )}
            <button
              onClick={() => setEditing(false)}
              className="absolute top-[290px] left-[30px] flex h-[52px] w-[108px] items-center justify-center"
            >
              <span className="pill-mid absolute inset-0 rotate-[-178.73deg]">
                <PillFinish />
              </span>
              <span className="relative text-[22px] leading-[1.1] text-[#686868]">{tr('Discard')}</span>
            </button>
            <button
              onClick={() => {
                onProfile(name.trim(), about.trim())
                setEditing(false)
              }}
              className="absolute top-[289px] left-[244px] flex h-[54px] w-[110px] items-center justify-center"
            >
              <span className="pill-grey absolute inset-0 rotate-[-177.79deg]">
                <PillBack />
              </span>
              <span className="relative text-[22px] leading-[1.1]">{tr('Save')}</span>
            </button>
          </>
        ) : (
          <>
            <p className={`absolute top-[105px] left-[21px] line-clamp-1 w-[283px] text-[17px] leading-[1.2] break-words ${intro ? 'text-[#3d3d3d]' : 'text-[#c9c9c9]'}`}>{intro || tr('Write your introduction...')}</p>
            <p className="absolute top-[133px] left-[21px] text-[14px] leading-[1.1] text-[#8e8e8e]">{tr('Since {date}', { date: since })}</p>
            <button onClick={startEdit} className="absolute top-[150px] left-[286px] flex h-[41px] w-[69px] items-center justify-center" aria-label={tr('Edit profile')}>
              <img src={pill} alt="" className="absolute inset-[-2.5%_-1.5%] size-[calc(100%+3%)] max-w-none" />
              <span className="relative text-[20px] leading-[1.3]">{tr('Edit')}</span>
            </button>
          </>
        )}
      </div>

      {sheet === 'login' && (
        <LoginSheet
          onClose={() => setSheet(null)}
          onDone={(u) => {
            setSheet(null)
            return onLogin(u)
          }}
        />
      )}
      {sheet === 'password' && user && <PasswordSheet user={user} onClose={() => setSheet(null)} />}
      {sheet === 'feedback' && <FeedbackSheet onClose={() => setSheet(null)} />}
      {sheet === 'picture' && (
        <Sheet onClose={() => setSheet(null)}>
          <p className="text-center text-[24px] leading-[1.2]">{tr('Profile picture')}</p>
          <p className="mt-[6px] text-center text-[16px] text-[#555]">{tr('Pick one of your people.')}</p>
          {/* 4 per row, scrolls down; the current picture first. p-[6px] leaves room for its outline */}
          <div className="mt-[16px] grid max-h-[360px] grid-cols-4 gap-[10px] overflow-y-auto p-[6px]">
            {[...cards].sort((a, b) => Number(b.id === profile?.id) - Number(a.id === profile?.id)).map((c) => (
              <button
                key={c.id}
                aria-label={c.nickname || c.serial}
                aria-pressed={profile?.id === c.id}
                onClick={() => {
                  onPickProfile(c.id)
                  setSheet(null)
                }}
                className={`aspect-square overflow-hidden rounded-full border-[2.33px] bg-white ${profile?.id === c.id ? 'border-[#2e2e2e] outline-2 outline-offset-2 outline-[#2e2e2e]' : 'border-[#b5b5b5]'}`}
              >
                <img src={c.thumb || c.image} alt="" className="size-full object-cover" />
              </button>
            ))}
          </div>
        </Sheet>
      )}
      {popup && <Popup message={popup.message} actions={popup.actions} />}
    </div>
  )
}
