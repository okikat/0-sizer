import { useCallback, useEffect, useState } from 'react'
import { useSynth } from './audio/useSynth'
import { LESSONS, type LessonId } from './tutorial/lessons'
import type { SoundCtl } from './tutorial/modules'
import { StartScreen } from './tutorial/StartScreen'
import { IntroScreen } from './tutorial/IntroScreen'
import { SynthPanel } from './tutorial/SynthPanel'
import { LessonStage } from './tutorial/LessonStage'

type Phase = 'start' | 'intro' | 'ghost' | 'lesson' | 'panel'
type Stage = 'blink' | 'active' | 'exit'

const DONE_KEY = '0sizer.tutorialDone'
const BLINK_MS = 1150
const EXIT_MS = 520

const allIds = () => new Set<LessonId>(LESSONS.map((l) => l.id))

export default function App() {
  const { noteOn, noteOff, setWaveform, setTune } = useSynth()

  const done = typeof localStorage !== 'undefined' && localStorage.getItem(DONE_KEY) === '1'
  const [phase, setPhase] = useState<Phase>(done ? 'panel' : 'start')
  const [lessonIndex, setLessonIndex] = useState(0)
  const [stage, setStage] = useState<Stage>('blink')
  const [realized, setRealized] = useState<Set<LessonId>>(done ? allIds() : new Set())
  const [popupOpen, setPopupOpen] = useState(false)

  // --- 音まわりの状態 ---
  const [type, setType] = useState<OscillatorType>('sine')
  const [drone, setDrone] = useState(false)
  const [keyHeld, setKeyHeld] = useState(false)
  const playing = drone || keyHeld

  const stopAll = useCallback(() => {
    noteOff()
    setDrone(false)
    setKeyHeld(false)
  }, [noteOff])

  const sound: SoundCtl = {
    osc: {
      type,
      onType: (t) => {
        setType(t)
        setWaveform(t)
      },
      playing,
      drone,
      onToggleDrone: () => {
        if (drone) {
          noteOff()
          setDrone(false)
        } else {
          noteOn(69)
          setDrone(true)
        }
      },
      onTune: (v) => setTune(v),
    },
    keys: {
      onNoteOn: (m) => {
        setDrone(false)
        setKeyHeld(true)
        noteOn(m)
      },
      onNoteOff: () => {
        setKeyHeld(false)
        noteOff()
      },
    },
  }

  // 点滅→スポットライト、OK→実体化のタイミング制御。
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
      const t = setTimeout(() => {
        stopAll()
        setRealized((prev) => new Set(prev).add(LESSONS[lessonIndex].id))
        if (lessonIndex + 1 < LESSONS.length) {
          setLessonIndex(lessonIndex + 1)
          setPopupOpen(false)
          setStage('blink')
        } else {
          localStorage.setItem(DONE_KEY, '1')
          setPhase('panel')
        }
      }, EXIT_MS)
      return () => clearTimeout(t)
    }
  }, [phase, stage, lessonIndex, stopAll])

  const beginLesson = (i: number) => {
    setLessonIndex(i)
    setPopupOpen(false)
    setStage('blink')
    setPhase('lesson')
  }

  const skip = () => {
    stopAll()
    setRealized(allIds())
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

  return (
    <div className="app-root">
      <SynthPanel
        realized={realized}
        blinkingId={phase === 'lesson' && stage === 'blink' ? LESSONS[lessonIndex].id : null}
        sound={sound}
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
          popupOpen={popupOpen}
          onClosePopup={() => setPopupOpen(false)}
          onHelp={() => setPopupOpen(true)}
          onOK={() => setStage('exit')}
          sound={sound}
        />
      )}

      {(phase === 'ghost' || phase === 'lesson') && (
        <button className="skip-btn" onClick={skip}>
          スキップ
        </button>
      )}

      {phase === 'panel' && (
        <button className="replay-btn" onClick={replay}>
          もう一度見る
        </button>
      )}
    </div>
  )
}
