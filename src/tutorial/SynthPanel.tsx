import { useLayoutEffect, useRef, type RefObject } from 'react'
import { type FrameId } from './lessons'
import { WaveFrame, PitchFrame, FineFrame, EnvModule, FilterFrame, KeyboardModule, type SoundCtl } from './modules'
import { MockSections } from './mock'

const COLS = 8
const GAP = 0

// パネルに刻印するモジュール名（hardware シルクスクリーン風）。
// WAVE/ENV/PITCH/FINE はボタンや自前ラベルと被るので刻印しない。
const PANEL_LABELS: Partial<Record<FrameId, string>> = {
  filter: 'FILTER',
}

function useCellSize(ref: RefObject<HTMLDivElement | null>) {
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => {
      const w = el.clientWidth
      if (w > 0) el.style.setProperty('--cell', `${(w - (COLS - 1) * GAP) / COLS}px`)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
}

interface Props {
  realized: Set<FrameId>
  blinkingId: FrameId | null
  sound: SoundCtl
  showHelp: boolean
  onHelpFrame: (frame: FrameId) => void
  /** いま着座した（取り付いた瞬間の）フレーム群。ごく薄い光で迎える。 */
  installing: Set<FrameId>
}

export function SynthPanel({ realized, blinkingId, sound, showHelp, onHelpFrame, installing }: Props) {
  const gridRef = useRef<HTMLDivElement>(null)
  useCellSize(gridRef)

  const slotProps = (id: FrameId) => ({
    id,
    realized: realized.has(id),
    blink: blinkingId === id,
    showHelp,
    onHelp: onHelpFrame,
    seating: installing.has(id),
  })

  return (
    <div className="panel-wrap">
      <div className="panel-head">
        <span className="tag">0-sizer</span>
      </div>

      <div className="panel-scroll">
        <div className="panel-board">
          <div className="grid" ref={gridRef}>
            <Slot {...slotProps('wave')}>
              <WaveFrame compact type={sound.type} onType={sound.onType} playing={sound.playing} />
            </Slot>
            <Slot {...slotProps('pitch')}>
              <PitchFrame compact showText={showHelp} onTune={sound.onTune} fine={sound.fine} snap={sound.snap} />
            </Slot>
            <Slot {...slotProps('fine')}>
              <FineFrame fine={sound.fine} onToggleFine={sound.onToggleFine} snap={sound.snap} onToggleSnap={sound.onToggleSnap} />
            </Slot>
            <Slot {...slotProps('env')}>
              <EnvModule compact env={sound.env} onEnvChange={sound.onEnvChange} fine={sound.fine} snap={sound.snap} />
            </Slot>
            <Slot {...slotProps('filter')}>
              <FilterFrame compact showText={showHelp} onCutoff={sound.onCutoff} onRes={sound.onRes} fine={sound.fine} snap={sound.snap} />
            </Slot>
            <MockSections />
          </div>
        </div>
      </div>

      <Slot {...slotProps('keys')}>
        {realized.has('keys') ? (
          <KeyboardModule onNoteOn={sound.onNoteOn} onNoteOff={sound.onNoteOff} showLabels={showHelp} />
        ) : null}
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
  seating,
  children,
}: {
  id: FrameId
  realized: boolean
  blink: boolean
  showHelp: boolean
  onHelp: (frame: FrameId) => void
  seating: boolean
  children: React.ReactNode
}) {
  // ゴーストは出さない。未習得は「空きベイ」、習得すると実体が嵌まる。
  const cls = 'slot slot-' + id + (realized ? ' filled' + (seating ? ' seating' : '') : ' empty' + (blink ? ' blink' : ''))

  return (
    <div className={cls} data-slot={id}>
      {realized && PANEL_LABELS[id] && <span className="slot-label">{PANEL_LABELS[id]}</span>}
      {realized && showHelp && (
        <button className="slot-help" onClick={() => onHelp(id)} aria-label="この解説をもう一度見る">
          ?
        </button>
      )}
      {realized && children}
    </div>
  )
}
