import { useState } from 'react'
import { Knob } from '../components/Knob'
import { Keyboard } from '../components/Keyboard'
import { Scope } from '../components/Scope'
import { WaveformPicker } from '../components/WaveformPicker'

export interface SoundCtl {
  osc: {
    type: OscillatorType
    onType: (t: OscillatorType) => void
    playing: boolean
    drone: boolean
    onToggleDrone: () => void
    onTune: (v: number) => void
  }
  keys: {
    onNoteOn: (midi: number) => void
    onNoteOff: () => void
  }
}

/** オシレーター一式：計器＋波形選択＋PITCHツマミ＋微調整／鳴らす。盤面でもチュートリアルでも同じものを使う。 */
export function OscillatorModule({
  type,
  onType,
  playing,
  drone,
  onToggleDrone,
  onTune,
  compact = false,
  showText = true,
}: SoundCtl['osc'] & { compact?: boolean; showText?: boolean }) {
  const [fine, setFine] = useState(false)
  return (
    <div className={'mod mod-osc' + (compact ? ' mod-osc--compact' : '')}>
      <Scope type={type} playing={playing} />
      <WaveformPicker value={type} onChange={onType} compact={compact} />
      <div className="osc-bottom">
        <button className={'fine-btn' + (fine ? ' on' : '')} onClick={() => setFine((v) => !v)} aria-pressed={fine}>
          微調整
        </button>
        <Knob
          size={compact ? 70 : 108}
          fine={fine}
          showText={showText}
          min={-12}
          max={12}
          defaultValue={0}
          label="PITCH"
          format={(v) => ({ main: `${v >= 0 ? '+' : ''}${v.toFixed(1)} 半音`, sub: '全体の高さ' })}
          onChange={onTune}
        />
        <button className={'play-btn' + (drone ? ' on' : '')} onClick={onToggleDrone}>
          {drone ? '■ 止める' : '▶ 鳴らす'}
        </button>
      </div>
    </div>
  )
}

/** 鍵盤モジュール。 */
export function KeyboardModule({ onNoteOn, onNoteOff }: SoundCtl['keys']) {
  return (
    <div className="mod mod-keys">
      <Keyboard onNoteOn={onNoteOn} onNoteOff={onNoteOff} />
    </div>
  )
}
