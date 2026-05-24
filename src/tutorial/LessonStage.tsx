import { Popup } from './Popup'
import { OscillatorModule, KeyboardModule, type SoundCtl } from './modules'
import type { Lesson } from './lessons'

export interface Flight {
  dx: number
  dy: number
  sx: number
  sy: number
}

interface Props {
  lesson: Lesson
  exiting: boolean
  flight: Flight | null
  popupOpen: boolean
  onClosePopup: () => void
  onHelp: () => void
  onOK: () => void
  sound: SoundCtl
}

/** スポットライト面：対象モジュールを中央下部に大きく出し、解説ポップアップ＋OKで盤面へ収める。 */
export function LessonStage({ lesson, exiting, flight, popupOpen, onClosePopup, onHelp, onOK, sound }: Props) {
  const flightStyle =
    exiting && flight
      ? { transform: `translate(${flight.dx}px, ${flight.dy}px) scale(${flight.sx}, ${flight.sy})`, opacity: 0 }
      : undefined

  return (
    <div className={'stage-layer' + (exiting ? ' leaving' : ' fade-in')}>
      <div className={'stage-module ' + (exiting ? 'exit' : 'enter')} data-stage-module style={flightStyle}>
        <button className="help-btn" onClick={onHelp} aria-label="ヒントをもう一度見る">
          ?
        </button>
        {lesson.id === 'osc' ? <OscillatorModule {...sound.osc} /> : <KeyboardModule {...sound.keys} />}
      </div>

      {!exiting && (
        <button className="ok-btn" onClick={onOK}>
          OK
        </button>
      )}

      {popupOpen && <Popup title={lesson.stageTitle} paragraphs={lesson.popup} onClose={onClosePopup} />}
    </div>
  )
}
