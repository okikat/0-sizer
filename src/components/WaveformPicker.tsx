interface Props {
  value: OscillatorType
  onChange: (t: OscillatorType) => void
}

const ITEMS: { t: OscillatorType; sym: string; label: string }[] = [
  { t: 'sine', sym: '∿', label: 'サイン波' },
  { t: 'triangle', sym: '△', label: '三角波' },
  { t: 'sawtooth', sym: '◺', label: 'ノコギリ波' },
  { t: 'square', sym: '⊓', label: '矩形波' },
]

/** 4波形のセレクタ。選ぶと音色（音のキャラ）が変わる。 */
export function WaveformPicker({ value, onChange }: Props) {
  return (
    <div className="waves">
      {ITEMS.map((it) => (
        <div
          key={it.t}
          className={'wave' + (value === it.t ? ' sel' : '')}
          onClick={() => onChange(it.t)}
        >
          <span className="sym">{it.sym}</span>
          {it.label}
        </div>
      ))}
    </div>
  )
}
