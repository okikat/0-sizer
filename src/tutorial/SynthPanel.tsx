import { LESSONS, type LessonId } from './lessons'
import { OscillatorModule, KeyboardModule, type SoundCtl } from './modules'
import { MockSections } from './mock'

interface Props {
  realized: Set<LessonId>
  blinkingId: LessonId | null
  sound: SoundCtl
}

/** 完成形の盤面。習ったモジュールは本物、未習得はゴースト枠。周りは飾り（モック）で機材感を出す。 */
export function SynthPanel({ realized, blinkingId, sound }: Props) {
  return (
    <div className="panel-wrap">
      <div className="panel-head">
        <span className="tag">0-sizer</span>
      </div>
      <div className="panel-grid">
        <Slot id="osc" realized={realized.has('osc')} blink={blinkingId === 'osc'}>
          <OscillatorModule compact {...sound.osc} />
        </Slot>

        <MockSections />

        <Slot id="keys" realized={realized.has('keys')} blink={blinkingId === 'keys'}>
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
  children,
}: {
  id: LessonId
  realized: boolean
  blink: boolean
  children: React.ReactNode
}) {
  const lesson = LESSONS.find((l) => l.id === id)!
  if (realized) return <div className={'slot slot-' + id + ' pop-in'}>{children}</div>
  return (
    <div className={'slot slot-' + id + ' ghost' + (blink ? ' blink' : '')}>
      <div className="ghost-label">{lesson.panelTitle}</div>
    </div>
  )
}
