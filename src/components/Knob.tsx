import { useId, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from 'react'

export type KnobFormat = { main: string; sub?: string }

interface Props {
  min: number
  max: number
  defaultValue: number
  size?: number
  label?: string
  /** 微調整モード。Shift キー（PC）の代わりにスマホではボタンで ON にする。 */
  fine?: boolean
  /** ダイヤル内の値表示を出すか（盤面では「解説表示」トグルで制御）。 */
  showText?: boolean
  /** ツマミ下のドラッグ操作ヒントを出すか（盤面では枠が広がるので出さない）。 */
  showHint?: boolean
  format?: (v: number) => KnobFormat
  onChange?: (v: number) => void
}

const A0 = -135
const A1 = 135
// 微調整時はゆっくり動く。PC は Shift、スマホは「微調整」ボタンで ON。
const FINE = 0.25

function polar(cx: number, cy: number, r: number, angleDeg: number): [number, number] {
  const a = (angleDeg * Math.PI) / 180
  return [cx + r * Math.sin(a), cy - r * Math.cos(a)]
}

function arcPath(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const [x0, y0] = polar(cx, cy, r, a0)
  const [x1, y1] = polar(cx, cy, r, a1)
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0
  return `M${x0} ${y0} A${r} ${r} 0 ${large} 1 ${x1} ${y1}`
}

/** 盤面に置ける汎用ロータリーノブ。上下ドラッグで増減・fine(Shift/ボタン)で微調整・ダブルクリックで初期値。 */
export function Knob({ min, max, defaultValue, size = 130, label, fine = false, showText = true, showHint = true, format, onChange }: Props) {
  const [value, setValue] = useState(defaultValue)
  const valueRef = useRef(defaultValue)
  const gid = 'kcap' + useId().replace(/:/g, '')
  const drag = useRef<{ lastY: number } | null>(null)
  const lastTap = useRef(0)

  const r = size / 2
  // 半径に対する比率で各寸法を決める（小さいサイズでも崩れないように）。
  const trackR = r * 0.846
  const capR = r * 0.6
  const arcW = r * 0.092
  const norm = (value - min) / (max - min)
  const ang = A0 + norm * (A1 - A0)

  const set = (v: number) => {
    const c = Math.max(min, Math.min(max, v))
    valueRef.current = c
    setValue(c)
    onChange?.(c)
  }

  const onDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    e.preventDefault()
    // ダブルクリック/ダブルタップで初期値に戻す。dblclick は touch では preventDefault の
    // 影響で発火しないことがあるので、自前で2回連続の押下を検知する。
    if (e.timeStamp - lastTap.current < 300) {
      lastTap.current = 0
      drag.current = null
      set(defaultValue)
      return
    }
    lastTap.current = e.timeStamp
    drag.current = { lastY: e.clientY }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  // 直前位置からの増分で動かす。こうすると Shift の切り替えで値が飛ばない。
  const onMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!drag.current) return
    const dy = drag.current.lastY - e.clientY
    drag.current.lastY = e.clientY
    const sens = ((max - min) / size) * (e.shiftKey || fine ? FINE : 1)
    set(valueRef.current + dy * sens)
  }
  const onUp = () => {
    drag.current = null
  }
  const onWheel = (e: ReactWheelEvent<SVGSVGElement>) => {
    const step = Math.max(0.1, (max - min) / 33) * (e.shiftKey || fine ? FINE : 1)
    set(valueRef.current - Math.sign(e.deltaY) * step)
  }

  const ticks = []
  for (let i = 0; i <= 10; i++) {
    const ta = A0 + (i / 10) * (A1 - A0)
    const [ax, ay] = polar(r, r, trackR + r * 0.03, ta)
    const [bx, by] = polar(r, r, trackR + (i % 5 === 0 ? r * 0.092 : r * 0.062), ta)
    ticks.push(
      <line
        key={i}
        x1={ax}
        y1={ay}
        x2={bx}
        y2={by}
        stroke={i % 5 === 0 ? '#5b6776' : '#39424f'}
        strokeWidth={i % 5 === 0 ? 2 : 1}
      />,
    )
  }

  const [i0x, i0y] = polar(r, r, capR - r * 0.31, ang)
  const [i1x, i1y] = polar(r, r, capR - r * 0.06, ang)
  const f = format ? format(value) : { main: String(Math.round(value)) }
  const mainFont = Math.round(size * 0.14)
  const subFont = Math.round(size * 0.085)

  return (
    <div className="knob-wrap">
      {label && <div className="knob-label">{label}</div>}
      <svg
        className="knob-svg"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ touchAction: 'none' }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onWheel={onWheel}
      >
        <defs>
          <radialGradient id={gid} cx="38%" cy="32%" r="75%">
            <stop offset="0%" stopColor="#39414d" />
            <stop offset="55%" stopColor="#222a34" />
            <stop offset="100%" stopColor="#141a22" />
          </radialGradient>
        </defs>
        <g>{ticks}</g>
        <path d={arcPath(r, r, trackR, A0, A1)} fill="none" stroke="#222a34" strokeWidth={arcW} strokeLinecap="round" />
        <path d={arcPath(r, r, trackR, A0, ang)} fill="none" stroke="#5ad1c4" strokeWidth={arcW} strokeLinecap="round" />
        <circle cx={r} cy={r} r={capR} fill={`url(#${gid})`} stroke="#0c1116" strokeWidth={2} />
        <line x1={i0x} y1={i0y} x2={i1x} y2={i1y} stroke="#5ad1c4" strokeWidth={r * 0.054} strokeLinecap="round" />
        {showText && (
          <>
            <text x={r} y={r + 1} textAnchor="middle" fill="#e6edf3" fontSize={mainFont} fontWeight={700} fontFamily="ui-monospace,Menlo,monospace">
              {f.main}
            </text>
            <text x={r} y={r + mainFont} textAnchor="middle" fill="#9aa7b5" fontSize={subFont}>
              {f.sub ?? ''}
            </text>
          </>
        )}
      </svg>
      {showHint && (
        <div className="knob-hint">
          <span className="hint-mouse">上下にドラッグ ・ ダブルクリックで初期値</span>
          <span className="hint-touch">上下にドラッグ ・ ダブルタップで初期値</span>
        </div>
      )}
    </div>
  )
}
