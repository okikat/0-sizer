import { FRAME_TITLE, type FrameId } from './lessons'
import { WaveFrame, PitchFrame, FineFrame, KeyboardModule, type SoundCtl } from './modules'
import { MockSections } from './mock'

interface Props {
  realized: Set<FrameId>
  blinkingId: FrameId | null
  sound: SoundCtl
  showHelp: boolean
  onHelpFrame: (frame: FrameId) => void
}

/** 完成形の盤面。習ったフレームは本物、未習得はゴースト枠。周りは飾り（モック）で機材感を出す。 */
export function SynthPanel({ realized, blinkingId, sound, showHelp, onHelpFrame }: Props) {
  const slotProps = (id: FrameId) => ({
    id,
    realized: realized.has(id),
    blink: blinkingId === id,
    showHelp,
    onHelp: onHelpFrame,
  })

  return (
    <div className="panel-wrap">
      <div className="panel-head">
        <span className="tag">0-sizer</span>
      </div>
      <div className="panel-grid">
        <Slot {...slotProps('wave')}>
          <WaveFrame compact type={sound.type} onType={sound.onType} playing={sound.playing} />
        </Slot>

        <div className="board">
          <Slot {...slotProps('pitch')}>
            <PitchFrame compact showText={showHelp} onTune={sound.onTune} fine={sound.fine} />
          </Slot>
          <Slot {...slotProps('fine')}>
            <FineFrame fine={sound.fine} onToggleFine={sound.onToggleFine} />
          </Slot>
          <MockSections />
        </div>

        <Slot {...slotProps('keys')}>
          <KeyboardModule onNoteOn={sound.onNoteOn} onNoteOff={sound.onNoteOff} showLabels={showHelp} />
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
  id: FrameId
  realized: boolean
  blink: boolean
  showHelp: boolean
  onHelp: (frame: FrameId) => void
  children: React.ReactNode
}) {
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
      <div className="ghost-label">{FRAME_TITLE[id]}</div>
    </div>
  )
}
