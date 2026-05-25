import { useCallback, useEffect, useRef, useState } from 'react'
import { useSynth, type EnvParams } from './audio/useSynth'
import { playGachanSound } from './audio/gachan'
import { LESSONS, ALL_FRAMES, FRAME_HELP, type FrameId } from './tutorial/lessons'
import type { SoundCtl } from './tutorial/modules'
import { StartScreen } from './tutorial/StartScreen'
import { IntroScreen } from './tutorial/IntroScreen'
import { SynthPanel } from './tutorial/SynthPanel'
import { LessonStage, type Flight } from './tutorial/LessonStage'
import { Popup } from './tutorial/Popup'

type Phase = 'start' | 'intro' | 'ghost' | 'lesson' | 'panel'
type Stage = 'blink' | 'active' | 'exit'
export type ExitPhase = 'acquire' | 'fly' | 'impact'

const DONE_KEY = '0sizer.tutorialDone'
const BLINK_MS = 1150
// インストール演出 3 段階（ソシャゲ風：獲得 → 飛翔 → 着弾）
const ACQUIRE_MS = 460   // モジュールが「獲得」されてポップ＋発光
const FLY_MS = 420       // スロットへ吸い込まれるように飛ぶ
const IMPACT_MS = 580    // 着弾：閃光・リング・火花・弾性スナップ
const EXIT_MS = ACQUIRE_MS + FLY_MS + IMPACT_MS

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

export default function App() {
  const { noteOn, noteOff, setWaveform, setTune, setEnv, setCutoff, setResonance, getAudioContext } = useSynth()

  const done = typeof localStorage !== 'undefined' && localStorage.getItem(DONE_KEY) === '1'
  const [phase, setPhase] = useState<Phase>(done ? 'panel' : 'start')
  const [lessonIndex, setLessonIndex] = useState(0)
  const [stage, setStage] = useState<Stage>('blink')
  const [realized, setRealized] = useState<Set<FrameId>>(done ? new Set(ALL_FRAMES) : new Set())
  const [popupOpen, setPopupOpen] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [panelPopup, setPanelPopup] = useState<FrameId | null>(null)
  const [flight, setFlight] = useState<Flight | null>(null)
  const [exitPhase, setExitPhase] = useState<ExitPhase | null>(null)
  const [gachanSlot, setGachanSlot] = useState<FrameId | null>(null)
  const [shaking, setShaking] = useState(false)
  const stageRectRef = useRef<DOMRect | null>(null)

  // --- 音まわりの状態 ---
  const [type, setType] = useState<OscillatorType>('sine')
  const [fine, setFine] = useState(false)
  const [keyHeld, setKeyHeld] = useState(false)
  const [env, setEnvState] = useState<EnvParams>({ attack: 0.01, decay: 0.2, sustain: 0.7, release: 0.3 })

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
    env,
    onEnvChange: (key, value) => {
      const next = { ...env, [key]: value }
      setEnvState(next)
      setEnv(next)
    },
    onCutoff: (hz) => setCutoff(hz),
    onRes: (q) => setResonance(q),
    onNoteOn: (m) => { setKeyHeld(true); noteOn(m) },
    onNoteOff: () => { setKeyHeld(false); noteOff() },
  }

  const commitExit = useCallback(() => {
    stopAll()
    setFlight(null)
    setExitPhase(null)
    setGachanSlot(null)
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

  // インストール演出の全制御：acquire → fly → impact → commitExit
  useEffect(() => {
    if (phase !== 'lesson' || stage !== 'exit') return
    const id = LESSONS[lessonIndex].id
    const timers: ReturnType<typeof setTimeout>[] = []

    // 獲得ポップ完了 → スロットへ飛ぶ（FLIP 計算）
    timers.push(setTimeout(() => {
      const dEl = document.querySelector(`[data-slot="${id}"]`) as HTMLElement | null
      const s = stageRectRef.current
      let f: Flight = { dx: 0, dy: 160, sx: 0.45, sy: 0.45 }
      if (dEl && s) {
        const d = dEl.getBoundingClientRect()
        f = {
          dx: d.left + d.width / 2 - (s.left + s.width / 2),
          dy: d.top + d.height / 2 - (s.top + s.height / 2),
          sx: clamp(d.width / s.width, 0.2, 1),
          sy: clamp(d.height / s.height, 0.2, 1),
        }
      }
      setExitPhase('fly')
      requestAnimationFrame(() => setFlight(f))
    }, ACQUIRE_MS))

    // 着弾：このタイミングでスロットを実体化＋衝撃エフェクト
    timers.push(setTimeout(() => {
      setExitPhase('impact')
      setRealized((prev) => {
        const n = new Set(prev)
        LESSONS[lessonIndex].realizes.forEach((fr) => n.add(fr))
        return n
      })
      setGachanSlot(id)
      const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (!prefersReduced) {
        setShaking(true)
        setTimeout(() => setShaking(false), 240)
        const ctx = getAudioContext()
        if (ctx) playGachanSound(ctx)
        navigator.vibrate?.([14, 10, 20])
      }
    }, ACQUIRE_MS + FLY_MS))

    timers.push(setTimeout(commitExit, EXIT_MS))

    return () => timers.forEach(clearTimeout)
  }, [phase, stage, lessonIndex, commitExit, getAudioContext])

  const beginLesson = (i: number) => {
    setFlight(null)
    setExitPhase(null)
    setLessonIndex(i)
    setPopupOpen(false)
    setStage('blink')
    setPhase('lesson')
  }

  const onOK = () => {
    const sEl = document.querySelector('[data-stage-module]') as HTMLElement | null
    stageRectRef.current = sEl ? sEl.getBoundingClientRect() : null
    // 実体化は「着弾」の瞬間まで遅らせる（飛んできて嵌まる瞬間に枠が埋まる）
    setPopupOpen(false)
    setStage('exit')
    setExitPhase('acquire')
  }

  const skip = () => {
    stopAll()
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
    setFlight(null)
    setPhase('intro')
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
        shaking={shaking}
        gachanSlot={gachanSlot}
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
          flight={flight}
          popupOpen={popupOpen}
          onClosePopup={() => setPopupOpen(false)}
          onHelp={() => setPopupOpen(true)}
          onOK={onOK}
          sound={sound}
        />
      )}

      {menuOpen && <div className="menu-backdrop" onClick={() => setMenuOpen(false)} />}

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
                <button onClick={() => { setMenuOpen(false); replay() }}>
                  もう一度見る
                </button>
              ) : (
                <button onClick={() => { setMenuOpen(false); skip() }}>
                  スキップ
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
