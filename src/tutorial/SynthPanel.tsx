import { type FrameId } from './lessons'
import { WaveFrame, PitchFrame, FineFrame, EnvModule, KeyboardModule, KeyboardGhost, type SoundCtl } from './modules'
import { MockSections } from './mock'

interface Props {
  realized: Set<FrameId>
  blinkingId: FrameId | null
  sound: SoundCtl
  showHelp: boolean
  onHelpFrame: (frame: FrameId) => void
}

/** 完成形の盤面。未習得のフレームも実体を薄く（ゴースト）表示し、習うと色がつく。周りは飾り（モック）。 */
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

      {/* ツマミ類はスクロール領域、鍵盤は下に固定 */}
      <div className="panel-scroll">
        <Slot {...slotProps('wave')}>
          <WaveFrame compact type={sound.type} onType={sound.onType} playing={sound.playing} />
        </Slot>

        <div className="board">
          <Slot {...slotProps('env')}>
            <EnvModule compact env={sound.env} onEnvChange={sound.onEnvChange} fine={sound.fine} />
          </Slot>
          <div className="side-col">
            <Slot {...slotProps('pitch')}>
              <PitchFrame compact showText={showHelp} onTune={sound.onTune} fine={sound.fine} />
            </Slot>
            <Slot {...slotProps('fine')}>
              <FineFrame fine={sound.fine} onToggleFine={sound.onToggleFine} />
            </Slot>
          </div>
          <div className="mock-area">
            <MockSections />
          </div>
        </div>
      </div>

      <Slot {...slotProps('keys')}>
        {realized.has('keys') ? (
          <KeyboardModule onNoteOn={sound.onNoteOn} onNoteOff={sound.onNoteOff} showLabels={showHelp} />
        ) : (
          <KeyboardGhost />
        )}
      </Slot>
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
  const cls = 'slot slot-' + id + (realized ? ' pop-in' : ' ghost' + (blink ? ' blink' : ''))
  return (
    <div className={cls} data-slot={id}>
      {realized && showHelp && (
        <button className="slot-help" onClick={() => onHelp(id)} aria-label="この解説をもう一度見る">
          ?
        </button>
      )}
      {children}
    </div>
  )
}
