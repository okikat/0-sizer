import type { CSSProperties } from 'react'
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
  /** null = active（通常表示）。'acquire' → 'fly' → 'seat' → 'impact' の順でインストール演出が進行。 */
  exitPhase: 'acquire' | 'fly' | 'seat' | 'impact' | null
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
 * インストール演出 4 段階：
 *   acquire  獲得：モジュールがポップして発光（暗幕はフェードしてパネルが見えてくる）
 *   fly      取付口の真上へゆっくり寄せ、少し浮かせて位置をそろえる（減速）
 *   seat     そのまま押し込んで、ぴったり嵌める
 *   impact   嵌まり切った瞬間に消え、スロット側で実体化＋衝撃エフェクト
 */
export function LessonStage({ lesson, exitPhase, flight, popupOpen, onClosePopup, onHelp, onOK, sound }: Props) {
  const exiting = exitPhase !== null

  // fly = 取付口の少し上で一回り大きく浮かせる／seat・impact = ぴったり嵌める位置へ。
  let flightStyle: CSSProperties | undefined
  if (flight && exitPhase === 'fly') {
    flightStyle = { transform: `translate(${flight.dx}px, ${flight.dy - 12}px) scale(${flight.sx * 1.08}, ${flight.sy * 1.08})` }
  } else if (flight && (exitPhase === 'seat' || exitPhase === 'impact')) {
    flightStyle = { transform: `translate(${flight.dx}px, ${flight.dy}px) scale(${flight.sx}, ${flight.sy})` }
  }

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
