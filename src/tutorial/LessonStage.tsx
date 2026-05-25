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
  /** null = active（通常表示）。'acquire' → 'fly' → 'impact' の順でインストール演出が進行。 */
  exitPhase: 'acquire' | 'fly' | 'impact' | null
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

/**
 * スポットライト面：対象フレームを中央に大きく出し、解説ポップアップ＋OK で盤面へ収める。
 *
 * インストール演出 3 段階：
 *   acquire  獲得：モジュールがポップして発光（暗幕はフェードしてパネルが見えてくる）
 *   fly      飛翔：スロットへ吸い込まれるように縮小移動（FLIP）
 *   impact   着弾：到達点で消え、スロット側で実体化＋衝撃エフェクト
 */
export function LessonStage({ lesson, exitPhase, flight, popupOpen, onClosePopup, onHelp, onOK, sound }: Props) {
  const exiting = exitPhase !== null

  // fly / impact では FLIP の到達位置へ移動。impact では CSS 側で opacity:0。
  const flightStyle =
    (exitPhase === 'fly' || exitPhase === 'impact') && flight
      ? { transform: `translate(${flight.dx}px, ${flight.dy}px) scale(${flight.sx}, ${flight.sy})` }
      : undefined

  const moduleClass = 'stage-module ' + (!exiting ? 'enter' : 'exit ' + exitPhase)

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
