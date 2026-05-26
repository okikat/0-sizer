import { useCallback, useEffect, useRef, useState } from 'react'
import { useSynth, type EnvParams, type LfoDest } from './audio/useSynth'
import { playSeatClick } from './audio/gachan'
import { cutoffNormToHz, resAmtToQ, lfoRateToHz, detuneAmtToCents, mixAmtToBalance, noiseAmtToLevel, delayTimeAmtToSec, delayMixAmtToLevel, reverbMixAmtToLevel, glideAmtToTau, fenvAmtToOctaves, fenvDecayAmtToSec } from './audio/params'
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
import { SEQ_STEPS, SEQ_PITCHES, SEQ_BPM_MIN, SEQ_BPM_MAX, cellKey as seqCellKey } from './tutorial/seqConst'

type Phase = 'start' | 'intro' | 'ghost' | 'lesson' | 'panel'
type Stage = 'blink' | 'active' | 'exit'

const DONE_KEY = '0sizer.tutorialDone'
const SEQ_PATTERN_KEY = '0sizer.seqPattern'
const SEQ_BPM_KEY = '0sizer.seqBpm'
const BLINK_MS = 1150
// インストール演出：その場で最終形へモーフ → 少し浮く → ゆっくり定位置へ → 着座。
const MORPH_MS = 460 // パネル収まり後の形へ作り替え（WAVEは計器が畳まれる）＋暗幕フェード
const HOVER_MS = 340 // 定位置の少し上で浮く
const GLIDE_MS = 760 // ゆっくり定位置へ
const SEAT_MS = 420 // 着座（カチャ＋ごく薄い光）
const EXIT_MS = MORPH_MS + HOVER_MS + GLIDE_MS + SEAT_MS

export default function App() {
  const { noteOn, noteOff, setWaveform, setTune, setEnv, setCutoff, setResonance, setDetune, setMix, setNoise, setFilterEnv, setLfoRate, setLfoDepth, setLfoDest, setMasterVol, setPan, setDelayTime, setDelayMix, setReverbMix, setGlideTime, getAudioContext } = useSynth()

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

  // ===== Eternal シーケンサーの状態 =====
  // パターンと BPM は localStorage に保存。再生位置とフラグは揮発で OK。
  const [seqPattern, setSeqPattern] = useState<Set<string>>(() => {
    try {
      const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(SEQ_PATTERN_KEY) : null
      if (stored) return new Set(JSON.parse(stored) as string[])
    } catch {
      // 壊れていれば空で始める
    }
    return new Set()
  })
  const [seqBpm, setSeqBpm] = useState<number>(() => {
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(SEQ_BPM_KEY) : null
    const n = stored ? Number(stored) : 120
    if (!Number.isFinite(n) || n < SEQ_BPM_MIN || n > SEQ_BPM_MAX) return 120
    return n
  })
  const [seqPlaying, setSeqPlaying] = useState(false)
  const [seqCurrentStep, setSeqCurrentStep] = useState(-1)
  // 再生ループから最新のパターン／音源を取るための ref。
  // パターンを依存配列に入れると編集のたびに再生がリセットされてしまう。
  const seqPatternRef = useRef(seqPattern)
  useEffect(() => { seqPatternRef.current = seqPattern }, [seqPattern])
  const [exitPhase, setExitPhase] = useState<ExitPhase | null>(null)
  const [flights, setFlights] = useState<Record<string, FrameFlight>>({})
  const [installing, setInstalling] = useState<Set<FrameId>>(new Set())
  // 飛翔データ（最新値を timer 内で参照・更新するための実体）と取付先スロットの中心。
  const flightDataRef = useRef<Record<string, FrameFlight>>({})
  const destCenterRef = useRef<Record<string, { cx: number; cy: number }>>({})
  // 「◀チュートリアル」から1レッスンだけ再生するプレビュー中か。
  const previewRef = useRef(false)

  // --- 音まわりの状態 ---
  const [type, setType] = useState<OscillatorType>('sine')
  const [fine, setFine] = useState(false)
  const [snap, setSnap] = useState(false)
  const [keyHeld, setKeyHeld] = useState(false)
  // ポリフォニー：現在押されている鍵盤の集合（複数同時 OK）。
  // keyHeld（スコープ表示用）の同期と stopAll のために保持する。
  const heldNotesRef = useRef<Set<number>>(new Set())
  const [env, setEnvState] = useState<EnvParams>({ attack: 0.01, decay: 0.2, sustain: 0.7, release: 0.3 })
  // FILTER / LFO は controlled（プリセットで動かすため、つまみ量を保持）。
  const [cutoffAmt, setCutoffAmt] = useState(1)
  const [resAmt, setResAmt] = useState(0)
  const [lfoRateAmt, setLfoRateAmt] = useState(3)
  const [lfoDepthAmt, setLfoDepthAmt] = useState(0)
  const [lfoDestState, setLfoDestState] = useState<LfoDest>('pitch')
  const [detuneAmt, setDetuneAmt] = useState(0)
  const [mixAmt, setMixAmt] = useState(5)
  const [noiseAmt, setNoiseAmt] = useState(0)
  const [delayTimeAmt, setDelayTimeAmt] = useState(3)
  const [delayMixAmt, setDelayMixAmt] = useState(0)
  const [glideAmt, setGlideAmt] = useState(0)
  const [fenvAmtState, setFenvAmtState] = useState(0)
  const [fenvDecayState, setFenvDecayState] = useState(3)
  const [reverbAmt, setReverbAmt] = useState(3)
  const tweenRef = useRef<number | null>(null)

  const stopAll = useCallback(() => {
    heldNotesRef.current.forEach((m) => noteOff(m))
    heldNotesRef.current.clear()
    setKeyHeld(false)
    // レッスン突入や画面遷移時に SEQ も止める。音と動線をクリーンに。
    setSeqPlaying(false)
  }, [noteOff])

  const sound: SoundCtl = {
    type,
    onType: (t) => { setType(t); setWaveform(t) },
    playing: keyHeld,
    onTune: (v) => setTune(v),
    fine,
    onToggleFine: () => setFine((v) => !v),
    snap,
    onToggleSnap: () => setSnap((v) => !v),
    env,
    onEnvChange: (key, value) => {
      const next = { ...env, [key]: value }
      setEnvState(next)
      setEnv(next)
    },
    cutoff: cutoffAmt,
    onCutoff: (amt) => { setCutoffAmt(amt); setCutoff(cutoffNormToHz(amt)) },
    res: resAmt,
    onRes: (amt) => { setResAmt(amt); setResonance(resAmtToQ(amt)) },
    lfoRate: lfoRateAmt,
    onLfoRate: (amt) => { setLfoRateAmt(amt); setLfoRate(lfoRateToHz(amt)) },
    lfoDepth: lfoDepthAmt,
    onLfoDepth: (amt) => { setLfoDepthAmt(amt); setLfoDepth(amt) },
    lfoDest: lfoDestState,
    onLfoDest: (d) => { setLfoDestState(d); setLfoDest(d) },
    detune: detuneAmt,
    onDetune: (amt) => { setDetuneAmt(amt); setDetune(detuneAmtToCents(amt)) },
    mix: mixAmt,
    onMix: (amt) => { setMixAmt(amt); setMix(mixAmtToBalance(amt)) },
    noise: noiseAmt,
    onNoise: (amt) => { setNoiseAmt(amt); setNoise(noiseAmtToLevel(amt)) },
    delayTime: delayTimeAmt,
    onDelayTime: (amt) => { setDelayTimeAmt(amt); setDelayTime(delayTimeAmtToSec(amt)) },
    delayMix: delayMixAmt,
    onDelayMix: (amt) => { setDelayMixAmt(amt); setDelayMix(delayMixAmtToLevel(amt)) },
    glide: glideAmt,
    onGlide: (amt) => { setGlideAmt(amt); setGlideTime(glideAmtToTau(amt)) },
    fenvAmt: fenvAmtState,
    onFenvAmt: (amt) => { setFenvAmtState(amt); setFilterEnv(fenvAmtToOctaves(amt), fenvDecayAmtToSec(fenvDecayState)) },
    fenvDecay: fenvDecayState,
    onFenvDecay: (amt) => { setFenvDecayState(amt); setFilterEnv(fenvAmtToOctaves(fenvAmtState), fenvDecayAmtToSec(amt)) },
    reverb: reverbAmt,
    onReverb: (amt) => { setReverbAmt(amt); setReverbMix(reverbMixAmtToLevel(amt)) },
    onVol: (v) => setMasterVol(v),
    onPan: (p) => setPan(p),
    onNoteOn: (m) => {
      heldNotesRef.current.add(m)
      setKeyHeld(true)
      noteOn(m)
    },
    onNoteOff: (m) => {
      heldNotesRef.current.delete(m)
      setKeyHeld(heldNotesRef.current.size > 0)
      noteOff(m)
    },
  }

  // ===== SEQ：パターンと BPM を localStorage に永続化 =====
  useEffect(() => {
    try {
      localStorage.setItem(SEQ_PATTERN_KEY, JSON.stringify(Array.from(seqPattern)))
    } catch {
      // 容量上限や private モード等。失敗しても再生には影響しない。
    }
  }, [seqPattern])
  useEffect(() => {
    try {
      localStorage.setItem(SEQ_BPM_KEY, String(seqBpm))
    } catch {
      // 同上
    }
  }, [seqBpm])

  // ===== SEQ：再生ループ =====
  // 16 分音符単位で setInterval を回す。各ステップで音を「ゲート 85%」で打って離す。
  // パターンは ref から都度読むので、再生中に編集してもループが止まらない。
  // BPM 変更は effect 再起動として反映（簡素化のため、その時点で先頭に戻る挙動）。
  useEffect(() => {
    if (!seqPlaying) return
    const stepMs = 60000 / (seqBpm * 4)
    let curStep = -1
    const releaseTimers: ReturnType<typeof setTimeout>[] = []

    const advance = () => {
      curStep = (curStep + 1) % SEQ_STEPS
      setSeqCurrentStep(curStep)
      const midis: number[] = []
      for (const m of SEQ_PITCHES) {
        if (seqPatternRef.current.has(seqCellKey(curStep, m))) midis.push(m)
      }
      midis.forEach((m) => noteOn(m))
      const t = setTimeout(() => {
        midis.forEach((m) => noteOff(m))
      }, stepMs * 0.85)
      releaseTimers.push(t)
    }
    advance()
    const id = setInterval(advance, stepMs)

    return () => {
      clearInterval(id)
      releaseTimers.forEach((t) => clearTimeout(t))
      // SEQ が打った可能性のある全ピッチを念のため離す（停止後の長い尾を防ぐ）。
      SEQ_PITCHES.forEach((m) => noteOff(m))
      // 再生ヘッドを消す（停止 or BPM 変更でループ再起動する瞬間）。
      setSeqCurrentStep(-1)
    }
  }, [seqPlaying, seqBpm, noteOn, noteOff])

  // セル On/Off。再生は止めずに編集できる。
  const toggleSeqCell = (step: number, midi: number) => {
    setSeqPattern((prev) => {
      const next = new Set(prev)
      const k = seqCellKey(step, midi)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })
  }

  const commitExit = useCallback(() => {
    stopAll()
    setFlights({})
    flightDataRef.current = {}
    setInstalling(new Set())
    setExitPhase(null)
    // プレビュー（1レッスンだけ）の時は、続けず全モジュールを戻してパネルへ。
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

  // blink → active の制御
  useEffect(() => {
    if (phase !== 'lesson' || stage !== 'blink') return
    const t = setTimeout(() => {
      setStage('active')
      setPopupOpen(true)
    }, BLINK_MS)
    return () => clearTimeout(t)
  }, [phase, stage])

  // インストール演出：morph →（現在位置を実測して移動量確定）→ hover → glide → seat → commit
  useEffect(() => {
    if (phase !== 'lesson' || stage !== 'exit') return
    const frames = LESSONS[lessonIndex].realizes
    const timers: ReturnType<typeof setTimeout>[] = []

    // モーフ完了：縮小・畳み終えた“いまの位置”を測って定位置への移動量を確定。
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

    // 着座：このタイミングで実体化＋「カチャ」＋ごく薄い光
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

  // 取付先（空きベイ）を画面内に出す。グリッドが縦に伸びても、着弾点が画面外に行かない。
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
    // OK で「その場で最終形へモーフ」開始。各フレームの現在位置と取付先を実測して縮小率を決める。
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

  // 「◀チュートリアル」から1レッスンだけ再生。前のレッスンのモジュールは付いた状態で開始。
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

  // プリセット選択：波形と内部パラメータ（フィルターEnv）を即セット。
  // 表示のあるツマミ系（ENV・FILTER・LFO・OSC2 の MIX/DETUNE）は 0.6 秒かけてアニメで目標値へ。
  const applyPreset = (p: Preset) => {
    setType(p.type)
    setWaveform(p.type)
    setLfoDestState(p.lfoDest)
    setLfoDest(p.lfoDest)
    const setAll = (cutoff: number, res: number, lr: number, ld: number, mix: number, det: number, noise: number, dt: number, dm: number, gl: number, fa: number, fd: number, rv: number, e: EnvParams) => {
      setCutoffAmt(cutoff); setCutoff(cutoffNormToHz(cutoff))
      setResAmt(res); setResonance(resAmtToQ(res))
      setLfoRateAmt(lr); setLfoRate(lfoRateToHz(lr))
      setLfoDepthAmt(ld); setLfoDepth(ld)
      setMixAmt(mix); setMix(mixAmtToBalance(mix))
      setDetuneAmt(det); setDetune(detuneAmtToCents(det))
      setNoiseAmt(noise); setNoise(noiseAmtToLevel(noise))
      setDelayTimeAmt(dt); setDelayTime(delayTimeAmtToSec(dt))
      setDelayMixAmt(dm); setDelayMix(delayMixAmtToLevel(dm))
      setGlideAmt(gl); setGlideTime(glideAmtToTau(gl))
      setFenvAmtState(fa); setFenvDecayState(fd); setFilterEnv(fenvAmtToOctaves(fa), fenvDecayAmtToSec(fd))
      setReverbAmt(rv); setReverbMix(reverbMixAmtToLevel(rv))
      setEnvState(e); setEnv(e)
    }
    if (tweenRef.current) cancelAnimationFrame(tweenRef.current)
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setAll(p.cutoff, p.res, p.lfoRate, p.lfoDepth, p.mixAmt, p.detuneAmt, p.noiseAmt, p.delayTimeAmt, p.delayMixAmt, p.glideAmt, p.filterEnvAmt, p.filterEnvDecay, p.reverbMixAmt, p.env)
      return
    }
    const s = { cutoff: cutoffAmt, res: resAmt, lr: lfoRateAmt, ld: lfoDepthAmt, mix: mixAmt, det: detuneAmt, noise: noiseAmt, dt: delayTimeAmt, dm: delayMixAmt, gl: glideAmt, fa: fenvAmtState, fd: fenvDecayState, rv: reverbAmt, ...env }
    const DUR = 600
    const t0 = performance.now()
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / DUR)
      const e = 1 - Math.pow(1 - k, 3) // easeOutCubic
      const lp = (a: number, b: number) => a + (b - a) * e
      setAll(
        lp(s.cutoff, p.cutoff),
        lp(s.res, p.res),
        lp(s.lr, p.lfoRate),
        lp(s.ld, p.lfoDepth),
        lp(s.mix, p.mixAmt),
        lp(s.det, p.detuneAmt),
        lp(s.noise, p.noiseAmt),
        lp(s.dt, p.delayTimeAmt),
        lp(s.dm, p.delayMixAmt),
        lp(s.gl, p.glideAmt),
        lp(s.fa, p.filterEnvAmt),
        lp(s.fd, p.filterEnvDecay),
        lp(s.rv, p.reverbMixAmt),
        {
          attack: lp(s.attack, p.env.attack),
          decay: lp(s.decay, p.env.decay),
          sustain: lp(s.sustain, p.env.sustain),
          release: lp(s.release, p.env.release),
        },
      )
      tweenRef.current = k < 1 ? requestAnimationFrame(step) : null
    }
    tweenRef.current = requestAnimationFrame(step)
  }

  if (phase === 'start') return <StartScreen onStart={() => setPhase('intro')} />
  if (phase === 'intro') return <IntroScreen onDone={() => setPhase('ghost')} />

  const popupHelp = panelPopup ? FRAME_HELP[panelPopup] : null
  const closeMenu = () => { setMenuOpen(false); setTutorialMenuOpen(false) }

  // メニューの中身。タブ行のハンバーガー（panel 時）と、レッスン中の右上ボタン（lesson/ghost 時）で共有する。
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
            pattern={seqPattern}
            currentStep={seqCurrentStep}
            playing={seqPlaying}
            bpm={seqBpm}
            onToggleCell={toggleSeqCell}
            onClear={() => setSeqPattern(new Set())}
            onTogglePlay={() => setSeqPlaying((p) => !p)}
            onBpm={setSeqBpm}
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

      {menuOpen && <div className="menu-backdrop" onClick={closeMenu} />}

      {/* レッスン中・ghost 中はパネルがオーバーレイで隠れるため、メニューは右上に出す。
          パネル時はタブ行のハンバーガーが担当するので不要。 */}
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
