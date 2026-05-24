import { useState } from 'react'
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
  onCutoff: (hz: number) => void
  onRes: (q: number) => void
  onNoteOn: (midi: number) => void
  onNoteOff: () => void
}

const fmtTime = (v: number) => (v < 1 ? `${Math.round(v * 1000)} ms` : `${v.toFixed(2)} s`)
const fmtPct = (v: number) => `${Math.round(v * 100)} %`

// カットオフは「つまみ 0〜1」を低音域寄りの対数カーブで 80Hz〜16kHz に対応させる。
// 人は周波数を対数で感じるので、つまみの動きと聴感が合うようにする。
const F_MIN = 80
const F_MAX = 16000
const cutoffNormToHz = (n: number) => F_MIN * Math.pow(F_MAX / F_MIN, n)
const fmtHz = (hz: number) => (hz >= 1000 ? `${(hz / 1000).toFixed(1)}k` : `${Math.round(hz)}`)
// RES は「つまみ 0〜10」を Q 0.7（クセ無し）〜16（強め）に対応させる。
const resAmtToQ = (amt: number) => 0.7 + (amt / 10) * (16 - 0.7)

/** 波形フレーム：計器＋波形選択。 */
export function WaveFrame({
  type,
  onType,
  playing,
  compact = false,
}: Pick<SoundCtl, 'type' | 'onType' | 'playing'> & { compact?: boolean }) {
  const [showScope, setShowScope] = useState(true)
  return (
    <div className={'mod mod-wave' + (compact ? ' mod--compact' : '')}>
      {showScope && <Scope type={type} playing={playing} />}
      <div className="wave-row">
        <WaveformPicker value={type} onChange={onType} compact={compact} />
        <button className="frame-toggle" onClick={() => setShowScope((s) => !s)} aria-label="波形図の表示切り替え">
          {showScope ? '▾' : '▸'}
        </button>
      </div>
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
        fine={fine}
        showText={showText}
        showHint={!compact}
        min={-12}
        max={12}
        defaultValue={0}
        label="PITCH"
        format={(v) => ({ main: v > 0 ? `♯${v.toFixed(1)}` : v < 0 ? `♭${Math.abs(v).toFixed(1)}` : '0' })}
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

/** エンベロープ（A/D/S/R）フレーム：形のグラフ＋4スライダー。値は常時表示。 */
export function EnvModule({
  env,
  onEnvChange,
  fine,
  compact = false,
}: Pick<SoundCtl, 'env' | 'onEnvChange' | 'fine'> & { compact?: boolean }) {
  const [showGraph, setShowGraph] = useState(true)
  return (
    <div className={'mod mod-env' + (compact ? ' mod--compact' : '')}>
      {showGraph && <EnvGraph attack={env.attack} decay={env.decay} sustain={env.sustain} release={env.release} />}
      <div className="env-row">
        <div className="env-sliders">
          <Slider label="A" min={0.001} max={2} value={env.attack} fine={fine} format={fmtTime} onChange={(v) => onEnvChange('attack', v)} />
          <Slider label="D" min={0.001} max={2} value={env.decay} fine={fine} format={fmtTime} onChange={(v) => onEnvChange('decay', v)} />
          <Slider label="S" min={0} max={1} value={env.sustain} fine={fine} format={fmtPct} onChange={(v) => onEnvChange('sustain', v)} />
          <Slider label="R" min={0.001} max={3} value={env.release} fine={fine} format={fmtTime} onChange={(v) => onEnvChange('release', v)} />
        </div>
        <button className="frame-toggle" onClick={() => setShowGraph((s) => !s)} aria-label="エンベロープ図の表示切り替え">
          {showGraph ? '▾' : '▸'}
        </button>
      </div>
    </div>
  )
}

/** フィルターフレーム：CUTOFF と RES の2ツマミ（ローパス）。 */
export function FilterFrame({
  onCutoff,
  onRes,
  fine,
  compact = false,
  showText = true,
}: Pick<SoundCtl, 'onCutoff' | 'onRes' | 'fine'> & { compact?: boolean; showText?: boolean }) {
  return (
    <div className="mod mod-filter">
      <Knob
        fine={fine}
        showText={showText}
        showHint={!compact}
        min={0}
        max={1}
        defaultValue={1}
        label="CUTOFF"
        format={(v) => ({ main: fmtHz(cutoffNormToHz(v)) })}
        onChange={(v) => onCutoff(cutoffNormToHz(v))}
      />
      <Knob
        fine={fine}
        showText={showText}
        showHint={!compact}
        min={0}
        max={10}
        defaultValue={0}
        label="RES"
        format={(v) => ({ main: String(Math.round(v)) })}
        onChange={(v) => onRes(resAmtToQ(v))}
      />
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
