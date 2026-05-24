import { Popup } from './Popup'
import { OscillatorModule, KeyboardModule, type SoundCtl } from './modules'
import type { Lesson } from './lessons'

interface Props {
  lesson: Lesson
  exiting: boolean
  popupOpen: boolean
  onClosePopup: () => void
  onHelp: () => void
  onOK: () => void
  sound: SoundCtl
}

/** スポットライト面：対象モジュールを中央下部に大きく出し、解説ポップアップ＋OKで実体化させる。 */
export function LessonStage({ lesson, exiting, popupOpen, onClosePopup, onHelp, onOK, sound }: Props) {
  return (
    <div className="stage-layer fade-in">
      <div className={'stage-module' + (exiting ? ' exit' : ' enter')}>
        <button className="help-btn" onClick={onHelp} aria-label="ヒントをもう一度見る">
          ?
        </button>
        {lesson.id === 'osc' ? <OscillatorModule {...sound.osc} /> : <KeyboardModule {...sound.keys} />}
      </div>

      <button className="ok-btn" onClick={onOK}>
        OK
      </button>

      {popupOpen && <Popup title={lesson.stageTitle} paragraphs={lesson.popup} onClose={onClosePopup} />}
    </div>
  )
}
