import { useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'

// Erica Synths（Black系）っぽい見た目の検証用サンプル。?sample で開く。
// 本体スタイルとは独立（.sample 配下にスコープ）。方向が固まったら本体へ展開する。

const VB = 100
const A0 = -135
const A1 = 135
const SENS_SPAN = 150

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

interface KnobProps {
  min: number
  max: number
  defaultValue: number
  label: string
  format: (v: number) => string
}

function SampleKnob({ min, max, defaultValue, label, format }: KnobProps) {
  const [value, setValue] = useState(defaultValue)
  const valueRef = useRef(defaultValue)
  const drag = useRef<{ lastY: number } | null>(null)
  const lastTap = useRef(0)

  const r = VB / 2
  const tickR = r * 0.92
  const arcR = r * 0.74
  const capR = r * 0.56
  const norm = (value - min) / (max - min)
  const ang = A0 + norm * (A1 - A0)

  const set = (v: number) => {
    const c = Math.max(min, Math.min(max, v))
    valueRef.current = c
    setValue(c)
  }
  const onDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    e.preventDefault()
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
  const onMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!drag.current) return
    const dy = drag.current.lastY - e.clientY
    drag.current.lastY = e.clientY
    const sens = ((max - min) / SENS_SPAN) * (e.shiftKey ? 0.25 : 1)
    set(valueRef.current + dy * sens)
  }
  const onUp = () => {
    drag.current = null
  }

  // 印刷風の目盛り（白シルクスクリーン）。両端と中央を長めに。
  const ticks = []
  for (let i = 0; i <= 10; i++) {
    const ta = A0 + (i / 10) * (A1 - A0)
    const major = i % 5 === 0
    const [ax, ay] = polar(r, r, tickR, ta)
    const [bx, by] = polar(r, r, tickR - (major ? r * 0.12 : r * 0.07), ta)
    ticks.push(
      <line
        key={i}
        x1={ax}
        y1={ay}
        x2={bx}
        y2={by}
        stroke={major ? '#eef3f7' : '#7f8893'}
        strokeWidth={major ? 1.6 : 1}
        strokeLinecap="round"
      />,
    )
  }

  const [px, py] = polar(r, r, capR - r * 0.06, ang)

  return (
    <div className="sk">
      <svg
        className="sk-svg"
        viewBox={`0 0 ${VB} ${VB}`}
        style={{ touchAction: 'none' }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <g>{ticks}</g>
        {/* 値の弧：暗いトラック＋ティールの現在値 */}
        <path d={arcPath(r, r, arcR, A0, A1)} fill="none" stroke="#23262b" strokeWidth={r * 0.07} strokeLinecap="round" />
        <path d={arcPath(r, r, arcR, A0, ang)} fill="none" stroke="#5ad1c4" strokeWidth={r * 0.07} strokeLinecap="round" />
        {/* 黒いツマミ本体（マット）＋細い縁 */}
        <circle cx={r} cy={r} r={capR} fill="#0c0c0d" stroke="#34383e" strokeWidth={1.4} />
        {/* 白い指針 */}
        <line x1={r} y1={r} x2={px} y2={py} stroke="#f4f7fa" strokeWidth={r * 0.05} strokeLinecap="round" />
      </svg>
      <div className="sk-label">{label}</div>
      <div className="sk-val">{format(value)}</div>
    </div>
  )
}

const F_MIN = 80
const F_MAX = 16000
const cutoffNormToHz = (n: number) => F_MIN * Math.pow(F_MAX / F_MIN, n)
const fmtHz = (hz: number) => (hz >= 1000 ? `${(hz / 1000).toFixed(1)}k` : `${Math.round(hz)}`)

export function StyleSample() {
  return (
    <div className="sample">
      <div className="sample-note">見本 / Erica Synths っぽさ検証</div>
      <div className="sample-panel">
        <div className="sample-module">
          <div className="sample-module-title">FILTER</div>
          <div className="sample-knobs">
            <SampleKnob min={0} max={1} defaultValue={1} label="CUTOFF" format={(v) => fmtHz(cutoffNormToHz(v))} />
            <SampleKnob min={0} max={10} defaultValue={0} label="RES" format={(v) => String(Math.round(v))} />
          </div>
        </div>
      </div>
      <div className="sample-hint">上下ドラッグで操作 ・ ダブルタップで初期値</div>
    </div>
  )
}
