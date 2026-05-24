interface Props {
  attack: number
  decay: number
  sustain: number
  release: number
}

const W = 200
const H = 70
const PAD = 5
const HOLD = 0.5 // 表示用の「押し続け」区間の長さ（秒）

/** A/D/S/R の形を描く図。スライダーに連動して形が変わる。 */
export function EnvGraph({ attack, decay, sustain, release }: Props) {
  const total = attack + decay + HOLD + release || 1
  const x = (t: number) => PAD + (t / total) * (W - 2 * PAD)
  const y = (v: number) => H - PAD - v * (H - 2 * PAD)

  const tA = attack
  const tD = attack + decay
  const tS = attack + decay + HOLD
  const tEnd = total

  const pts = [
    `${x(0)},${y(0)}`,
    `${x(tA)},${y(1)}`,
    `${x(tD)},${y(sustain)}`,
    `${x(tS)},${y(sustain)}`,
    `${x(tEnd)},${y(0)}`,
  ].join(' ')

  return (
    <svg className="env-graph" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <line x1={0} y1={H - PAD} x2={W} y2={H - PAD} stroke="#1d2530" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      {/* 鍵盤を離す位置（リリース開始） */}
      <line
        x1={x(tS)}
        y1={PAD}
        x2={x(tS)}
        y2={H - PAD}
        stroke="#3a444f"
        strokeWidth="1"
        strokeDasharray="2 3"
        vectorEffect="non-scaling-stroke"
      />
      <polyline points={pts} fill="none" stroke="#5ad1c4" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}
