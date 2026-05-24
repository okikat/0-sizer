import { LESSONS, type LessonId } from './lessons'
import { OscillatorModule, KeyboardModule, type SoundCtl } from './modules'

interface Props {
  realized: Set<LessonId>
  blinkingId: LessonId | null
  sound: SoundCtl
}

/** 完成形の盤面。各モジュールは「実体化済み＝本物」か「未習得＝ゴースト枠」で表示する。 */
export function SynthPanel({ realized, blinkingId, sound }: Props) {
  return (
    <div className="panel-wrap">
      <div className="panel-head">
        <span className="tag">0-sizer</span>
      </div>
      <div className="panel-grid">
        <Slot id="osc" realized={realized.has('osc')} blink={blinkingId === 'osc'}>
          <OscillatorModule {...sound.osc} />
        </Slot>
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
