-- App event log v2 (docs/logging-plan.md, step 1): every event knows its app session, its order in that
-- session and the screen it happened on, so admin → Stats can rebuild time in the app / per screen.
-- Run once in Supabase → SQL Editor, after 009_app_events.sql.
-- Until this runs the app still logs: the three values ride inside data as _as / _seq / _scr.
--
-- New events (src/lib/events.ts):
--   app_open (data: kind cold|resume, version, lang, w, h, pwa, ua, notify) · app_hide · app_show (away_ms) · app_close
--   heartbeat every 30 s while visible (data.idle = no touch for 60 s) · screen_view (data.from)
--   js_error / promise_error
--   card screen: stroke (tool, color, size, points, ms, len) · tool_pick · size_pick · color_pick · undo · redo · fit
--                exit now has data.stage (draw|memo|confirm) and data.strokes

alter table public.app_events add column if not exists app_session text;
alter table public.app_events add column if not exists seq int;
alter table public.app_events add column if not exists screen text;

create index if not exists app_events_app_session on public.app_events (app_session, seq);
create index if not exists app_events_user_at on public.app_events (user_id, at);
create index if not exists app_events_device_at on public.app_events (device_id, at);
