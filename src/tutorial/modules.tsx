import { Knob } from '../components/Knob'
import { Keyboard } from '../components/Keyboard'
import { Scope } from '../components/Scope'
import { WaveformPicker } from '../components/WaveformPicker'
import { Slider } from '../components/Slider'
import { EnvGraph } from '../components/EnvGraph'
import type { EnvParams } from '../audio/useSynth'

export type EnvKey = keyof EnvParams

export interface SoundCtl {
  type: OscillatorType
  onType: (t: OscillatorType) => void
  playing: boolean
  onTune: (v: number) => void
  fine: boolean
  onToggleFine: () => void
  env: EnvParams
  onEnvChange: (key: EnvKey, value: number) => void
  onNoteOn: (midi: number) => void
  onNoteOff: () => void
}

const fmtTime = (v: number) => (v < 1 ? `${Math.round(v * 1000)} ms` : `${v.toFixed(2)} s`)
const fmtPct = (v: number) => `${Math.round(v * 100)} %`

/** 波形フレーム：計器＋波形選択。 */
export function WaveFrame({
  type,
  onType,
  playing,
  compact = false,
}: Pick<SoundCtl, 'type' | 'onType' | 'playing'> & { compact?: boolean }) {
  return (
    <div className={'mod mod-wave' + (compact ? ' mod--compact' : '')}>
      <Scope type={type} playing={playing} />
      <WaveformPicker value={type} onChange={onType} compact={compact} />
    </div>
  )
}

/** PITCHフレーム：ツマミだけ。 */
export function PitchFrame({
  onTune,
  fine,
  compact = false,
  showText = true,
}: Pick<SoundCtl, 'onTune' | 'fine'> & { compact?: boolean; showText?: boolean }) {
  return (
    <div className="mod mod-pitch">
      <Knob
        size={compact ? 56 : 108}
        fine={fine}
        showText={showText}
        showHint={!compact}
        min={-12}
        max={12}
        defaultValue={0}
        label="PITCH"
        format={(v) => ({ main: `${v >= 0 ? '+' : ''}${v.toFixed(1)} 半音`, sub: '全体の音の高さ' })}
        onChange={onTune}
      />
    </div>
  )
}

/** 微調整フレーム：トグルボタンだけ。 */
export function FineFrame({ fine, onToggleFine }: Pick<SoundCtl, 'fine' | 'onToggleFine'>) {
  return (
    <div className="mod mod-fine">
      <button className={'fine-btn' + (fine ? ' on' : '')} onClick={onToggleFine} aria-pressed={fine}>
        微調整
      </button>
    </div>
  )
}

/** エンベロープ（A/D/S/R）フレーム：形のグラフ＋4スライダー。 */
export function EnvModule({
  env,
  onEnvChange,
  fine,
  compact = false,
  showText = true,
}: Pick<SoundCtl, 'env' | 'onEnvChange' | 'fine'> & { compact?: boolean; showText?: boolean }) {
  return (
    <div className={'mod mod-env' + (compact ? ' mod--compact' : '')}>
      <EnvGraph attack={env.attack} decay={env.decay} sustain={env.sustain} release={env.release} />
      <div className="env-sliders">
        <Slider label="A" min={0.001} max={2} value={env.attack} fine={fine} showValue={showText} format={fmtTime} onChange={(v) => onEnvChange('attack', v)} />
        <Slider label="D" min={0.001} max={2} value={env.decay} fine={fine} showValue={showText} format={fmtTime} onChange={(v) => onEnvChange('decay', v)} />
        <Slider label="S" min={0} max={1} value={env.sustain} fine={fine} showValue={showText} format={fmtPct} onChange={(v) => onEnvChange('sustain', v)} />
        <Slider label="R" min={0.001} max={3} value={env.release} fine={fine} showValue={showText} format={fmtTime} onChange={(v) => onEnvChange('release', v)} />
      </div>
    </div>
  )
}

/** 鍵盤フレーム。 */
export function KeyboardModule({
  onNoteOn,
  onNoteOff,
  showLabels = true,
}: Pick<SoundCtl, 'onNoteOn' | 'onNoteOff'> & { showLabels?: boolean }) {
  return (
    <div className="mod mod-keys">
      <Keyboard onNoteOn={onNoteOn} onNoteOff={onNoteOff} showLabels={showLabels} />
    </div>
  )
}

/** ゴースト用の静的な鍵盤（イベント無し・ラベル無し）。実体の代わりに薄く出す。 */
export function KeyboardGhost() {
  const whites = 8
  const ww = 100 / whites
  const bw = ww * 0.6
  const blacks = [1, 2, 4, 5, 6]
  return (
    <div className="mod mod-keys">
      <div className="piano">
        {Array.from({ length: whites }).map((_, i) => (
          <div key={i} className="wkey" style={{ left: `${i * ww}%`, width: `${ww}%` }} />
        ))}
        {blacks.map((pos) => (
          <div key={pos} className="bkey" style={{ left: `${pos * ww - bw / 2}%`, width: `${bw}%` }} />
        ))}
      </div>
    </div>
  )
}
