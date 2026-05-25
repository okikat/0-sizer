interface Props {
  value: OscillatorType
  onChange: (t: OscillatorType) => void
  /** 盤面に収まる時はアイコンのみの縮小表示にする。 */
  compact?: boolean
  /** OK後の「パネル装着形へのモーフ」中。文字ラベルを畳んで消す（→アイコンのみへ）。 */
  morphing?: boolean
}

const ITEMS: { t: OscillatorType; sym: string; label: string }[] = [
  { t: 'sine', sym: '∿', label: 'サイン波' },
  { t: 'triangle', sym: '△', label: '三角波' },
  { t: 'sawtooth', sym: '◺', label: 'ノコギリ波' },
  { t: 'square', sym: '⊓', label: '矩形波' },
]

/** 4波形のセレクタ。選ぶと音色（音のキャラ）が変わる。compact ではアイコンのみ。 */
export function WaveformPicker({ value, onChange, compact = false, morphing = false }: Props) {
  return (
    <div className={'waves' + (compact ? ' waves--compact' : '')}>
      {ITEMS.map((it) => (
        <div
          key={it.t}
          className={'wave' + (value === it.t ? ' sel' : '')}
          onClick={() => onChange(it.t)}
          aria-label={it.label}
        >
          <span className="sym">{it.sym}</span>
          {!compact && <span className={'wlabel' + (morphing ? ' collapsing' : '')}>{it.label}</span>}
        </div>
      ))}
    </div>
  )
}
