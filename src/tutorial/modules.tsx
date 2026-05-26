import { Knob } from '../components/Knob'
import { Keyboard } from '../components/Keyboard'
import { Scope } from '../components/Scope'
import { WaveformPicker } from '../components/WaveformPicker'
import { Slider } from '../components/Slider'
import { EnvGraph } from '../components/EnvGraph'
import type { EnvParams, LfoDest } from '../audio/useSynth'
import { fmtTime, fmtPct, cutoffNormToHz, fmtHz, lfoRateToHz, volAmtToGain, panAmtToPos, fmtPan, detuneAmtToCents, fmtMix, delayTimeAmtToSec, fmtDelayMs } from '../audio/params'

export type EnvKey = keyof EnvParams

export interface SoundCtl {
  type: OscillatorType
  onType: (t: OscillatorType) => void
  playing: boolean
  onTune: (v: number) => void
  fine: boolean
  onToggleFine: () => void
  snap: boolean
  onToggleSnap: () => void
  env: EnvParams
  onEnvChange: (key: EnvKey, value: number) => void
  // FILTER / LFO は controlled（プリセットで動かすため、つまみ量を App が保持）。
  cutoff: number
  onCutoff: (amt: number) => void
  res: number
  onRes: (amt: number) => void
  lfoRate: number
  onLfoRate: (amt: number) => void
  lfoDepth: number
  onLfoDepth: (amt: number) => void
  lfoDest: LfoDest
  onLfoDest: (d: LfoDest) => void
  detune: number
  onDetune: (amt: number) => void
  mix: number
  onMix: (amt: number) => void
  noise: number
  onNoise: (amt: number) => void
  delayTime: number
  onDelayTime: (amt: number) => void
  delayMix: number
  onDelayMix: (amt: number) => void
  onVol: (v: number) => void
  onPan: (p: number) => void
  onNoteOn: (midi: number) => void
  onNoteOff: () => void
}

/** 波形フレーム：波形セレクタ。盤面はセレクタのみ、レッスン（大表示）では計器も見せる。
 *  morphing=true のときは、計器(スコープ)を畳みながらコンパクト形へ変形する途中表現。 */
export function WaveFrame({
  type,
  onType,
  playing,
  compact = false,
  morphing = false,
}: Pick<SoundCtl, 'type' | 'onType' | 'playing'> & { compact?: boolean; morphing?: boolean }) {
  const showScope = !compact || morphing
  return (
    <div className={'mod mod-wave' + (compact ? ' mod--compact' : '')}>
      {showScope && (
        <div className={'scope-collapse' + (morphing ? ' collapsing' : '')}>
          <Scope type={type} playing={playing} />
        </div>
      )}
      <WaveformPicker value={type} onChange={onType} compact={compact} morphing={morphing} />
    </div>
  )
}

/** PITCHフレーム：ツマミだけ。 */
export function PitchFrame({
  onTune,
  fine,
  snap,
  compact = false,
  showText = true,
  morphing = false,
}: Pick<SoundCtl, 'onTune' | 'fine' | 'snap'> & { compact?: boolean; showText?: boolean; morphing?: boolean }) {
  return (
    <div className="mod mod-pitch">
      <Knob
        fine={fine}
        snap={snap}
        snapStep={1}
        tickCount={6}
        morphing={morphing}
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

/** 微調整フレーム：トグルボタン1つ。 */
export function FineFrame({ fine, onToggleFine }: Pick<SoundCtl, 'fine' | 'onToggleFine'>) {
  return (
    <div className="mod mod-fine">
      <button className={'fine-btn' + (fine ? ' on' : '')} onClick={onToggleFine} aria-pressed={fine}>
        微調整
      </button>
    </div>
  )
}

/** スナップフレーム：トグルボタン1つ。 */
export function SnapFrame({ snap, onToggleSnap }: Pick<SoundCtl, 'snap' | 'onToggleSnap'>) {
  return (
    <div className="mod mod-snap">
      <button className={'fine-btn' + (snap ? ' on' : '')} onClick={onToggleSnap} aria-pressed={snap}>
        SNAP
      </button>
    </div>
  )
}

/** エンベロープ（A/D/S/R）フレーム：形のグラフ＋4スライダー。数値は出さない（桁可変でレイアウトが崩れるため）。
 *  グラフ表示の ON/OFF は今は固定（将来パネル編集でユーザーが選べるようにする）。 */
export function EnvModule({
  env,
  onEnvChange,
  fine,
  snap,
  compact = false,
}: Pick<SoundCtl, 'env' | 'onEnvChange' | 'fine' | 'snap'> & { compact?: boolean }) {
  return (
    <div className={'mod mod-env' + (compact ? ' mod--compact' : '')}>
      <EnvGraph attack={env.attack} decay={env.decay} sustain={env.sustain} release={env.release} />
      <div className="env-row">
        <div className="env-sliders">
          <Slider label="A" min={0.001} max={2} value={env.attack} fine={fine} snap={snap} snapStep={0.1} showValue={false} format={fmtTime} onChange={(v) => onEnvChange('attack', v)} />
          <Slider label="D" min={0.001} max={2} value={env.decay} fine={fine} snap={snap} snapStep={0.1} showValue={false} format={fmtTime} onChange={(v) => onEnvChange('decay', v)} />
          <Slider label="S" min={0} max={1} value={env.sustain} fine={fine} snap={snap} snapStep={0.1} showValue={false} format={fmtPct} onChange={(v) => onEnvChange('sustain', v)} />
          <Slider label="R" min={0.001} max={3} value={env.release} fine={fine} snap={snap} snapStep={0.1} showValue={false} format={fmtTime} onChange={(v) => onEnvChange('release', v)} />
        </div>
      </div>
    </div>
  )
}

/** フィルターフレーム：CUTOFF と RES の2ツマミ（ローパス）。 */
export function FilterFrame({
  cutoff,
  onCutoff,
  res,
  onRes,
  fine,
  snap,
  compact = false,
  showText = true,
  morphing = false,
}: Pick<SoundCtl, 'cutoff' | 'onCutoff' | 'res' | 'onRes' | 'fine' | 'snap'> & { compact?: boolean; showText?: boolean; morphing?: boolean }) {
  return (
    <div className="mod mod-filter">
      <div className="filter-knobs">
        <Knob
          value={cutoff}
          fine={fine}
          snap={snap}
          snapStep={0.1}
          morphing={morphing}
          showText={showText}
          showHint={!compact}
          min={0}
          max={1}
          defaultValue={1}
          label="CUTOFF"
          format={(v) => ({ main: fmtHz(cutoffNormToHz(v)) })}
          onChange={onCutoff}
        />
        <Knob
          value={res}
          fine={fine}
          snap={snap}
          snapStep={1}
          morphing={morphing}
          showText={showText}
          showHint={!compact}
          min={0}
          max={10}
          defaultValue={0}
          label="RES"
          format={(v) => ({ main: String(Math.round(v)) })}
          onChange={onRes}
        />
      </div>
    </div>
  )
}

/** LFOフレーム：RATE と DEPTH の2ツマミ（音の高さを揺らす＝ビブラート）。 */
export function LfoFrame({
  lfoRate,
  onLfoRate,
  lfoDepth,
  onLfoDepth,
  lfoDest,
  onLfoDest,
  fine,
  snap,
  compact = false,
  showText = true,
  morphing = false,
}: Pick<SoundCtl, 'lfoRate' | 'onLfoRate' | 'lfoDepth' | 'onLfoDepth' | 'lfoDest' | 'onLfoDest' | 'fine' | 'snap'> & { compact?: boolean; showText?: boolean; morphing?: boolean }) {
  return (
    <div className="mod mod-lfo">
      <div className="lfo-dest">
        {(['pitch', 'cutoff', 'amp'] as const).map((d) => (
          <button key={d} className={'lfo-dest-btn' + (lfoDest === d ? ' sel' : '')} onClick={() => onLfoDest(d)} aria-pressed={lfoDest === d}>
            {d === 'pitch' ? 'PITCH' : d === 'cutoff' ? 'CUTOFF' : 'AMP'}
          </button>
        ))}
      </div>
      <div className="lfo-knobs">
        <Knob
          value={lfoRate}
          fine={fine}
          snap={snap}
          snapStep={1}
          morphing={morphing}
          showText={showText}
          showHint={!compact}
          min={0}
          max={10}
          defaultValue={3}
          label="RATE"
          format={(v) => ({ main: fmtHz(lfoRateToHz(v)) })}
          onChange={onLfoRate}
        />
        <Knob
          value={lfoDepth}
          fine={fine}
          snap={snap}
          snapStep={1}
          morphing={morphing}
          showText={showText}
          showHint={!compact}
          min={0}
          max={10}
          defaultValue={0}
          label="DEPTH"
          format={(v) => ({ main: String(Math.round(v)) })}
          onChange={onLfoDepth}
        />
      </div>
    </div>
  )
}

/** MIXフレーム：VOL（マスター音量）と PAN（左右の定位）の2ツマミ。 */
export function MixFrame({
  onVol,
  onPan,
  fine,
  snap,
  compact = false,
  showText = true,
  morphing = false,
}: Pick<SoundCtl, 'onVol' | 'onPan' | 'fine' | 'snap'> & { compact?: boolean; showText?: boolean; morphing?: boolean }) {
  return (
    <div className="mod mod-mix">
      <div className="mix-knobs">
        <Knob
          fine={fine}
          snap={snap}
          snapStep={1}
          morphing={morphing}
          showText={showText}
          showHint={!compact}
          min={0}
          max={10}
          defaultValue={10}
          label="VOL"
          format={(v) => ({ main: String(Math.round(v)) })}
          onChange={(v) => onVol(volAmtToGain(v))}
        />
        <Knob
          fine={fine}
          snap={snap}
          snapStep={1}
          morphing={morphing}
          showText={showText}
          showHint={!compact}
          min={-5}
          max={5}
          defaultValue={0}
          label="PAN"
          format={(v) => ({ main: fmtPan(v) })}
          onChange={(v) => onPan(panAmtToPos(v))}
        />
      </div>
    </div>
  )
}

/** OSC2フレーム：MIX（OSC1↔OSC2バランス）と DETUNE（OSC2のずらし量）の2ツマミ。 */
export function Osc2Frame({
  mix,
  onMix,
  detune,
  onDetune,
  fine,
  snap,
  compact = false,
  showText = true,
  morphing = false,
}: Pick<SoundCtl, 'mix' | 'onMix' | 'detune' | 'onDetune' | 'fine' | 'snap'> & { compact?: boolean; showText?: boolean; morphing?: boolean }) {
  return (
    <div className="mod mod-osc2">
      <div className="osc2-knobs">
        <Knob
          value={mix}
          fine={fine}
          snap={snap}
          snapStep={1}
          morphing={morphing}
          showText={showText}
          showHint={!compact}
          min={0}
          max={10}
          defaultValue={5}
          label="MIX"
          format={(v) => ({ main: fmtMix(v) })}
          onChange={onMix}
        />
        <Knob
          value={detune}
          fine={fine}
          snap={snap}
          snapStep={1}
          morphing={morphing}
          showText={showText}
          showHint={!compact}
          min={0}
          max={10}
          defaultValue={0}
          label="DETUNE"
          format={(v) => ({ main: `${Math.round(detuneAmtToCents(v))}` })}
          onChange={onDetune}
        />
      </div>
    </div>
  )
}

/** NOISEフレーム：ホワイトノイズの音量1ツマミ（2×2）。 */
export function NoiseFrame({
  noise,
  onNoise,
  fine,
  snap,
  compact = false,
  showText = true,
  morphing = false,
}: Pick<SoundCtl, 'noise' | 'onNoise' | 'fine' | 'snap'> & { compact?: boolean; showText?: boolean; morphing?: boolean }) {
  return (
    <div className="mod mod-noise">
      <Knob
        value={noise}
        fine={fine}
        snap={snap}
        snapStep={1}
        morphing={morphing}
        showText={showText}
        showHint={!compact}
        min={0}
        max={10}
        defaultValue={0}
        label="LEVEL"
        format={(v) => ({ main: String(Math.round(v)) })}
        onChange={onNoise}
      />
    </div>
  )
}

/** DELAYフレーム：TIME（遅れる時間）と MIX（山びこの大きさ）の2ツマミ。 */
export function DelayFrame({
  delayTime,
  onDelayTime,
  delayMix,
  onDelayMix,
  fine,
  snap,
  compact = false,
  showText = true,
  morphing = false,
}: Pick<SoundCtl, 'delayTime' | 'onDelayTime' | 'delayMix' | 'onDelayMix' | 'fine' | 'snap'> & { compact?: boolean; showText?: boolean; morphing?: boolean }) {
  return (
    <div className="mod mod-delay">
      <div className="delay-knobs">
        <Knob
          value={delayTime}
          fine={fine}
          snap={snap}
          snapStep={1}
          morphing={morphing}
          showText={showText}
          showHint={!compact}
          min={0}
          max={10}
          defaultValue={3}
          label="TIME"
          format={(v) => ({ main: fmtDelayMs(delayTimeAmtToSec(v)) })}
          onChange={onDelayTime}
        />
        <Knob
          value={delayMix}
          fine={fine}
          snap={snap}
          snapStep={1}
          morphing={morphing}
          showText={showText}
          showHint={!compact}
          min={0}
          max={10}
          defaultValue={0}
          label="MIX"
          format={(v) => ({ main: String(Math.round(v)) })}
          onChange={onDelayMix}
        />
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
