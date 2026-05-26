import { useCallback, useEffect, useRef, useState } from 'react'
import { useSynth, type EnvParams } from './audio/useSynth'
import { playSeatClick } from './audio/gachan'
import { cutoffNormToHz, resAmtToQ, lfoRateToHz, lfoDepthToCents, detuneAmtToCents, mixAmtToBalance, noiseAmtToLevel } from './audio/params'
import { LESSONS, ALL_FRAMES, FRAME_HELP, FRAME_TITLE, type FrameId } from './tutorial/lessons'
import { PRESETS, type Preset } from './tutorial/presets'
import type { SoundCtl } from './tutorial/modules'
import { StartScreen } from './tutorial/StartScreen'
import { IntroScreen } from './tutorial/IntroScreen'
import { SynthPanel } from './tutorial/SynthPanel'
import { LessonStage, type ExitPhase, type FrameFlight } from './tutorial/LessonStage'
import { Popup } from './tutorial/Popup'

type Phase = 'start' | 'intro' | 'ghost' | 'lesson' | 'panel'
type Stage = 'blink' | 'active' | 'exit'

const DONE_KEY = '0sizer.tutorialDone'
const BLINK_MS = 1150
// インストール演出：その場で最終形へモーフ → 少し浮く → ゆっくり定位置へ → 着座。
const MORPH_MS = 460 // パネル収まり後の形へ作り替え（WAVEは計器が畳まれる）＋暗幕フェード
const HOVER_MS = 340 // 定位置の少し上で浮く
const GLIDE_MS = 760 // ゆっくり定位置へ
const SEAT_MS = 420 // 着座（カチャ＋ごく薄い光）
const EXIT_MS = MORPH_MS + HOVER_MS + GLIDE_MS + SEAT_MS

export default function App() {
  const { noteOn, noteOff, setWaveform, setTune, setEnv, setCutoff, setResonance, setDetune, setMix, setNoise, setFilterEnv, setLfoRate, setLfoDepth, setMasterVol, setPan, getAudioContext } = useSynth()

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
  const [env, setEnvState] = useState<EnvParams>({ attack: 0.01, decay: 0.2, sustain: 0.7, release: 0.3 })
  // FILTER / LFO は controlled（プリセットで動かすため、つまみ量を保持）。
  const [cutoffAmt, setCutoffAmt] = useState(1)
  const [resAmt, setResAmt] = useState(0)
  const [lfoRateAmt, setLfoRateAmt] = useState(3)
  const [lfoDepthAmt, setLfoDepthAmt] = useState(0)
  const [detuneAmt, setDetuneAmt] = useState(0)
  const [mixAmt, setMixAmt] = useState(5)
  const [noiseAmt, setNoiseAmt] = useState(0)
  const tweenRef = useRef<number | null>(null)

  const stopAll = useCallback(() => {
    noteOff()
    setKeyHeld(false)
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
    onLfoDepth: (amt) => { setLfoDepthAmt(amt); setLfoDepth(lfoDepthToCents(amt)) },
    detune: detuneAmt,
    onDetune: (amt) => { setDetuneAmt(amt); setDetune(detuneAmtToCents(amt)) },
    mix: mixAmt,
    onMix: (amt) => { setMixAmt(amt); setMix(mixAmtToBalance(amt)) },
    noise: noiseAmt,
    onNoise: (amt) => { setNoiseAmt(amt); setNoise(noiseAmtToLevel(amt)) },
    onVol: (v) => setMasterVol(v),
    onPan: (p) => setPan(p),
    onNoteOn: (m) => { setKeyHeld(true); noteOn(m) },
    onNoteOff: () => { setKeyHeld(false); noteOff() },
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
    setFilterEnv(p.filterEnvAmt, p.filterEnvDecay)
    const setAll = (cutoff: number, res: number, lr: number, ld: number, mix: number, det: number, noise: number, e: EnvParams) => {
      setCutoffAmt(cutoff); setCutoff(cutoffNormToHz(cutoff))
      setResAmt(res); setResonance(resAmtToQ(res))
      setLfoRateAmt(lr); setLfoRate(lfoRateToHz(lr))
      setLfoDepthAmt(ld); setLfoDepth(lfoDepthToCents(ld))
      setMixAmt(mix); setMix(mixAmtToBalance(mix))
      setDetuneAmt(det); setDetune(detuneAmtToCents(det))
      setNoiseAmt(noise); setNoise(noiseAmtToLevel(noise))
      setEnvState(e); setEnv(e)
    }
    if (tweenRef.current) cancelAnimationFrame(tweenRef.current)
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setAll(p.cutoff, p.res, p.lfoRate, p.lfoDepth, p.mixAmt, p.detuneAmt, p.noiseAmt, p.env)
      return
    }
    const s = { cutoff: cutoffAmt, res: resAmt, lr: lfoRateAmt, ld: lfoDepthAmt, mix: mixAmt, det: detuneAmt, noise: noiseAmt, ...env }
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

  return (
    <div className="app-root">
      <SynthPanel
        realized={realized}
        blinkingId={phase === 'lesson' && stage === 'blink' ? LESSONS[lessonIndex].id : null}
        sound={sound}
        showHelp={showHelp}
        onHelpFrame={(f) => setPanelPopup(f)}
        installing={installing}
        presets={PRESETS}
        onPreset={applyPreset}
        showPresets={phase === 'panel'}
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

      {menuOpen && <div className="menu-backdrop" onClick={() => { setMenuOpen(false); setTutorialMenuOpen(false) }} />}

      {/* 右上：解説表示トグル ＋ メニュー */}
      <div className="topbar">
        {phase === 'panel' && (
          <label className="help-toggle">
            <input type="checkbox" checked={showHelp} onChange={() => setShowHelp((v) => !v)} />
            解説表示
          </label>
        )}
        <div className="menu-wrap">
          <button className="menu-btn" onClick={() => setMenuOpen((o) => !o)} aria-label="メニュー">
            <span />
            <span />
            <span />
          </button>
          {menuOpen && (
            <div className="menu">
              {phase === 'panel' ? (
                <>
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
                  <button className="menu-item" onClick={() => { setMenuOpen(false); replay() }}>
                    <span className="menu-arrow" />もう一度見る
                  </button>
                </>
              ) : (
                <button className="menu-item" onClick={() => { setMenuOpen(false); skip() }}>
                  <span className="menu-arrow" />スキップ
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {popupHelp && (
        <Popup title={popupHelp.title} paragraphs={popupHelp.paragraphs} onClose={() => setPanelPopup(null)} />
      )}
    </div>
  )
}
