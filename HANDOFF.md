# 0-sizer — Handoff (for a fresh thread)

A mobile-first, app-like **synth tutorial** that teaches a beginner one
module at a time. The panel ("パネル") starts as empty bays and each lesson
"realizes" a module into it via an install animation.

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
  (vitest). **Always run build + lint before committing.**
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
    `blink → active → exit`. Exit substages:
    `morph → hover → glide → seat`.
  - Sound state lifted here. **Controlled knobs**: FILTER (cutoff/res),
    LFO (rate/depth/dest), OSC2 (mix/detune), NOISE (level) — App holds
    the amt and passes `value` + `onChange` to `Knob`. PITCH/MIX (VOL/PAN)
    knobs stay uncontrolled. ENV sliders + waveform already controlled.
  - `realized: Set<FrameId>` of completed frames. `showHelp` (解説表示
    toggle), `panelPopup` (which frame's `?` help is open).
  - Install animation: per-frame data-stage-frame measurement at OK; each
    flying frame morphs → hovers → glides → seats (see "Install animation"
    below). Timing constants `BLINK_MS`, `MORPH_MS`, `HOVER_MS`, `GLIDE_MS`,
    `SEAT_MS`. `previewRef` flags single-lesson preview (◀チュートリアル).
  - Top-right: hamburger menu with **◀チュートリアル** (jump to a single
    lesson, auto-built from LESSONS) and **もう一度見る** (full replay)
    on the panel; **スキップ** during lessons. 解説表示 toggle on panel.
  - `localStorage['0sizer.tutorialDone'] === '1'` → returning users start
    at `panel` with everything realized.
  - `applyPreset(p)`: sets type/lfoDest/filterEnv immediately, then
    rAF-tweens cutoff/res/lfoRate/lfoDepth/mix/detune/noise/env over 600ms
    (easeOutCubic). Knobs follow because they're controlled.
- `src/audio/useSynth.ts` — monophonic synth, chain:
  `osc1+osc2+noise → filter(LP) → gain(amp env) → tremolo → master → pan → out`,
  plus a parallel reverb send (synthesised IR, fixed wet ~0.13).
  - **2 oscillators**: osc1 + osc2 (same waveform), `osc2.detune` is a
    constant offset (cents). LFO modulates both osc detunes.
    `osc1Gain`/`osc2Gain` cross-fade via `setMix(balance 0..1)`.
  - **User-controlled noise source**: a second BufferSource → noiseUserGain
    → filter. `setNoise(level)` 0..0.5.
  - **Filter envelope** (per-note pitch-style sweep on `filter.frequency`
    at noteOn): jumps to `base * 2^envAmt` then decays exponentially back
    to base. Set via `setFilterEnv(amtOctaves, decaySec)` (preset-only,
    not exposed as a knob yet).
  - **LFO** with 3 destination gains in parallel:
    `lfoPitchGain → osc1.detune + osc2.detune`,
    `lfoCutoffGain → filter.detune` (cents → wide audible sweep),
    `lfoAmpGain → tremolo.gain` (around 1.0). Only the selected dest has
    non-zero gain. Depth amt 0..10 is scaled per dest in `applyLfo()`.
    Set via `setLfoRate(hz)`, `setLfoDepth(amt 0..10)`, `setLfoDest(dest)`.
  - **Master**: `setMasterVol` and `setPan` (StereoPanner).
  - PEAK = 0.18 (gain ceiling). Anti-crackle noise floor still at 0.004
    direct into `gain` to keep Bluetooth alive.
  - Tiny noise floor unchanged. Resumes the AudioContext on
    visibilitychange/focus/pointerdown/noteOn(if not running).
  - Types: `EnvParams`, `LfoDest = 'pitch'|'cutoff'|'amp'`.
- `src/audio/params.ts` — shared knob-amt → audio-value maps and display
  formatters. App and `modules.tsx` both import. Includes
  `cutoffNormToHz/fmtHz`, `resAmtToQ`, `lfoRateToHz`, `lfoDepthToCents`
  (unused now but kept), `detuneAmtToCents`, `mixAmtToBalance/fmtMix`,
  `noiseAmtToLevel`, `volAmtToGain`, `panAmtToPos/fmtPan`,
  `fmtTime`, `fmtPct`.
- `src/audio/gachan.ts` — `playGachanSound` (loud GACHAN, unused now) and
  `playSeatClick` (soft KA-CHA played at install seat).
- `src/tutorial/`
  - `lessons.ts` — `FrameId = keys|wave|pitch|fine|snap|env|filter|lfo|mix|osc2|noise`,
    `LESSONS` (order: keys → wave → pitch(+fine+snap) → env → filter →
    lfo → mix → osc2 → noise), `FRAME_TITLE`, `FRAME_HELP`, `ALL_FRAMES`,
    `lessonForFrame`.
  - `modules.tsx` — `SoundCtl` interface + frame components.
    Controlled knobs (FilterFrame, LfoFrame, Osc2Frame, NoiseFrame) take
    a `value` + `onChange(amt)` pair. Uncontrolled (PitchFrame, MixFrame)
    take `onChange(mappedValue)` and do mapping inline. All accept
    `morphing` to collapse value LCD / hint during install.
    `LfoFrame` includes a 3-button destination selector.
  - `presets.ts` — `Preset` type + `PRESETS` (10 sounds: piano, organ,
    flute, strings, bass, theremin, synth lead, synth pad, chiptune,
    acid bass). Fields: type, env(ADSR), cutoff, res, lfoRate,
    lfoDepth, mixAmt, detuneAmt, noiseAmt, lfoDest, filterEnvAmt,
    filterEnvDecay. All amts in knob units (0..10 or 0..1).
  - `SynthPanel.tsx` — the panel: fixed header, **preset bar** (panel
    phase only — horizontal-scroll list of preset buttons), scrollable
    grid area, keyboard pinned at bottom. Grid has 8 columns, square
    cells (JS measures `--cell` from clientWidth, `GAP=0`).
    Unrealized cells are **empty bays** (no module ghost, just a dim
    recess). Slots get a small silkscreen `slot-label` in the corner
    for some modules.
  - `LessonStage.tsx` — spotlight overlay. Each frame has a
    `data-stage-frame` wrapper that receives the install transform
    (morph→hover→glide→seat). Two patterns for the lesson form:
    **(A) old morph pattern** (FILTER, PITCH, ENV, LFO, MIX): knobs side
    by side big, value LCD + drag hint shown, all collapse during morph.
    **(B) new "panel form enlarged" pattern** (OSC2, NOISE): the stage
    frame wears the same `slot slot-<id> filled` classes as the panel,
    just at a bigger size (via `.stage-osc2`/`.stage-noise` setting a
    fixed width + initial aspect that's a bit taller; aspect-ratio
    transitions to the panel ratio on `.stage-module.exiting`).
  - `StartScreen.tsx`, `IntroScreen.tsx`, `Popup.tsx`.
- `src/components/` — `Knob` (vertical drag, fine, snap, double-tap reset,
  configurable `tickCount`, optional `value` for controlled mode,
  `morphing` to collapse LCD+hint), `Slider` (with `snap`, relative
  track/handle so they don't drift under transform scale), `Scope`,
  `EnvGraph`, `WaveformPicker` (compact + morphing collapses label
  span), `Keyboard` (multi-octave, native non-passive touchstart
  preventDefault to kill the iOS magnifier).
- `src/styles.css` — all styling. Neutral matte-black palette,
  right-angle corners, white silkscreen, teal accent. Stage-frame
  transitions for the install animation. Slot shared layouts for
  FILTER/LFO/MIX/OSC2 (4×2 two-knob row).

## Key behaviors / decisions
- **Frames = panel cells**; lessons realize them; the install animation
  morphs/flies/seats them in.
- **Keyboard**: C3–C6, multi-octave, mono play, full-screen-width pinned
  at the bottom. C markers: ◎ home (C4) / ● ±1 oct / ・ ±2; `◎` home
  button recenters. PC keys A S D F G H J K / W E T Y U on the home
  octave. ドレミ labels follow 解説表示; black-key ♯ never shown.
- **解説表示** gates: keyboard note labels, knob value LCD/hint, the `?`
  help buttons. **ENV slider values are hidden** (variable-digit widths
  would push neighbours).
- **PITCH** value uses a 6-segment tick grid (range ±12 semitones, ticks
  every 4) and snaps to integer semitones; LCD shows ♯/♭ in teal.
- **fine** + **SNAP** are separate global toggles (each its own 2×1 module).
  Both affect every knob/slider. SNAP step is per-control (PITCH=1
  semitone, CUTOFF=0.1 of norm, RES=1, ENV=0.1s/10%, etc.).
- **Visual / aesthetic**: Erica Synths-inspired matte black hardware —
  black machined knobs with white pointer + flutes that rotate with the
  knob (light source fixed top-left), printed tick scale hugging the
  knob edge, teal LCD readouts, sharp corners everywhere. Done.
- **Install animation** (after OK):
  1. **Morph in place**: stage frame transitions to its panel form
     (FILTER/PITCH/ENV/LFO/MIX: scope/labels/LCD/hint collapse; OSC2/
     NOISE: aspect-ratio shrinks from "LCD-height" to panel ratio).
  2. **Hover** briefly (translateY -10).
  3. **Glide** slowly to the destination bay (FLIP transform).
  4. **Seat** — opacity fades, slot realises with a gentle scale settle
     and a one-shot teal "seat-glow", soft KA-CHA + light haptic.
  - The stage card's background goes transparent during exit; each
    stage-frame instead gets its own slot-like box so modules move as
    solid pieces, not floating controls.
  - At lesson start, `scrollToBay(id)` brings the target slot into view
    (deep rows like row 8 wouldn't be visible at install time otherwise).
- Mobile-first; panel is one screen with keyboard pinned and modules
  scrolling.

## Grid layout convention
Module sizes are expressed as **横×縦 (width×height)** in grid cells (each
cell = 1/8 of panel width, square). Current placement:

| Frame | W×H | grid-column | grid-row |
|---|---|---|---|
| wave   | 8×1 | 1–8 | 1   |
| env    | 4×4 | 1–4 | 2–5 |
| filter | 4×2 | 5–8 | 2–3 |
| pitch  | 2×2 | 5–6 | 4–5 |
| fine   | 2×1 | 7–8 | 4   |
| snap   | 2×1 | 7–8 | 5   |
| lfo    | 4×2 | 1–4 | 6–7 |
| mix    | 4×2 | 5–8 | 6–7 |
| osc2   | 4×2 | 1–4 | 8–9 |
| noise  | 2×2 | 5–6 | 8–9 |

Cells 7–8 row 8–9 (2×2) are free for the next module. Mocks were
removed — every slot is a real module now. Keyboard is **outside** the
grid, pinned below `.panel-scroll`. `.slot-keys.empty` is 134px so the
keyboard install lands on top of (not below) the URL bar.

## Done so far
- **9 lessons**: keyboard → waveform → PITCH(+微調整+SNAP) →
  envelope/ADSR → filter → LFO → MIX → OSC2 → NOISE.
- **Preset bar** (panel only): 10 instrument-shaped presets (piano, organ,
  flute, strings, bass, theremin, synth lead, synth pad, chiptune, acid
  bass). Selecting one tweens all knobs/sliders to that sound.
- **Erica-style visual** completed. Black plate, machined knobs, teal LCDs,
  sharp corners, no mocks left.
- **Install animation** (morph → hover → glide → seat) finalised, with
  the per-module solid box and soft KA-CHA. The earlier GACHAN-style
  burst was removed at the user's request.
- **◀チュートリアル menu**: jump to any single lesson; preview-only path
  restores `ALL_FRAMES` on commit.
- **Engine upgrades**: 2 oscillators with detune, filter envelope, light
  reverb, tremolo gain, user-controllable noise source, 3-destination LFO.

## Idea notes (not yet scheduled — keep, don't lose)
- **Two tutorial tracks**:
  - 音作り (sound design) = the current modules. In progress (currently
    extending with more standard synth knobs).
  - 曲作り (song-making) = arrange sounds over time into a song. NEW
    territory: needs a **time axis** the app lacks today — a step
    sequencer / mini piano roll, tempo (BPM), play/loop, and per-step
    use of the sound-design elements (filter sweeps, ENV, LFO, PAN…).
- **"Eternal" (永)** — the song-making track is built around one
  comprehensive song titled *Eternal*. Metaphor: 永字八法 — the single
  kanji 永 contains all eight fundamental brush strokes, so practising
  it teaches them all. Likewise *Eternal* is one piece that exercises
  **every** song-making element, so finishing it covers everything.
  Possible visual: the strokes of 永 mapped to the melody's motion.
- **Pacing**: don't add new modules endlessly — intersperse hands-on
  "practice" between additions so it doesn't get boring.
- **Own BGM / SE**: the user composes music and wants the app's BGM/SE
  to be their own work, and to *say so in-app* ("これ作ったの自分です")
  to give players a "I could do this too" feeling. Future: a small
  credit/CTA. Keep the synthesised KA-CHA SFX for now.
- **Premium-plan visual variants**: different panel colorways.

## Likely next steps / open items
Sound-design knobs we discussed adding (in the agreed-on order, "B: one
at a time"):
1. ✅ OSC2 module (DETUNE + MIX) — done.
2. ✅ NOISE module (LEVEL) — done.
3. ✅ LFO destination selector (PITCH/CUTOFF/AMP) — done.
4. **DELAY** FX module (TIME + MIX) — next.
5. **GLIDE** (mono portamento, TIME knob) — after delay.

Bigger architectural:
- **Polyphony** (chords) — significant refactor of useSynth.
- **Sequencer / Eternal track** — see Idea notes.

Other open items:
- Filter ENV exposed as knobs (AMOUNT + DECAY) — engine supports it
  (`setFilterEnv`), still preset-only. Worth doing as a small module.
- Reverb MIX exposed as a knob — engine has fixed wet 0.13.
- Real-time oscilloscope (`AnalyserNode` replacing the preset-wave scope).
- **Panel edit mode** (post-tutorial): per-module options (e.g., ENV
  graph shown/hidden — currently always shown).
- i18n: extract strings to a dictionary for English support.
- Only test is `src/lib/notes.test.ts`. Engine has no audio tests
  (browser-only).

Code-hygiene notes:
- Visual sample lives at `?sample` (`src/sample/StyleSample.tsx`) —
  remove once it's no longer a useful reference.
- Screw styling kept in CSS (`.screw*`, unused) for possible future use.
- `KeyboardGhost` is exported but unused; `lfoDepthToCents` in
  `params.ts` is no longer used (LFO depth amt now scaled inside the
  engine per destination). Both safe to leave.

## Tutorial-form patterns (when adding a new lesson)
- **For new modules from now on, use the "panel form enlarged" pattern**
  (the OSC2 / NOISE pattern):
  - In `LessonStage.tsx`, the `data-stage-frame="<id>"` wrapper also
    carries `slot slot-<id> filled stage-<id>` classes — same styling as
    the panel, just bigger.
  - Render the module in **compact** mode with `showText` forced on for
    the lesson (so the LCD is visible while learning) and `morphing`
    bound to `exiting`.
  - Add a `.stage-<id>` rule with a fixed width and an initial taller
    aspect (so the LCD has room); add `.stage-module.exiting .stage-<id>`
    with the panel-cell aspect (so OK collapses the LCD area away).
  - Use `transition: transform 0.44s ..., aspect-ratio 0.4s ...` on the
    `.stage-<id>` rule.
- For older lessons (FILTER/LFO/MIX/PITCH/ENV) we still use the original
  morph (big knobs side by side, LCD/hint collapse). Don't retrofit
  unless asked.

## Working style the user likes
- **Don't explain synth concepts in chat — teach in the app instead.** (See
  "How the user learns — READ FIRST" up top. This is the single most
  important thing to honor.)
- Discuss/confirm before big changes; they often ask "is this weird?" and
  want prior-art / honest pushback. Keep replies concrete.
- Do NOT use the AskUserQuestion multiple-choice picker — it hides the chat
  text. Ask in plain text.
- Small, verifiable increments; commit + push each round; summarise what
  to check on-device.
- **Branch/deploy**: develop directly on `main` (push = auto-deploy). No
  PRs for this project (they cap PR usage elsewhere and this is a hobby
  app). `npm install` first in a fresh container.
- The user iterates fast and reacts visually. Don't over-design — ship a
  first pass, get feedback, refine.
