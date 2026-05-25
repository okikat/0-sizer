import { Popup } from './Popup'
import { WaveFrame, PitchFrame, FineFrame, EnvModule, FilterFrame, KeyboardModule, type SoundCtl } from './modules'
import type { Lesson } from './lessons'

interface Props {
  lesson: Lesson
  /** true = OK後の「その場でコンパクト形へ作り替える」モーフ段階。 */
  morphing: boolean
  popupOpen: boolean
  onClosePopup: () => void
  onHelp: () => void
  onOK: () => void
  sound: SoundCtl
}

/** 各フレームを data-stage-frame 付きで包む（モーフ完了時に位置を実測して飛翔ピースへ引き継ぐ）。 */
function StageContent({ lesson, sound, morph }: { lesson: Lesson; sound: SoundCtl; morph: boolean }) {
  if (lesson.id === 'keys')
    return (
      <div className="stage-frame" data-stage-frame="keys">
        <KeyboardModule onNoteOn={sound.onNoteOn} onNoteOff={sound.onNoteOff} />
      </div>
    )
  if (lesson.id === 'wave')
    return (
      <div className="stage-frame" data-stage-frame="wave">
        <WaveFrame compact={morph} morphing={morph} type={sound.type} onType={sound.onType} playing={sound.playing} />
      </div>
    )
  if (lesson.id === 'env')
    return (
      <div className="stage-frame" data-stage-frame="env">
        <EnvModule env={sound.env} onEnvChange={sound.onEnvChange} fine={sound.fine} />
      </div>
    )
  if (lesson.id === 'filter')
    return (
      <div className="stage-frame" data-stage-frame="filter">
        <FilterFrame onCutoff={sound.onCutoff} onRes={sound.onRes} fine={sound.fine} />
      </div>
    )
  return (
    <div className="pitch-cluster">
      <div className="stage-frame" data-stage-frame="pitch">
        <PitchFrame onTune={sound.onTune} fine={sound.fine} />
      </div>
      <div className="stage-frame" data-stage-frame="fine">
        <FineFrame fine={sound.fine} onToggleFine={sound.onToggleFine} />
      </div>
    </div>
  )
}

/**
 * スポットライト面：対象フレームを中央に大きく出し、解説ポップアップ＋OK で学ぶ。
 * OK を押すと morphing=true になり、その場でコンパクト形へ作り替え（WAVEなら計器が畳まれる）＋
 * 暗幕フェードでパネルが見えてくる。以降の「ホバー→滑空→着座」は FlightLayer が担当する。
 */
export function LessonStage({ lesson, morphing, popupOpen, onClosePopup, onHelp, onOK, sound }: Props) {
  return (
    <div className={'stage-layer' + (morphing ? ' leaving' : ' fade-in')}>
      <div className={'stage-module' + (morphing ? ' morphing' : ' enter')} data-stage-module>
        {!morphing && (
          <button className="help-btn" onClick={onHelp} aria-label="ヒントをもう一度見る">
            ?
          </button>
        )}
        <StageContent lesson={lesson} sound={sound} morph={morphing} />
      </div>

      {!morphing && lesson.id !== 'keys' && (
        <div className="stage-keys">
          <KeyboardModule onNoteOn={sound.onNoteOn} onNoteOff={sound.onNoteOff} />
        </div>
      )}

      {!morphing && (
        <button className="ok-btn" onClick={onOK}>
          OK
        </button>
      )}

      {popupOpen && !morphing && <Popup title={lesson.stageTitle} paragraphs={lesson.popup} onClose={onClosePopup} />}
    </div>
  )
}
