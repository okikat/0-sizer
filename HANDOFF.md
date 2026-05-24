# 0-sizer — Handoff (for a fresh thread)

A mobile-first, app-like **synth tutorial** that teaches a beginner one
module at a time. The panel ("パネル") starts as a faint ghost of the full
synth and each lesson "realizes" a module into it.

Owner speaks Japanese — reply in Japanese. They test on a phone via the
deployed URL; the cloud agent **cannot run a browser or hear audio**, so
state plainly when something needs on-device verification.

## Stack / run / deploy
- Vite + React 19 + TypeScript, Web Audio API. No router, no extra deps.
- Commands: `npm run dev`, `npm run build`, `npm run lint`, `npm test`
  (vitest). **Always run build + lint + test before committing.**
- Deploy: GitHub Pages via `.github/workflows/deploy.yml` on push to
  `main`. `vite.config.ts` `base: '/0-sizer/'`. Live URL:
  `https://okikat.github.io/0-sizer/` (same URL on mobile). Pages build
  takes ~1–2 min; mobile caches aggressively (hard-reload to verify).
- **Develop on `main`** (the whole project has; the user deploys from it).
- GitHub: use `mcp__github__*` tools (no `gh`). Repo scope: `okikat/0-sizer`.
  Do NOT open a PR unless asked. Commit messages: no model identifiers.

## Architecture
- `src/App.tsx` — top-level state machine.
  - Phases: `start → intro → ghost → lesson → panel`. Lesson sub-stages:
    `blink → active → exit`.
  - Sound state lifted here: `type` (waveform), `fine` (global fine mode),
    `keyHeld` (drives Scope `playing`), `env` (ADSR). Builds a `SoundCtl`
    object passed down.
  - `realized: Set<FrameId>` of completed frames. `showHelp` (解説表示
    toggle), `panelPopup` (which frame's `?` help is open), `flight` (FLIP).
  - **FLIP**: on OK, measure stage module rect + destination `[data-slot]`
    rect, animate the stage module into the slot; backdrop fades for a
    seamless settle. Timing constants `BLINK_MS`, `EXIT_MS`.
  - Top-right: hamburger menu (もう一度見る / スキップ) + 解説表示 toggle.
  - `localStorage['0sizer.tutorialDone'] === '1'` → returning users start
    at `panel` with everything realized.
- `src/audio/useSynth.ts` — monophonic synth: osc → **lowpass filter** →
  gain (envelope) → out; tiny noise floor mixed straight into gain
  (anti-crackle on Bluetooth, unfiltered). API:
  `noteOn/noteOff/setWaveform/setTune/setEnv/setCutoff/setResonance`. Filter
  defaults fully open (16k / Q 0.7) so untouched sound is unchanged. ADSR
  scheduled with linear ramps from the current value. Resumes the
  AudioContext on visibilitychange/focus/pointerdown (sleep-resume fix).
  `EnvParams` type.
- `src/tutorial/`
  - `lessons.ts` — `FrameId = keys|wave|pitch|fine|env|filter`, `LESSONS`
    (order: keys → wave → pitch → env → filter; a lesson `realizes` 1+
    frames; pitch realizes pitch+fine), `FRAME_TITLE`, `FRAME_HELP`
    (per-frame `?` text), `ALL_FRAMES`, `lessonForFrame`.
  - `modules.tsx` — `SoundCtl` + frame components: `WaveFrame`
    (Scope+picker, collapsible scope), `PitchFrame` (Knob), `FineFrame`
    (hardware-style toggle = global fine), `EnvModule` (EnvGraph + 4
    Sliders, collapsible graph), `FilterFrame` (CUTOFF + RES Knobs;
    cutoff knob is 0..1 mapped log to 80Hz–16kHz, RES is 0..10 mapped to
    Q 0.7–12), `KeyboardModule`, `KeyboardGhost` (static, listener-free,
    for ghosts).
  - `SynthPanel.tsx` — the panel: fixed header, **scrollable module area**
    (`.panel-scroll`), **keyboard pinned at bottom**. Board is a dense grid:
    ENV (wide col) beside PITCH+微調整 (`.side-col`), mocks span below.
    `Slot` renders real components dimmed when not realized (ghost) +
    `?` help when realized & showHelp.
  - `LessonStage.tsx` — spotlight overlay: the lesson's frame big + a
    play-along keyboard (non-keyboard lessons) + OK + Popup + FLIP.
  - `StartScreen.tsx`, `IntroScreen.tsx` (lines fade/rise in), `Popup.tsx`,
    `mock.tsx` (decorative FILTER/LFO/MIX cells — purely visual).
- `src/components/` — `Knob` (vertical drag, fine, double-tap reset,
  size-proportional geometry, LCD value), `Slider` (vertical, wide touch
  hit), `Scope`, `EnvGraph`, `WaveformPicker` (compact = icon only),
  `Keyboard` (see below).
- `src/styles.css` — all styling. Dark theme vars (`--accent` teal,
  `--accent2` orange). Global `* { user-select:none; -webkit-touch-callout:
  none }` (popups re-enabled) to kill the iOS long-press magnifier.
  `prefers-reduced-motion` respected. Touch vs mouse via
  `@media (hover:none) and (pointer:coarse)`.

## Key behaviors / decisions
- **Frames = panel cells**; lessons realize them; FLIP settles them in.
- **Keyboard**: C3–C6, multi-octave. Keys are play-only; horizontal nav is
  the bottom overview bar (drag) — avoids play/scroll conflict. C markers
  at key top: ◎ home (C4) / ● ±1 oct / ・ ±2; `◎` home button recenters.
  PC keys (A S D F G H J K / W E T Y U) map to the home octave only.
  Note labels (ドレミ/♯) follow 解説表示.
- **解説表示** gates: keyboard note labels, knob value/hint, the `?`
  help buttons. **ENV slider values are always shown** (LCD chips).
- **PITCH** value shows ♯/♭ in teal (instrument LCD); no sub-label.
- **fine** is a single global mode (any Knob/Slider obeys it); the 微調整
  frame is independent so it can be removed later.
- Mobile-first; panel is one screen with keyboard pinned and knobs
  scrolling.

## Done so far
5 real lessons (keyboard, waveform, PITCH+微調整, envelope/ADSR, **filter**)
+ a dense scrollable panel with decorative mocks (LFO, MIX). Cinematic
onboarding (start, intro, ghost preview, per-module spotlight with popup/?,
FLIP settle).

## Likely next steps / open items
- The user's vision: a **"パネル編集モード"** — a grid where modules can be
  freely resized/rearranged within constraints, plus pin scroll-vs-fixed.
  We've done the near-term *fixed* dense grid; the interactive editor is the
  bigger future feature (drag/resize/persist).
- FILTER (lowpass) is now real. Possible follow-ups: a filter ENV/keytrack,
  or another filter type — but only if the beginner asks. Next mock to
  realize would be **LFO** (a `setInterval`/`OscillatorNode` modulating
  pitch or cutoff) or **MIX** (master VOL/PAN).
- **Verify on device**: the FILTER lesson (CUTOFF should clearly muffle the
  tone, RES should add the "ミョーン" peak), plus the earlier sleep-resume
  audio fix and keyboard C-marker visibility.
- Minor: `mock.tsx` still has an unused `slider` widget kind.
- Only test is `src/lib/notes.test.ts`.

## Working style the user likes
- **The user has never touched a synth.** Their method: have the AI build the
  app, then learn *from the app itself* as a true beginner, and feed back
  what's confusing. So the **in-app copy is the teaching surface** — write
  the lesson popups (`LESSONS[].popup`) and `?` help (`FRAME_HELP`) in plain,
  friendly Japanese with everyday analogies, no jargon. They often will NOT
  read long chat explanations of synth concepts on purpose (they want to meet
  each idea fresh inside the app). Don't spoil concepts in chat.
- Discuss/confirm before big changes; they often ask "is this weird?" and
  want prior-art / honest pushback. Keep replies concrete.
- Do NOT use the AskUserQuestion multiple-choice picker — it hides the chat
  text. Ask in plain text.
- Small, verifiable increments; commit + push each round; summarize what to
  check on-device.
- **Branch/deploy**: develop directly on `main` (push = auto-deploy). No PRs
  for this project (they cap PR usage elsewhere and this is a hobby app, so
  no review trail needed). `npm install` first in a fresh container.
