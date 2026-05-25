import { useCallback, useEffect, useState } from 'react'
import { useSynth, type EnvParams } from './audio/useSynth'
import { playSeatClick } from './audio/gachan'
import { LESSONS, ALL_FRAMES, FRAME_HELP, type FrameId } from './tutorial/lessons'
import type { SoundCtl } from './tutorial/modules'
import { StartScreen } from './tutorial/StartScreen'
import { IntroScreen } from './tutorial/IntroScreen'
import { SynthPanel } from './tutorial/SynthPanel'
import { LessonStage } from './tutorial/LessonStage'
import { FlightLayer, type Flyer, type FlightPhase } from './tutorial/FlightLayer'
import { Popup } from './tutorial/Popup'

type Phase = 'start' | 'intro' | 'ghost' | 'lesson' | 'panel'
type Stage = 'blink' | 'active' | 'exit'
// インストール演出：その場でコンパクト形へ作り替え → 少し浮く → 定位置へ滑空 → 着座。
export type ExitPhase = 'morph' | FlightPhase

const DONE_KEY = '0sizer.tutorialDone'
const BLINK_MS = 1150
const MORPH_MS = 480 // OK後：コンパクト形へ作り替え（WAVEは計器が畳まれる）＋暗幕フェード
const HOVER_MS = 360 // 取付口の少し上で浮く
const GLIDE_MS = 760 // ゆっくり定位置へ
const SEAT_MS = 420 // 着座（カチャ＋ごく薄い光）
const EXIT_MS = MORPH_MS + HOVER_MS + GLIDE_MS + SEAT_MS

const toRect = (el: Element) => {
  const r = el.getBoundingClientRect()
  return { left: r.left, top: r.top, width: r.width, height: r.height }
}

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
  const [exitPhase, setExitPhase] = useState<ExitPhase | null>(null)
  const [flyers, setFlyers] = useState<Flyer[]>([])
  const [installing, setInstalling] = useState<Set<FrameId>>(new Set())

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
    setFlyers([])
    setInstalling(new Set())
    setExitPhase(null)
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

  // インストール演出の全制御：morph →（実測してピース化）→ hover → glide → seat → commit
  useEffect(() => {
    if (phase !== 'lesson' || stage !== 'exit') return
    const frames = LESSONS[lessonIndex].realizes
    const timers: ReturnType<typeof setTimeout>[] = []

    // モーフ完了：各フレームの現在位置（コンパクト形）と取付先スロットを実測して飛翔ピースに。
    timers.push(setTimeout(() => {
      const fls: Flyer[] = []
      frames.forEach((fid) => {
        const sEl = document.querySelector(`[data-stage-frame="${fid}"]`)
        const dEl = document.querySelector(`[data-slot="${fid}"]`)
        if (sEl && dEl) fls.push({ id: fid, start: toRect(sEl), dest: toRect(dEl) })
      })
      setFlyers(fls)
      setExitPhase('hover')
    }, MORPH_MS))

    // ホバー → 滑空
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

  const beginLesson = (i: number) => {
    setFlyers([])
    setInstalling(new Set())
    setExitPhase(null)
    setLessonIndex(i)
    setPopupOpen(false)
    setStage('blink')
    setPhase('lesson')
  }

  const onOK = () => {
    // OK で「その場でコンパクト形へ作り替え（morph）」開始。実体化は着座の瞬間まで遅らせる。
    setPopupOpen(false)
    setStage('exit')
    setExitPhase('morph')
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
    setFlyers([])
    setInstalling(new Set())
    setPhase('intro')
  }

  if (phase === 'start') return <StartScreen onStart={() => setPhase('intro')} />
  if (phase === 'intro') return <IntroScreen onDone={() => setPhase('ghost')} />

  const popupHelp = panelPopup ? FRAME_HELP[panelPopup] : null
  const flightPhase: FlightPhase | null =
    exitPhase === 'hover' || exitPhase === 'glide' || exitPhase === 'seat' ? exitPhase : null

  return (
    <div className="app-root">
      <SynthPanel
        realized={realized}
        blinkingId={phase === 'lesson' && stage === 'blink' ? LESSONS[lessonIndex].id : null}
        sound={sound}
        showHelp={showHelp}
        onHelpFrame={(f) => setPanelPopup(f)}
        installing={installing}
      />

      {phase === 'ghost' && (
        <div className="ghost-cta fade-in">
          <p className="ghost-cta-text">空っぽのパネル。ここにキミだけのシンセを組み上げよう。</p>
          <button className="cta" onClick={() => beginLesson(0)}>
            組み立てる
          </button>
        </div>
      )}

      {phase === 'lesson' && (stage === 'active' || exitPhase === 'morph') && (
        <LessonStage
          lesson={LESSONS[lessonIndex]}
          morphing={exitPhase === 'morph'}
          popupOpen={popupOpen}
          onClosePopup={() => setPopupOpen(false)}
          onHelp={() => setPopupOpen(true)}
          onOK={onOK}
          sound={sound}
        />
      )}

      {flightPhase && flyers.length > 0 && <FlightLayer flyers={flyers} phase={flightPhase} sound={sound} />}

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
