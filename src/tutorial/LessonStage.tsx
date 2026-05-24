import { Popup } from './Popup'
import { WaveFrame, PitchFrame, FineFrame, EnvModule, FilterFrame, KeyboardModule, type SoundCtl } from './modules'
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

function StageContent({ lesson, sound }: { lesson: Lesson; sound: SoundCtl }) {
  if (lesson.id === 'keys') return <KeyboardModule onNoteOn={sound.onNoteOn} onNoteOff={sound.onNoteOff} />
  if (lesson.id === 'wave') return <WaveFrame type={sound.type} onType={sound.onType} playing={sound.playing} />
  if (lesson.id === 'env')
    return <EnvModule env={sound.env} onEnvChange={sound.onEnvChange} fine={sound.fine} />
  if (lesson.id === 'filter')
    return <FilterFrame onCutoff={sound.onCutoff} onRes={sound.onRes} fine={sound.fine} />
  return (
    <div className="pitch-cluster">
      <PitchFrame onTune={sound.onTune} fine={sound.fine} />
      <FineFrame fine={sound.fine} onToggleFine={sound.onToggleFine} />
    </div>
  )
}

/** スポットライト面：対象フレームを中央に大きく出し、解説ポップアップ＋OKで盤面へ収める。
 * 鍵盤以外のレッスンでは、下に試し弾き用の鍵盤を置く（「鳴らす」ボタンの代わり）。
 *
 * exit フェーズは 2 段階：
 *   anticipate（flight=null）: モジュールが pull-back する予備動作
 *   slam（flight!=null）:      ease-in で一気にスロットへ突き刺さる
 */
export function LessonStage({ lesson, exiting, flight, popupOpen, onClosePopup, onHelp, onOK, sound }: Props) {
  const flightStyle =
    exiting && flight
      ? { transform: `translate(${flight.dx}px, ${flight.dy}px) scale(${flight.sx}, ${flight.sy})`, opacity: 0 }
      : undefined

  // exit フェーズを予備動作(anticipate) とスラム(slam) に分ける
  const moduleClass =
    'stage-module ' +
    (exiting ? 'exit ' + (flight ? 'slam' : 'anticipate') : 'enter')

  return (
    <div className={'stage-layer' + (exiting ? ' leaving' : ' fade-in')}>
      <div className={moduleClass} data-stage-module style={flightStyle}>
        <button className="help-btn" onClick={onHelp} aria-label="ヒントをもう一度見る">
          ?
        </button>
        <StageContent lesson={lesson} sound={sound} />
      </div>

      {!exiting && lesson.id !== 'keys' && (
        <div className="stage-keys">
          <KeyboardModule onNoteOn={sound.onNoteOn} onNoteOff={sound.onNoteOff} />
        </div>
      )}

      {!exiting && (
        <button className="ok-btn" onClick={onOK}>
          OK
        </button>
      )}

      {popupOpen && <Popup title={lesson.stageTitle} paragraphs={lesson.popup} onClose={onClosePopup} />}
    </div>
  )
}
