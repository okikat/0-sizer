import { useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react'
import { type FrameId } from './lessons'
import { WaveFrame, PitchFrame, FineFrame, SnapFrame, EnvModule, FilterFrame, LfoFrame, MixFrame, Osc2Frame, NoiseFrame, DelayFrame, GlideFrame, FilterEnvFrame, ReverbFrame, KeyboardModule, type SoundCtl } from './modules'

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
  delay: 'DELAY',
  glide: 'GLIDE',
  fenv: 'FILTER ENV',
  reverb: 'REVERB',
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

export type PanelTab = 'panel' | 'seq'

interface Props {
  realized: Set<FrameId>
  blinkingId: FrameId | null
  sound: SoundCtl
  showHelp: boolean
  onHelpFrame: (frame: FrameId) => void
  /** いま着座した（取り付いた瞬間の）フレーム群。ごく薄い光で迎える。 */
  installing: Set<FrameId>
  /** タブ切替を有効にするか（チュートリアル完了後＝パネル時のみ）。 */
  showTabRow: boolean
  activeTab: PanelTab
  onTab: (t: PanelTab) => void
  onOpenPresets: () => void
  /** SEQ 再生中なら SEQ タブにティールのドットを灯す（緩和策：裏で鳴ってる合図）。 */
  seqPlaying: boolean
  /** ハンバーガーメニュー（折り畳み中身は親が決める）。 */
  menuOpen: boolean
  onMenuToggle: () => void
  menuChildren: ReactNode
  /** SEQ タブのとき表示する中身（App が SeqPanel を渡す）。 */
  seqContent: ReactNode
}

export function SynthPanel({
  realized,
  blinkingId,
  sound,
  showHelp,
  onHelpFrame,
  installing,
  showTabRow,
  activeTab,
  onTab,
  onOpenPresets,
  seqPlaying,
  menuOpen,
  onMenuToggle,
  menuChildren,
  seqContent,
}: Props) {
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
      <div className="panel-scroll">
        {activeTab === 'panel' ? (
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
                <LfoFrame compact showText={showHelp} lfoRate={sound.lfoRate} onLfoRate={sound.onLfoRate} lfoDepth={sound.lfoDepth} onLfoDepth={sound.onLfoDepth} lfoDest={sound.lfoDest} onLfoDest={sound.onLfoDest} fine={sound.fine} snap={sound.snap} />
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
              <Slot {...slotProps('glide')}>
                <GlideFrame compact showText={showHelp} glide={sound.glide} onGlide={sound.onGlide} fine={sound.fine} snap={sound.snap} />
              </Slot>
              <Slot {...slotProps('delay')}>
                <DelayFrame compact showText={showHelp} delayTime={sound.delayTime} onDelayTime={sound.onDelayTime} delayMix={sound.delayMix} onDelayMix={sound.onDelayMix} fine={sound.fine} snap={sound.snap} />
              </Slot>
              <Slot {...slotProps('fenv')}>
                <FilterEnvFrame compact showText={showHelp} fenvAmt={sound.fenvAmt} onFenvAmt={sound.onFenvAmt} fenvDecay={sound.fenvDecay} onFenvDecay={sound.onFenvDecay} fine={sound.fine} snap={sound.snap} />
              </Slot>
              <Slot {...slotProps('reverb')}>
                <ReverbFrame compact showText={showHelp} reverb={sound.reverb} onReverb={sound.onReverb} fine={sound.fine} snap={sound.snap} />
              </Slot>
            </div>
          </div>
        ) : (
          seqContent
        )}
      </div>

      {showTabRow && (
        <div className="tab-row">
          {/* PANEL / SEQ：左端の 2 ボタン（合計 4 列分の幅）。押されている方が "へこむ" 。 */}
          <div className="tab-toggle">
            <button
              className={'tab-btn' + (activeTab === 'panel' ? ' sel' : '')}
              onClick={() => onTab('panel')}
              aria-pressed={activeTab === 'panel'}
            >
              PANEL
            </button>
            <button
              className={'tab-btn' + (activeTab === 'seq' ? ' sel' : '')}
              onClick={() => onTab('seq')}
              aria-pressed={activeTab === 'seq'}
            >
              SEQ
              {seqPlaying && <span className="tab-dot" aria-hidden />}
            </button>
          </div>
          {/* PRESET：ホログラム風モーダルを開く。 */}
          <button className="tab-preset" onClick={onOpenPresets}>
            PRESET
          </button>
          {/* ハンバーガーメニュー：解説表示・チュートリアル等。 */}
          <div className="menu-wrap tab-menu-wrap">
            <button className="tab-menu-btn" onClick={onMenuToggle} aria-label="メニュー">
              <span />
              <span />
              <span />
            </button>
            {menuOpen && <div className="menu menu--up">{menuChildren}</div>}
          </div>
        </div>
      )}

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
