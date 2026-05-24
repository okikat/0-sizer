import { LESSONS, type LessonId } from './lessons'
import { OscillatorModule, KeyboardModule, type SoundCtl } from './modules'
import { MockSections } from './mock'

interface Props {
  realized: Set<LessonId>
  blinkingId: LessonId | null
  sound: SoundCtl
  showHelp: boolean
  onToggleHelp: () => void
  onHelpLesson: (id: LessonId) => void
}

/** 完成形の盤面。習ったモジュールは本物、未習得はゴースト枠。周りは飾り（モック）で機材感を出す。 */
export function SynthPanel({ realized, blinkingId, sound, showHelp, onToggleHelp, onHelpLesson }: Props) {
  return (
    <div className="panel-wrap">
      <div className="panel-head">
        <span className="tag">0-sizer</span>
        <label className="help-toggle">
          <input type="checkbox" checked={showHelp} onChange={onToggleHelp} />
          解説表示
        </label>
      </div>
      <div className="panel-grid">
        <Slot id="osc" realized={realized.has('osc')} blink={blinkingId === 'osc'} showHelp={showHelp} onHelp={onHelpLesson}>
          <OscillatorModule compact showText={showHelp} {...sound.osc} />
        </Slot>

        <MockSections />

        <Slot id="keys" realized={realized.has('keys')} blink={blinkingId === 'keys'} showHelp={showHelp} onHelp={onHelpLesson}>
          <KeyboardModule {...sound.keys} />
        </Slot>
      </div>
    </div>
  )
}

function Slot({
  id,
  realized,
  blink,
  showHelp,
  onHelp,
  children,
}: {
  id: LessonId
  realized: boolean
  blink: boolean
  showHelp: boolean
  onHelp: (id: LessonId) => void
  children: React.ReactNode
}) {
  const lesson = LESSONS.find((l) => l.id === id)!
  if (realized) {
    return (
      <div className={'slot slot-' + id + ' pop-in'} data-slot={id}>
        {showHelp && (
          <button className="slot-help" onClick={() => onHelp(id)} aria-label="この解説をもう一度見る">
            ?
          </button>
        )}
        {children}
      </div>
    )
  }
  return (
    <div className={'slot slot-' + id + ' ghost' + (blink ? ' blink' : '')} data-slot={id}>
      <div className="ghost-label">{lesson.panelTitle}</div>
    </div>
  )
}
