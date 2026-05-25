import { useLayoutEffect, useRef, type RefObject } from 'react'
import { type FrameId } from './lessons'
import { WaveFrame, PitchFrame, FineFrame, EnvModule, FilterFrame, KeyboardModule, KeyboardGhost, type SoundCtl } from './modules'
import { MockSections } from './mock'

const COLS = 8
const GAP = 8

// パネルに刻印するモジュール名（hardware シルクスクリーン風）
const PANEL_LABELS: Partial<Record<FrameId, string>> = {
  wave: 'WAVE',
  env: 'ENV',
  filter: 'FILTER',
  pitch: 'PITCH',
  fine: 'FINE',
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
  shaking: boolean
  gachanSlot: FrameId | null
}

export function SynthPanel({ realized, blinkingId, sound, showHelp, onHelpFrame, shaking, gachanSlot }: Props) {
  const gridRef = useRef<HTMLDivElement>(null)
  useCellSize(gridRef)

  const slotProps = (id: FrameId) => ({
    id,
    realized: realized.has(id),
    blink: blinkingId === id,
    showHelp,
    onHelp: onHelpFrame,
    gachan: gachanSlot === id,
  })

  return (
    <div className={'panel-wrap' + (shaking ? ' shake' : '')}>
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
              <PitchFrame compact showText={showHelp} onTune={sound.onTune} fine={sound.fine} />
            </Slot>
            <Slot {...slotProps('fine')}>
              <FineFrame fine={sound.fine} onToggleFine={sound.onToggleFine} />
            </Slot>
            <Slot {...slotProps('env')}>
              <EnvModule compact env={sound.env} onEnvChange={sound.onEnvChange} fine={sound.fine} />
            </Slot>
            <Slot {...slotProps('filter')}>
              <FilterFrame compact showText={showHelp} onCutoff={sound.onCutoff} onRes={sound.onRes} fine={sound.fine} />
            </Slot>
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
  gachan,
  children,
}: {
  id: FrameId
  realized: boolean
  blink: boolean
  showHelp: boolean
  onHelp: (frame: FrameId) => void
  gachan: boolean
  children: React.ReactNode
}) {
  const cls =
    'slot slot-' +
    id +
    (realized
      ? ' pop-in' + (gachan ? ' gachan' : '')
      : ' ghost' + (blink ? ' blink' : ''))

  return (
    <div className={cls} data-slot={id}>
      {/* パネル刻印ラベル（hardware シルクスクリーン風） */}
      {PANEL_LABELS[id] && (
        <span className="slot-label">{PANEL_LABELS[id]}</span>
      )}
      {realized && showHelp && (
        <button className="slot-help" onClick={() => onHelp(id)} aria-label="この解説をもう一度見る">
          ?
        </button>
      )}
      {children}
    </div>
  )
}
