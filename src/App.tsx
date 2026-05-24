import { useCallback, useEffect, useRef, useState } from 'react'
import { useSynth } from './audio/useSynth'
import { LESSONS, ALL_FRAMES, lessonForFrame, type FrameId } from './tutorial/lessons'
import type { SoundCtl } from './tutorial/modules'
import { StartScreen } from './tutorial/StartScreen'
import { IntroScreen } from './tutorial/IntroScreen'
import { SynthPanel } from './tutorial/SynthPanel'
import { LessonStage, type Flight } from './tutorial/LessonStage'
import { Popup } from './tutorial/Popup'

type Phase = 'start' | 'intro' | 'ghost' | 'lesson' | 'panel'
type Stage = 'blink' | 'active' | 'exit'

const DONE_KEY = '0sizer.tutorialDone'
const BLINK_MS = 1150
const EXIT_MS = 560

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

export default function App() {
  const { noteOn, noteOff, setWaveform, setTune } = useSynth()

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
  const stageRectRef = useRef<DOMRect | null>(null)

  // --- 音まわりの状態（音源は鍵盤。ドローン/鳴らすボタンは廃止） ---
  const [type, setType] = useState<OscillatorType>('sine')
  const [fine, setFine] = useState(false)
  const [keyHeld, setKeyHeld] = useState(false)

  const stopAll = useCallback(() => {
    noteOff()
    setKeyHeld(false)
  }, [noteOff])

  const sound: SoundCtl = {
    type,
    onType: (t) => {
      setType(t)
      setWaveform(t)
    },
    playing: keyHeld,
    onTune: (v) => setTune(v),
    fine,
    onToggleFine: () => setFine((v) => !v),
    onNoteOn: (m) => {
      setKeyHeld(true)
      noteOn(m)
    },
    onNoteOff: () => {
      setKeyHeld(false)
      noteOff()
    },
  }

  const commitExit = useCallback(() => {
    stopAll()
    setFlight(null)
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

  // 点滅→スポットライト→（OK後）盤面へ収まる、のタイミング制御。
  useEffect(() => {
    if (phase !== 'lesson') return
    if (stage === 'blink') {
      const t = setTimeout(() => {
        setStage('active')
        setPopupOpen(true)
      }, BLINK_MS)
      return () => clearTimeout(t)
    }
    if (stage === 'exit') {
      const t = setTimeout(commitExit, EXIT_MS)
      return () => clearTimeout(t)
    }
  }, [phase, stage, commitExit])

  // OK 後、ステージのモジュールを「実体化した盤面スロット」の位置・大きさへ飛ばす（FLIP）。
  useEffect(() => {
    if (phase !== 'lesson' || stage !== 'exit') return
    const id = LESSONS[lessonIndex].id
    const dEl = document.querySelector(`[data-slot="${id}"]`) as HTMLElement | null
    const s = stageRectRef.current
    let f: Flight = { dx: 0, dy: 140, sx: 0.5, sy: 0.5 }
    if (dEl && s) {
      const d = dEl.getBoundingClientRect()
      f = {
        dx: d.left + d.width / 2 - (s.left + s.width / 2),
        dy: d.top + d.height / 2 - (s.top + s.height / 2),
        sx: clamp(d.width / s.width, 0.2, 1),
        sy: clamp(d.height / s.height, 0.2, 1),
      }
    }
    const raf = requestAnimationFrame(() => setFlight(f))
    return () => cancelAnimationFrame(raf)
  }, [phase, stage, lessonIndex])

  const beginLesson = (i: number) => {
    setFlight(null)
    setLessonIndex(i)
    setPopupOpen(false)
    setStage('blink')
    setPhase('lesson')
  }

  const onOK = () => {
    const sEl = document.querySelector('[data-stage-module]') as HTMLElement | null
    stageRectRef.current = sEl ? sEl.getBoundingClientRect() : null
    setRealized((prev) => {
      const n = new Set(prev)
      LESSONS[lessonIndex].realizes.forEach((f) => n.add(f))
      return n
    })
    setPopupOpen(false)
    setStage('exit')
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
    setPhase('intro')
  }

  if (phase === 'start') return <StartScreen onStart={() => setPhase('intro')} />
  if (phase === 'intro') return <IntroScreen onDone={() => setPhase('ghost')} />

  const popupLesson = panelPopup ? lessonForFrame(panelPopup) : null

  return (
    <div className="app-root">
      <SynthPanel
        realized={realized}
        blinkingId={phase === 'lesson' && stage === 'blink' ? LESSONS[lessonIndex].id : null}
        sound={sound}
        showHelp={showHelp}
        onHelpFrame={(f) => setPanelPopup(f)}
      />

      {phase === 'ghost' && (
        <div className="ghost-cta fade-in">
          <p className="ghost-cta-text">これがキミのシンセ。ひとつずつ組み立てよう。</p>
          <button className="cta" onClick={() => beginLesson(0)}>
            組み立てる
          </button>
        </div>
      )}

      {phase === 'lesson' && (stage === 'active' || stage === 'exit') && (
        <LessonStage
          lesson={LESSONS[lessonIndex]}
          exiting={stage === 'exit'}
          flight={flight}
          popupOpen={popupOpen}
          onClosePopup={() => setPopupOpen(false)}
          onHelp={() => setPopupOpen(true)}
          onOK={onOK}
          sound={sound}
        />
      )}

      {menuOpen && <div className="menu-backdrop" onClick={() => setMenuOpen(false)} />}

      {/* 右上：解説表示トグル ＋ メニュー（三） */}
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
                <button
                  onClick={() => {
                    setMenuOpen(false)
                    replay()
                  }}
                >
                  もう一度見る
                </button>
              ) : (
                <button
                  onClick={() => {
                    setMenuOpen(false)
                    skip()
                  }}
                >
                  スキップ
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {popupLesson && (
        <Popup title={popupLesson.stageTitle} paragraphs={popupLesson.popup} onClose={() => setPanelPopup(null)} />
      )}
    </div>
  )
}
