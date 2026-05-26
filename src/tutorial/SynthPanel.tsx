import { useLayoutEffect, useRef, type RefObject } from 'react'
import { type FrameId } from './lessons'
import { type Preset } from './presets'
import { WaveFrame, PitchFrame, FineFrame, SnapFrame, EnvModule, FilterFrame, LfoFrame, MixFrame, Osc2Frame, NoiseFrame, KeyboardModule, type SoundCtl } from './modules'

const COLS = 8
const GAP = 0

// パネルに刻印するモジュール名（hardware シルクスクリーン風）。
// WAVE/ENV/PITCH/FINE はボタンや自前ラベルと被るので刻印しない。
const PANEL_LABELS: Partial<Record<FrameId, string>> = {
  filter: 'FILTER',
  lfo: 'LFO',
  mix: 'MIX',
  osc2: 'OSC2',
  noise: 'NOISE',
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
  presets: Preset[]
  onPreset: (p: Preset) => void
  /** プリセット帯を出すか（チュートリアル完了後＝パネル時のみ）。 */
  showPresets: boolean
}

export function SynthPanel({ realized, blinkingId, sound, showHelp, onHelpFrame, installing, presets, onPreset, showPresets }: Props) {
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

      {showPresets && (
        <div className="preset-bar">
          <span className="preset-label">PRESET</span>
          <div className="preset-list">
            {presets.map((p) => (
              <button key={p.name} className="preset-btn" onClick={() => onPreset(p)}>
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}

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
              <FineFrame fine={sound.fine} onToggleFine={sound.onToggleFine} />
            </Slot>
            <Slot {...slotProps('snap')}>
              <SnapFrame snap={sound.snap} onToggleSnap={sound.onToggleSnap} />
            </Slot>
            <Slot {...slotProps('env')}>
              <EnvModule compact env={sound.env} onEnvChange={sound.onEnvChange} fine={sound.fine} snap={sound.snap} />
            </Slot>
            <Slot {...slotProps('filter')}>
              <FilterFrame compact showText={showHelp} cutoff={sound.cutoff} onCutoff={sound.onCutoff} res={sound.res} onRes={sound.onRes} fine={sound.fine} snap={sound.snap} />
            </Slot>
            <Slot {...slotProps('lfo')}>
              <LfoFrame compact showText={showHelp} lfoRate={sound.lfoRate} onLfoRate={sound.onLfoRate} lfoDepth={sound.lfoDepth} onLfoDepth={sound.onLfoDepth} fine={sound.fine} snap={sound.snap} />
            </Slot>
            <Slot {...slotProps('mix')}>
              <MixFrame compact showText={showHelp} onVol={sound.onVol} onPan={sound.onPan} fine={sound.fine} snap={sound.snap} />
            </Slot>
            <Slot {...slotProps('osc2')}>
              <Osc2Frame compact showText={showHelp} mix={sound.mix} onMix={sound.onMix} detune={sound.detune} onDetune={sound.onDetune} fine={sound.fine} snap={sound.snap} />
            </Slot>
            <Slot {...slotProps('noise')}>
              <NoiseFrame compact showText={showHelp} noise={sound.noise} onNoise={sound.onNoise} fine={sound.fine} snap={sound.snap} />
            </Slot>
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
