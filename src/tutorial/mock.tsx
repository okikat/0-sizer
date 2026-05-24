// 盤面の「それっぽさ」を出すための飾り（モック）。まだ機能はしない見た目だけの枠。
// チュートリアルで習うモジュール（オシレーター・鍵盤）の周りに置き、複雑な機材感を出す。

type Widget =
  | { kind: 'knob'; label: string; angle: number }
  | { kind: 'slider'; label: string; level: number }
  | { kind: 'ind'; label: string }

interface Section {
  title: string
  widgets: Widget[]
}

const SECTIONS: Section[] = [
  {
    title: 'LFO',
    widgets: [
      { kind: 'knob', label: 'RATE', angle: 15 },
      { kind: 'ind', label: 'SHAPE' },
    ],
  },
  {
    title: 'MIX',
    widgets: [
      { kind: 'knob', label: 'VOL', angle: 75 },
      { kind: 'knob', label: 'PAN', angle: 0 },
      { kind: 'ind', label: 'LEVEL' },
    ],
  },
]

/** 飾りモジュール群。盤面ボードのグリッドに直接並ぶセル。 */
export function MockSections() {
  return (
    <>
      {SECTIONS.map((s) => (
        <div className={'mock-sec mock-sec--' + s.title.toLowerCase()} key={s.title}>
          <div className="mock-sec-title">{s.title}</div>
          <div className="mock-widgets">
            {s.widgets.map((w, i) => (
              <MockWidget key={i} w={w} />
            ))}
          </div>
        </div>
      ))}
    </>
  )
}

function MockWidget({ w }: { w: Widget }) {
  if (w.kind === 'knob') {
    return (
      <div className="mw">
        <div className="mw-knob" style={{ transform: `rotate(${w.angle}deg)` }}>
          <span className="mw-knob-ind" />
        </div>
        <span className="mw-label">{w.label}</span>
      </div>
    )
  }
  if (w.kind === 'slider') {
    const pct = `${Math.round(w.level * 100)}%`
    return (
      <div className="mw">
        <div className="mw-slider">
          <span className="mw-slider-fill" style={{ height: pct }} />
          <span className="mw-slider-knob" style={{ bottom: `calc(${pct} - 5px)` }} />
        </div>
        <span className="mw-label">{w.label}</span>
      </div>
    )
  }
  return (
    <div className="mw mw-wide">
      <div className="mw-ind">
        <svg viewBox="0 0 80 24" preserveAspectRatio="none">
          <path d="M0 12 Q 10 2 20 12 T 40 12 T 60 12 T 80 12" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </div>
      <span className="mw-label">{w.label}</span>
    </div>
  )
}
