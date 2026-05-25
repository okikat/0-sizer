# 0-sizer — Handoff (for a fresh thread)

A mobile-first, app-like **synth tutorial** that teaches a beginner one
module at a time. The panel ("パネル") starts as a faint ghost of the full
synth and each lesson "realizes" a module into it.

Owner speaks Japanese — reply in Japanese. They test on a phone via the
deployed URL; the cloud agent **cannot run a browser or hear audio**, so
state plainly when something needs on-device verification.

## ⚠️ How the user learns — READ FIRST
**The user has never touched a synth, and that is the whole point.** Their
method: have the AI build the app, then learn each concept *fresh, from the
app itself*, as a real first-time beginner — and feed back whatever is
confusing so it gets fixed in the app.

What this means for you:
- **Teach inside the app, not in chat.** The teaching surface is the in-app
  copy: lesson popups (`LESSONS[].popup`) and the `?` help (`FRAME_HELP`).
  Put real care there — plain, friendly Japanese, everyday analogies, no
  jargon, no English term without a gloss.
- **Do NOT explain synth concepts in chat.** When you add/change a module,
  do not write a chat tutorial on what a filter / envelope / waveform "is".
  The user deliberately avoids reading those — they want to meet each idea
  for the first time *in the app*, with a clear head. Explaining in chat
  spoils that and is unwanted.
- Chat is for plans, decisions, trade-offs, honest pushback, and "here's
  what to check on device" — not for teaching the synth itself.
- If a concept is hard to grasp, the fix is **better in-app copy**, not a
  longer chat message.

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

## Grid layout convention
Module sizes are expressed as **横×縦 (width×height)** in grid cells (each
cell = 1/8 of panel width, square). Current placement:

| Frame / mock | W×H | grid-column | grid-row |
|---|---|---|---|
| wave | 8×1 | 1–8 | 1 |
| env | 4×4 | 1–4 | 2–5 |
| filter | 4×2 | 5–8 | 2–3 |
| pitch | 2×2 | 5–6 | 4–5 |
| fine | 2×2 | 7–8 | 4–5 |
| mock LFO | 4×2 | 1–4 | 6–7 |
| mock MIX | 4×2 | 5–8 | 6–7 |

Keyboard is **outside** the grid, pinned below `.panel-scroll`.

## Visual design (NEXT to implement)
**Erica Synths-inspired** physical look — "っぽく" only, not a copy.
Reference: Erica Synths Black series. User chose this style because Hirasawa
Susumu uses the brand; teal accent is already there and stays.

Palette:
- Panel body: **matte black** (`#0f1114` or similar near-black)
- Labels / text: **white silkscreen** style (clean, no serifs, generous
  letter-spacing)
- Knob body: dark/black; indicator line & active arc: **teal** (current
  `#5ad1c4` or close)
- Tick marks: white/grey, minimal
- Active / live elements (held keys, LCD readout glow): teal
- Sub / inactive text: mid-grey

Style keywords: **minimal**, hardware-physical, slight matte texture or
shadow (no skeuomorphic shine), no gradients on panel body.

Future (not now): premium plan visual variants — different panel colorways.

## Assembly animation (NEXT after visual polish)
Dramatic "GACHAN!" effect when a module settles into the panel after OK:

1. Module hovers after OK → brief pull-back / scale-up anticipation
2. **Slam** into slot — hard, satisfying
3. On impact:
   - Shockwave ring radiates from slot
   - Subtle screen shake (1–2 frames)
   - Synthesized "KA-CHAK" sound (short metallic click — Web Audio,
     no asset files)
   - Haptics if available (`navigator.vibrate`)
4. Ghost connector/terminal hints visible behind empty slots; they
   **light up** (teal pulse) when a module connects
5. Reduce-motion: skip shake/sound, keep a quick scale-pop only

The current FLIP is the structural foundation; wrap it with this layer.

## Done so far
5 real lessons (keyboard, waveform, PITCH+微調整, envelope/ADSR, **filter**)
+ a dense scrollable panel with decorative mocks (LFO, MIX). Cinematic
onboarding (start, intro, ghost preview, per-module spotlight with popup/?,
FLIP settle). 8-col square-cell responsive grid.

## Idea notes (not yet scheduled — keep, don't lose)
- **Two tutorial tracks**:
  - 音作り (sound design) = the current 7 modules ("how to shape one sound"). Done.
  - 曲作り (song-making) = arrange sounds over time into a song. NEW territory:
    needs a **time axis** the app lacks today — a step sequencer / mini piano
    roll, tempo (BPM), play/loop, and per-step use of the sound-design elements
    (filter sweeps, ENV, LFO, PAN…).
- **"Eternal" (永)** — the song-making track is built around one comprehensive
  song titled *Eternal*. Metaphor: 永字八法 — the single kanji 永 contains all
  eight fundamental brush strokes, so practising it teaches them all. Likewise
  *Eternal* is one piece that exercises **every** song-making element, so
  finishing it covers everything. Possible visual: the strokes of 永 mapped to
  the melody's motion.
- **Pacing**: don't add new modules endlessly — intersperse hands-on "practice"
  (like the sound-design lessons) between additions so it doesn't get boring.
- **Presets (doing first)**: a list of preset-sound buttons. Selecting one moves
  the knobs/sliders to that sound's positions (animated), visually linking
  presets ↔ sound design. Good scaffolding so beginners aren't told "now make a
  sound" from a blank slate.

## Likely next steps / open items
1. Real-time oscilloscope: replace preset-wave scope with an `AnalyserNode`
   showing the actual audio output. User said "あってもいい" — future.
2. **Panel edit mode** (post-tutorial): let the user choose options per module,
   e.g. ENV graph shown/hidden (the toggle was removed; default is shown).
   Possibly drag/resize/rearrange later.
3. **Own BGM / SE** (user's concept): the user composes music and wants the
   app's BGM and sound effects to be their own work, and to *say so in-app*
   ("これ作ったの自分です") to give players a "I could do this too" feeling.
   Future: a small credit/CTA. Keep the synthesised gachan SFX for now.
4. i18n: extract strings to a dictionary for future English support.
   Do this the next time you touch any copy.
5. Next lesson candidates (only if user asks): LFO (OscillatorNode modulating
   pitch/cutoff), MIX (master VOL/PAN). The mock sections show these.
- Visual sample lives at `?sample` (`src/sample/StyleSample.tsx`) — remove once
  the real panel fully matches and it's no longer a useful reference.
- Screw styling kept in CSS (`.screw*`, unused) for possible future use.
- Minor: `mock.tsx` still has an unused `slider` widget kind; `.frame-toggle`
  and `KeyboardGhost` are now unused too.
- Only test is `src/lib/notes.test.ts`.

## Working style the user likes
- **Don't explain synth concepts in chat — teach in the app instead.** (See
  "How the user learns — READ FIRST" up top. This is the single most
  important thing to honor.)
- Discuss/confirm before big changes; they often ask "is this weird?" and
  want prior-art / honest pushback. Keep replies concrete.
- Do NOT use the AskUserQuestion multiple-choice picker — it hides the chat
  text. Ask in plain text.
- Small, verifiable increments; commit + push each round; summarize what to
  check on-device.
- **Branch/deploy**: develop directly on `main` (push = auto-deploy). No PRs
  for this project (they cap PR usage elsewhere and this is a hobby app, so
  no review trail needed). `npm install` first in a fresh container.
