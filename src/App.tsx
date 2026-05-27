import { useCallback, useEffect, useRef, useState } from 'react'
import { useSynth, type EnvParams, type LfoDest } from './audio/useSynth'
import { playSeatClick } from './audio/gachan'
import { cutoffNormToHz, resAmtToQ, lfoRateToHz, detuneAmtToCents, mixAmtToBalance, noiseAmtToLevel, delayTimeAmtToSec, delayMixAmtToLevel, reverbMixAmtToLevel, glideAmtToTau, fenvAmtToOctaves, fenvDecayAmtToSec, volAmtToGain, panAmtToPos } from './audio/params'
import { LESSONS, ALL_FRAMES, FRAME_HELP, FRAME_TITLE, type FrameId } from './tutorial/lessons'
import { PRESETS, type Preset } from './tutorial/presets'
import type { SoundCtl } from './tutorial/modules'
import { StartScreen } from './tutorial/StartScreen'
import { IntroScreen } from './tutorial/IntroScreen'
import { SynthPanel, type PanelTab } from './tutorial/SynthPanel'
import { LessonStage, type ExitPhase, type FrameFlight } from './tutorial/LessonStage'
import { Popup } from './tutorial/Popup'
import { PresetModal } from './tutorial/PresetModal'
import { SeqPanel } from './tutorial/SeqPanel'
import { SEQ_STEPS, SEQ_PITCHES, SEQ_BPM_MIN, SEQ_BPM_MAX, SEQ_SWING_MIN, SEQ_SWING_MAX, cellKey as seqCellKey } from './tutorial/seqConst'

type Phase = 'start' | 'intro' | 'ghost' | 'lesson' | 'panel'
type Stage = 'blink' | 'active' | 'exit'

const DONE_KEY = '0sizer.tutorialDone'
const SEQ_PATTERNS_KEY = '0sizer.seqPatterns' // 配列：[Track1, Track2]
const SEQ_PATTERN_LEGACY_KEY = '0sizer.seqPattern' // v0.1 単トラック時代の救出用
const SEQ_BPM_KEY = '0sizer.seqBpm'
const SEQ_SWING_KEY = '0sizer.seqSwing'
const BLINK_MS = 1150
// インストール演出：その場で最終形へモーフ → 少し浮く → ゆっくり定位置へ → 着座。
const MORPH_MS = 460 // パネル収まり後の形へ作り替え（WAVEは計器が畳まれる）＋暗幕フェード
const HOVER_MS = 340 // 定位置の少し上で浮く
const GLIDE_MS = 760 // ゆっくり定位置へ
const SEAT_MS = 420 // 着座（カチャ＋ごく薄い光）
const EXIT_MS = MORPH_MS + HOVER_MS + GLIDE_MS + SEAT_MS

const TRACK_COUNT = 2

/** 1 トラック分の「音作り」全パラメータ。マルチトラックでこれをトラック数ぶん持つ。 */
interface SoundState {
  type: OscillatorType
  env: EnvParams
  cutoff: number     // 0〜1
  res: number        // 0〜10
  lfoRate: number    // 0〜10
  lfoDepth: number   // 0〜10
  lfoDest: LfoDest
  detune: number     // 0〜10
  mix: number        // 0〜10（OSC2 ミックスバランス）
  noise: number      // 0〜10
  delayTime: number  // 0〜10
  delayMix: number   // 0〜10
  glide: number      // 0〜10
  fenvAmt: number    // 0〜10
  fenvDecay: number  // 0〜10
  reverb: number     // 0〜10
  vol: number        // 0〜10（マスター音量）
  pan: number        // -5〜5（定位）
}

const DEFAULT_SOUND: SoundState = {
  type: 'sine',
  env: { attack: 0.01, decay: 0.2, sustain: 0.7, release: 0.3 },
  cutoff: 1,
  res: 0,
  lfoRate: 3,
  lfoDepth: 0,
  lfoDest: 'pitch',
  detune: 0,
  mix: 5,
  noise: 0,
  delayTime: 3,
  delayMix: 0,
  glide: 0,
  fenvAmt: 0,
  fenvDecay: 3,
  reverb: 3,
  vol: 10,
  pan: 0,
}

/** トラック毎の音色をエンジンに反映する（保存値→実パラメータ変換）。
 *  トラック切替時とプリセット適用時に呼ぶ。SEQ 再生中でも安全。 */
function pushSoundToEngine(engine: ReturnType<typeof useSynth>, s: SoundState) {
  engine.setWaveform(s.type)
  engine.setEnv(s.env)
  engine.setCutoff(cutoffNormToHz(s.cutoff))
  engine.setResonance(resAmtToQ(s.res))
  engine.setLfoRate(lfoRateToHz(s.lfoRate))
  engine.setLfoDepth(s.lfoDepth)
  engine.setLfoDest(s.lfoDest)
  engine.setDetune(detuneAmtToCents(s.detune))
  engine.setMix(mixAmtToBalance(s.mix))
  engine.setNoise(noiseAmtToLevel(s.noise))
  engine.setDelayTime(delayTimeAmtToSec(s.delayTime))
  engine.setDelayMix(delayMixAmtToLevel(s.delayMix))
  engine.setGlideTime(glideAmtToTau(s.glide))
  engine.setFilterEnv(fenvAmtToOctaves(s.fenvAmt), fenvDecayAmtToSec(s.fenvDecay))
  engine.setReverbMix(reverbMixAmtToLevel(s.reverb))
  engine.setMasterVol(volAmtToGain(s.vol))
  engine.setPan(panAmtToPos(s.pan))
}

export default function App() {
  // ===== 2 トラック分の独立エンジン =====
  // useSynth() ごとに別 AudioContext / 別 voice pool / 別 FX チェーンを持つ。
  // どちらも同じ destination に流れるので、ブラウザがミックスしてくれる。
  const engineA = useSynth()
  const engineB = useSynth()
  // useSynth() は毎レンダ新しいオブジェクトを返すが、中身のメソッドは useCallback 済みで参照安定。
  // 後続の useCallback / useEffect の依存配列で扱いやすいよう、必要なメソッドだけ分解しておく。
  const { noteOn: aNoteOn, noteOff: aNoteOff, getAudioContext: aGetCtx } = engineA
  const { noteOn: bNoteOn, noteOff: bNoteOff } = engineB

  const done = typeof localStorage !== 'undefined' && localStorage.getItem(DONE_KEY) === '1'
  const [phase, setPhase] = useState<Phase>(done ? 'panel' : 'start')
  const [lessonIndex, setLessonIndex] = useState(0)
  const [stage, setStage] = useState<Stage>('blink')
  const [realized, setRealized] = useState<Set<FrameId>>(done ? new Set(ALL_FRAMES) : new Set())
  const [popupOpen, setPopupOpen] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [tutorialMenuOpen, setTutorialMenuOpen] = useState(false)
  const [panelPopup, setPanelPopup] = useState<FrameId | null>(null)
  const [activeTab, setActiveTab] = useState<PanelTab>('panel')
  const [presetModalOpen, setPresetModalOpen] = useState(false)

  // ===== マルチトラック：音作り状態と「いま編集中のトラック」 =====
  const [tracks, setTracks] = useState<SoundState[]>(() =>
    Array.from({ length: TRACK_COUNT }, () => ({ ...DEFAULT_SOUND, env: { ...DEFAULT_SOUND.env } })),
  )
  const [activeTrack, setActiveTrack] = useState(0)
  const currentSound = tracks[activeTrack]
  const currentEngine = activeTrack === 0 ? engineA : engineB

  // アクティブトラックの SoundState に部分パッチを当てる。
  // engine への反映は呼び出し側で行う（パラメータごとに変換式が違うため）。
  const patchActive = useCallback((patch: Partial<SoundState>) => {
    setTracks((prev) => prev.map((s, i) => (i === activeTrack ? { ...s, ...patch } : s)))
  }, [activeTrack])

  // ===== Eternal シーケンサーの状態 =====
  // パターン：トラックごと（旧 v0.1 の単トラック保存からの自動移行に対応）。
  const [seqPatterns, setSeqPatterns] = useState<Set<string>[]>(() => {
    if (typeof localStorage === 'undefined') return Array.from({ length: TRACK_COUNT }, () => new Set<string>())
    try {
      const stored = localStorage.getItem(SEQ_PATTERNS_KEY)
      if (stored) {
        const arr = JSON.parse(stored) as string[][]
        const out: Set<string>[] = Array.from({ length: TRACK_COUNT }, () => new Set<string>())
        for (let i = 0; i < Math.min(arr.length, TRACK_COUNT); i++) out[i] = new Set(arr[i])
        return out
      }
      // 旧キーから救出：v0.1 単トラック → Track 1 に移行、Track 2 は空。
      const legacy = localStorage.getItem(SEQ_PATTERN_LEGACY_KEY)
      if (legacy) {
        const parsed = JSON.parse(legacy) as string[]
        const out: Set<string>[] = Array.from({ length: TRACK_COUNT }, () => new Set<string>())
        out[0] = new Set(parsed)
        return out
      }
    } catch {
      // 壊れていれば空で始める
    }
    return Array.from({ length: TRACK_COUNT }, () => new Set<string>())
  })
  const [seqBpm, setSeqBpm] = useState<number>(() => {
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(SEQ_BPM_KEY) : null
    const n = stored ? Number(stored) : 120
    if (!Number.isFinite(n) || n < SEQ_BPM_MIN || n > SEQ_BPM_MAX) return 120
    return n
  })
  const [seqSwing, setSeqSwing] = useState<number>(() => {
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(SEQ_SWING_KEY) : null
    const n = stored ? Number(stored) : 0
    if (!Number.isFinite(n) || n < SEQ_SWING_MIN || n > SEQ_SWING_MAX) return 0
    return n
  })
  const [seqPlaying, setSeqPlaying] = useState(false)
  const [seqCurrentStep, setSeqCurrentStep] = useState(-1)
  // 再生ループから最新のパターン・スイング量を取るための ref。
  const seqPatternsRef = useRef(seqPatterns)
  useEffect(() => { seqPatternsRef.current = seqPatterns }, [seqPatterns])
  const seqSwingRef = useRef(seqSwing)
  useEffect(() => { seqSwingRef.current = seqSwing }, [seqSwing])
  // タップテンポ：最近のタップ時刻を保持。間隔の平均から BPM を計算する。
  const seqTapTimesRef = useRef<number[]>([])
  const [exitPhase, setExitPhase] = useState<ExitPhase | null>(null)
  const [flights, setFlights] = useState<Record<string, FrameFlight>>({})
  const [installing, setInstalling] = useState<Set<FrameId>>(new Set())
  const flightDataRef = useRef<Record<string, FrameFlight>>({})
  const destCenterRef = useRef<Record<string, { cx: number; cy: number }>>({})
  const previewRef = useRef(false)

  // --- 鍵盤側の状態 ---
  const [fine, setFine] = useState(false)
  const [snap, setSnap] = useState(false)
  const [keyHeld, setKeyHeld] = useState(false)
  // ポリフォニー：手動鍵盤で押されている (track, midi) の集合。
  // トラック切替や stopAll で必要なエンジンに正しく noteOff を投げ分けるために保持する。
  const heldNotesRef = useRef<Set<string>>(new Set())
  const heldKey = (track: number, midi: number) => `${track}:${midi}`

  const tweenRef = useRef<number | null>(null)

  // stopAll：保持中の手動ノートを全エンジン分解放し、SEQ も止める。
  const stopAll = useCallback(() => {
    heldNotesRef.current.forEach((k) => {
      const [t, m] = k.split(':')
      const fn = t === '0' ? aNoteOff : bNoteOff
      fn(Number(m))
    })
    heldNotesRef.current.clear()
    setKeyHeld(false)
    setSeqPlaying(false)
  }, [aNoteOff, bNoteOff])

  // トラック切替：その時点で手動押下中のノートはアクティブ側エンジンで離す
  // （切替後に「同じ鍵盤の指を離した」つもりが別エンジンに行って release し損ねるのを防ぐ）。
  const switchTrack = (next: number) => {
    if (next === activeTrack) return
    heldNotesRef.current.forEach((k) => {
      const [t, m] = k.split(':')
      const fn = t === '0' ? aNoteOff : bNoteOff
      fn(Number(m))
    })
    heldNotesRef.current.clear()
    setKeyHeld(false)
    setActiveTrack(next)
  }

  // sound: SoundCtl は「アクティブトラック」の状態を表示し、
  //         つまみ操作はアクティブトラックの SoundState と engine 両方を更新する。
  const sound: SoundCtl = {
    type: currentSound.type,
    onType: (t) => { patchActive({ type: t }); currentEngine.setWaveform(t) },
    playing: keyHeld || seqPlaying,
    onTune: (v) => currentEngine.setTune(v),
    fine,
    onToggleFine: () => setFine((v) => !v),
    snap,
    onToggleSnap: () => setSnap((v) => !v),
    env: currentSound.env,
    onEnvChange: (key, value) => {
      const next = { ...currentSound.env, [key]: value }
      patchActive({ env: next })
      currentEngine.setEnv(next)
    },
    cutoff: currentSound.cutoff,
    onCutoff: (amt) => { patchActive({ cutoff: amt }); currentEngine.setCutoff(cutoffNormToHz(amt)) },
    res: currentSound.res,
    onRes: (amt) => { patchActive({ res: amt }); currentEngine.setResonance(resAmtToQ(amt)) },
    lfoRate: currentSound.lfoRate,
    onLfoRate: (amt) => { patchActive({ lfoRate: amt }); currentEngine.setLfoRate(lfoRateToHz(amt)) },
    lfoDepth: currentSound.lfoDepth,
    onLfoDepth: (amt) => { patchActive({ lfoDepth: amt }); currentEngine.setLfoDepth(amt) },
    lfoDest: currentSound.lfoDest,
    onLfoDest: (d) => { patchActive({ lfoDest: d }); currentEngine.setLfoDest(d) },
    detune: currentSound.detune,
    onDetune: (amt) => { patchActive({ detune: amt }); currentEngine.setDetune(detuneAmtToCents(amt)) },
    mix: currentSound.mix,
    onMix: (amt) => { patchActive({ mix: amt }); currentEngine.setMix(mixAmtToBalance(amt)) },
    noise: currentSound.noise,
    onNoise: (amt) => { patchActive({ noise: amt }); currentEngine.setNoise(noiseAmtToLevel(amt)) },
    delayTime: currentSound.delayTime,
    onDelayTime: (amt) => { patchActive({ delayTime: amt }); currentEngine.setDelayTime(delayTimeAmtToSec(amt)) },
    delayMix: currentSound.delayMix,
    onDelayMix: (amt) => { patchActive({ delayMix: amt }); currentEngine.setDelayMix(delayMixAmtToLevel(amt)) },
    glide: currentSound.glide,
    onGlide: (amt) => { patchActive({ glide: amt }); currentEngine.setGlideTime(glideAmtToTau(amt)) },
    fenvAmt: currentSound.fenvAmt,
    onFenvAmt: (amt) => { patchActive({ fenvAmt: amt }); currentEngine.setFilterEnv(fenvAmtToOctaves(amt), fenvDecayAmtToSec(currentSound.fenvDecay)) },
    fenvDecay: currentSound.fenvDecay,
    onFenvDecay: (amt) => { patchActive({ fenvDecay: amt }); currentEngine.setFilterEnv(fenvAmtToOctaves(currentSound.fenvAmt), fenvDecayAmtToSec(amt)) },
    reverb: currentSound.reverb,
    onReverb: (amt) => { patchActive({ reverb: amt }); currentEngine.setReverbMix(reverbMixAmtToLevel(amt)) },
    vol: currentSound.vol,
    onVol: (amt) => { patchActive({ vol: amt }); currentEngine.setMasterVol(volAmtToGain(amt)) },
    pan: currentSound.pan,
    onPan: (amt) => { patchActive({ pan: amt }); currentEngine.setPan(panAmtToPos(amt)) },
    onNoteOn: (m) => {
      const k = heldKey(activeTrack, m)
      heldNotesRef.current.add(k)
      setKeyHeld(true)
      currentEngine.noteOn(m)
    },
    onNoteOff: (m) => {
      heldNotesRef.current.delete(heldKey(activeTrack, m))
      setKeyHeld(heldNotesRef.current.size > 0)
      currentEngine.noteOff(m)
    },
  }

  // ===== SEQ：パターン／BPM／スイングを localStorage に永続化 =====
  useEffect(() => {
    try {
      localStorage.setItem(SEQ_PATTERNS_KEY, JSON.stringify(seqPatterns.map((s) => Array.from(s))))
      // 旧キーが残っていたら掃除（次回ロード時の救出は不要なので消してよい）。
      localStorage.removeItem(SEQ_PATTERN_LEGACY_KEY)
    } catch {
      // 容量上限や private モード等。失敗しても再生には影響しない。
    }
  }, [seqPatterns])
  useEffect(() => {
    try { localStorage.setItem(SEQ_BPM_KEY, String(seqBpm)) } catch { /* */ }
  }, [seqBpm])
  useEffect(() => {
    try { localStorage.setItem(SEQ_SWING_KEY, String(seqSwing)) } catch { /* */ }
  }, [seqSwing])

  // ===== SEQ：再生ループ（マルチトラック + スイング + タイ）=====
  // ・トラック数ぶんループして、それぞれのエンジンへ noteOn/noteOff を投げる。
  // ・スイング：偶数 16 分→奇数 16 分の間隔を伸ばし、奇数→偶数を縮める。
  // ・タイ：同じ行で隣接するセルが連続オンなら、後続セルでは noteOn を打ち直さず、
  //   その連続区間の最後のセルでだけ release を仕込む（1 つの長い音）。
  // ・パターン／スイングは ref から都度読むので、再生中に編集してもループが切れない。
  // ・BPM 変更は effect 再起動で反映（その時点で先頭に戻る挙動）。
  // ・aNoteOn / aNoteOff / bNoteOn / bNoteOff の参照は安定（useCallback 済み）なので依存に入れて OK。
  useEffect(() => {
    if (!seqPlaying) return
    const trackOnFns = [aNoteOn, bNoteOn]
    const trackOffFns = [aNoteOff, bNoteOff]
    const stepMs = 60000 / (seqBpm * 4)
    let curStep = -1
    const releaseTimers: ReturnType<typeof setTimeout>[] = []
    let nextTimer: ReturnType<typeof setTimeout> | null = null

    const intervalFromStep = (step: number) => {
      const sw = seqSwingRef.current / 100
      return stepMs * (step % 2 === 0 ? 1 + sw : 1 - sw)
    }

    const advance = () => {
      curStep = (curStep + 1) % SEQ_STEPS
      setSeqCurrentStep(curStep)

      const patterns = seqPatternsRef.current
      for (let trk = 0; trk < TRACK_COUNT; trk++) {
        const pattern = patterns[trk]
        if (!pattern) continue
        const onFn = trackOnFns[trk]
        const offFn = trackOffFns[trk]
        for (const m of SEQ_PITCHES) {
          const isOn = pattern.has(seqCellKey(curStep, m))
          if (!isOn) continue
          const wasOn = curStep > 0 && pattern.has(seqCellKey(curStep - 1, m))
          const willContinue = curStep < SEQ_STEPS - 1 && pattern.has(seqCellKey(curStep + 1, m))
          if (!wasOn) onFn(m)
          if (!willContinue) {
            const gateMs = intervalFromStep(curStep) * 0.85
            const t = setTimeout(() => offFn(m), gateMs)
            releaseTimers.push(t)
          }
        }
      }

      nextTimer = setTimeout(advance, intervalFromStep(curStep))
    }

    advance()

    return () => {
      if (nextTimer) clearTimeout(nextTimer)
      releaseTimers.forEach((t) => clearTimeout(t))
      // SEQ が打った可能性のある全ピッチを念のため、全トラックで離す。
      for (let trk = 0; trk < TRACK_COUNT; trk++) {
        const offFn = trackOffFns[trk]
        SEQ_PITCHES.forEach((m) => offFn(m))
      }
      setSeqCurrentStep(-1)
    }
  }, [seqPlaying, seqBpm, aNoteOn, aNoteOff, bNoteOn, bNoteOff])

  // ===== ☰ メニュー：外側タップで閉じる =====
  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null
      if (t && t.closest('.menu-wrap')) return
      setMenuOpen(false)
      setTutorialMenuOpen(false)
    }
    const id = window.setTimeout(() => {
      document.addEventListener('pointerdown', handler, true)
    }, 0)
    return () => {
      window.clearTimeout(id)
      document.removeEventListener('pointerdown', handler, true)
    }
  }, [menuOpen])

  // セル On/Off。アクティブトラックのパターンを編集。
  const toggleSeqCell = (step: number, midi: number) => {
    setSeqPatterns((prev) => prev.map((p, i) => {
      if (i !== activeTrack) return p
      const next = new Set(p)
      const k = seqCellKey(step, midi)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    }))
  }

  const clearActiveTrackPattern = () => {
    setSeqPatterns((prev) => prev.map((p, i) => (i === activeTrack ? new Set<string>() : p)))
  }

  // タップテンポ：最近 4 タップまでの間隔を平均して BPM を計算する。
  const handleSeqTap = () => {
    const now = performance.now()
    const arr = seqTapTimesRef.current
    const last = arr[arr.length - 1]
    if (last !== undefined && now - last > 2000) {
      seqTapTimesRef.current = [now]
      return
    }
    arr.push(now)
    while (arr.length > 4) arr.shift()
    if (arr.length >= 2) {
      let sum = 0
      for (let i = 1; i < arr.length; i++) sum += arr[i] - arr[i - 1]
      const avg = sum / (arr.length - 1)
      const bpm = Math.round(60000 / avg)
      setSeqBpm(Math.max(SEQ_BPM_MIN, Math.min(SEQ_BPM_MAX, bpm)))
    }
  }

  const commitExit = useCallback(() => {
    stopAll()
    setFlights({})
    flightDataRef.current = {}
    setInstalling(new Set())
    setExitPhase(null)
    if (previewRef.current) {
      previewRef.current = false
      setRealized(new Set(ALL_FRAMES))
      setPopupOpen(false)
      setPhase('panel')
      return
    }
    const next = lessonIndex + 1
    if (next < LESSONS.length) {
      setLessonIndex(next)
      setPopupOpen(false)
      setStage('blink')
    } else {
      localStorage.setItem(DONE_KEY, '1')
      setPhase('panel')
    }
  }, [lessonIndex, stopAll])

  useEffect(() => {
    if (phase !== 'lesson' || stage !== 'blink') return
    const t = setTimeout(() => {
      setStage('active')
      setPopupOpen(true)
    }, BLINK_MS)
    return () => clearTimeout(t)
  }, [phase, stage])

  // 着座時の「カチャ」音は engineA の context を使う（どちらでもよい）。
  const getAudioContext = aGetCtx

  useEffect(() => {
    if (phase !== 'lesson' || stage !== 'exit') return
    const frames = LESSONS[lessonIndex].realizes
    const timers: ReturnType<typeof setTimeout>[] = []

    timers.push(setTimeout(() => {
      const fl = flightDataRef.current
      const dc = destCenterRef.current
      frames.forEach((fid) => {
        const sEl = document.querySelector(`[data-stage-frame="${fid}"]`)
        if (sEl && fl[fid] && dc[fid]) {
          const r = sEl.getBoundingClientRect()
          fl[fid].tx = dc[fid].cx - (r.left + r.width / 2)
          fl[fid].ty = dc[fid].cy - (r.top + r.height / 2)
        }
      })
      setFlights({ ...fl })
      setExitPhase('hover')
    }, MORPH_MS))

    timers.push(setTimeout(() => setExitPhase('glide'), MORPH_MS + HOVER_MS))

    timers.push(setTimeout(() => {
      setExitPhase('seat')
      setRealized((prev) => {
        const n = new Set(prev)
        frames.forEach((fr) => n.add(fr))
        return n
      })
      setInstalling(new Set(frames))
      const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (!prefersReduced) {
        const ctx = getAudioContext()
        if (ctx) playSeatClick(ctx)
        navigator.vibrate?.(10)
      }
    }, MORPH_MS + HOVER_MS + GLIDE_MS))

    timers.push(setTimeout(commitExit, EXIT_MS))

    return () => timers.forEach(clearTimeout)
  }, [phase, stage, lessonIndex, commitExit, getAudioContext])

  const scrollToBay = (id: FrameId) => {
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-slot="${id}"]`)
      el?.scrollIntoView({ block: 'center', behavior: 'auto' })
    })
  }

  const beginLesson = (i: number) => {
    setFlights({})
    flightDataRef.current = {}
    setInstalling(new Set())
    setExitPhase(null)
    setLessonIndex(i)
    setPopupOpen(false)
    setStage('blink')
    setPhase('lesson')
    scrollToBay(LESSONS[i].id)
  }

  const onOK = () => {
    const frames = LESSONS[lessonIndex].realizes
    const fl: Record<string, FrameFlight> = {}
    const dc: Record<string, { cx: number; cy: number }> = {}
    frames.forEach((fid) => {
      const sEl = document.querySelector(`[data-stage-frame="${fid}"]`)
      const dEl = document.querySelector(`[data-slot="${fid}"]`)
      if (sEl && dEl) {
        const s = sEl.getBoundingClientRect()
        const d = dEl.getBoundingClientRect()
        fl[fid] = { s: s.width ? d.width / s.width : 1, tx: 0, ty: 0 }
        dc[fid] = { cx: d.left + d.width / 2, cy: d.top + d.height / 2 }
      }
    })
    flightDataRef.current = fl
    destCenterRef.current = dc
    setFlights(fl)
    setPopupOpen(false)
    setStage('exit')
    setExitPhase('morph')
  }

  const previewLesson = (i: number) => {
    stopAll()
    setMenuOpen(false)
    setTutorialMenuOpen(false)
    previewRef.current = true
    setRealized(new Set(LESSONS.slice(0, i).flatMap((l) => l.realizes)))
    setFlights({})
    flightDataRef.current = {}
    setInstalling(new Set())
    setExitPhase(null)
    setLessonIndex(i)
    setPopupOpen(false)
    setStage('blink')
    setPhase('lesson')
    scrollToBay(LESSONS[i].id)
  }

  const skip = () => {
    stopAll()
    previewRef.current = false
    setRealized(new Set(ALL_FRAMES))
    localStorage.setItem(DONE_KEY, '1')
    setPhase('panel')
  }

  const replay = () => {
    stopAll()
    setRealized(new Set())
    setLessonIndex(0)
    setPopupOpen(false)
    setExitPhase(null)
    setFlights({})
    flightDataRef.current = {}
    setInstalling(new Set())
    setPhase('intro')
  }

  // プリセット選択：アクティブトラックの SoundState と engine を 0.6 秒かけて目標値へ。
  // 波形・LFO 行き先は離散切替で即時。
  const applyPreset = (p: Preset) => {
    const engine = currentEngine
    const trackIdx = activeTrack
    const setAllRaw = (s: SoundState) => {
      // React state（アクティブトラック）と engine の両方を一括更新。
      setTracks((prev) => prev.map((cur, i) => (i === trackIdx ? s : cur)))
      pushSoundToEngine(engine, s)
    }
    // 離散値（波形・LFO 行き先）は即セット。連続値は下のループで補間。
    const target: SoundState = {
      type: p.type,
      env: { ...p.env },
      cutoff: p.cutoff,
      res: p.res,
      lfoRate: p.lfoRate,
      lfoDepth: p.lfoDepth,
      lfoDest: p.lfoDest,
      detune: p.detuneAmt,
      mix: p.mixAmt,
      noise: p.noiseAmt,
      delayTime: p.delayTimeAmt,
      delayMix: p.delayMixAmt,
      glide: p.glideAmt,
      fenvAmt: p.filterEnvAmt,
      fenvDecay: p.filterEnvDecay,
      reverb: p.reverbMixAmt,
      vol: currentSound.vol, // プリセットは VOL/PAN を持たない（マスター側）
      pan: currentSound.pan,
    }
    if (tweenRef.current) cancelAnimationFrame(tweenRef.current)
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setAllRaw(target)
      return
    }
    const start: SoundState = { ...currentSound, env: { ...currentSound.env } }
    const DUR = 600
    const t0 = performance.now()
    const lp = (a: number, b: number, k: number) => a + (b - a) * k
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / DUR)
      const e = 1 - Math.pow(1 - k, 3) // easeOutCubic
      const interpolated: SoundState = {
        type: target.type,     // 離散：即
        lfoDest: target.lfoDest, // 離散：即
        cutoff: lp(start.cutoff, target.cutoff, e),
        res: lp(start.res, target.res, e),
        lfoRate: lp(start.lfoRate, target.lfoRate, e),
        lfoDepth: lp(start.lfoDepth, target.lfoDepth, e),
        detune: lp(start.detune, target.detune, e),
        mix: lp(start.mix, target.mix, e),
        noise: lp(start.noise, target.noise, e),
        delayTime: lp(start.delayTime, target.delayTime, e),
        delayMix: lp(start.delayMix, target.delayMix, e),
        glide: lp(start.glide, target.glide, e),
        fenvAmt: lp(start.fenvAmt, target.fenvAmt, e),
        fenvDecay: lp(start.fenvDecay, target.fenvDecay, e),
        reverb: lp(start.reverb, target.reverb, e),
        vol: target.vol,
        pan: target.pan,
        env: {
          attack: lp(start.env.attack, target.env.attack, e),
          decay: lp(start.env.decay, target.env.decay, e),
          sustain: lp(start.env.sustain, target.env.sustain, e),
          release: lp(start.env.release, target.env.release, e),
        },
      }
      setAllRaw(interpolated)
      tweenRef.current = k < 1 ? requestAnimationFrame(step) : null
    }
    tweenRef.current = requestAnimationFrame(step)
  }

  if (phase === 'start') return <StartScreen onStart={() => setPhase('intro')} />
  if (phase === 'intro') return <IntroScreen onDone={() => setPhase('ghost')} />

  const popupHelp = panelPopup ? FRAME_HELP[panelPopup] : null
  const closeMenu = () => { setMenuOpen(false); setTutorialMenuOpen(false) }

  const menuItems = phase === 'panel' ? (
    <>
      <label className="menu-item menu-check">
        <input type="checkbox" checked={showHelp} onChange={() => setShowHelp((v) => !v)} />
        <span>解説表示</span>
      </label>
      <div className="menu-row">
        <button className="menu-item" onClick={() => setTutorialMenuOpen((o) => !o)}>
          <span className="menu-arrow">◀</span>チュートリアル
        </button>
        {tutorialMenuOpen && (
          <div className="menu-sub">
            {LESSONS.map((l, i) => (
              <button key={l.id} onClick={() => previewLesson(i)}>
                {FRAME_TITLE[l.id]}
              </button>
            ))}
          </div>
        )}
      </div>
      <button className="menu-item" onClick={() => { closeMenu(); replay() }}>
        <span className="menu-arrow" />もう一度見る
      </button>
    </>
  ) : (
    <button className="menu-item" onClick={() => { closeMenu(); skip() }}>
      <span className="menu-arrow" />スキップ
    </button>
  )

  return (
    <div className="app-root">
      <SynthPanel
        realized={realized}
        blinkingId={phase === 'lesson' && stage === 'blink' ? LESSONS[lessonIndex].id : null}
        sound={sound}
        showHelp={showHelp}
        onHelpFrame={(f) => setPanelPopup(f)}
        installing={installing}
        showTabRow={phase === 'panel'}
        activeTab={activeTab}
        onTab={setActiveTab}
        onOpenPresets={() => setPresetModalOpen(true)}
        seqPlaying={seqPlaying}
        menuOpen={menuOpen && phase === 'panel'}
        onMenuToggle={() => setMenuOpen((o) => !o)}
        menuChildren={menuItems}
        seqContent={
          <SeqPanel
            trackCount={TRACK_COUNT}
            activeTrack={activeTrack}
            onTrack={switchTrack}
            pattern={seqPatterns[activeTrack] ?? new Set()}
            currentStep={seqCurrentStep}
            playing={seqPlaying}
            bpm={seqBpm}
            swing={seqSwing}
            onToggleCell={toggleSeqCell}
            onClear={clearActiveTrackPattern}
            onTogglePlay={() => setSeqPlaying((p) => !p)}
            onBpm={setSeqBpm}
            onSwing={setSeqSwing}
            onTap={handleSeqTap}
          />
        }
      />

      {phase === 'ghost' && (
        <div className="ghost-cta fade-in">
          <p className="ghost-cta-text">空っぽのパネル。ここにキミだけのシンセを組み上げよう。</p>
          <button className="cta" onClick={() => beginLesson(0)}>
            組み立てる
          </button>
        </div>
      )}

      {phase === 'lesson' && (stage === 'active' || stage === 'exit') && (
        <LessonStage
          lesson={LESSONS[lessonIndex]}
          exitPhase={stage === 'exit' ? exitPhase : null}
          flights={flights}
          popupOpen={popupOpen}
          onClosePopup={() => setPopupOpen(false)}
          onHelp={() => setPopupOpen(true)}
          onOK={onOK}
          sound={sound}
        />
      )}

      {/* メニューの外側タップ検知は document.pointerdown で行う（.menu-backdrop は廃止） */}

      {phase !== 'panel' && (
        <div className="topbar">
          <div className="menu-wrap">
            <button className="menu-btn" onClick={() => setMenuOpen((o) => !o)} aria-label="メニュー">
              <span />
              <span />
              <span />
            </button>
            {menuOpen && <div className="menu">{menuItems}</div>}
          </div>
        </div>
      )}

      {presetModalOpen && (
        <PresetModal
          presets={PRESETS}
          onPick={applyPreset}
          onClose={() => setPresetModalOpen(false)}
        />
      )}

      {popupHelp && (
        <Popup title={popupHelp.title} paragraphs={popupHelp.paragraphs} onClose={() => setPanelPopup(null)} />
      )}
    </div>
  )
}
