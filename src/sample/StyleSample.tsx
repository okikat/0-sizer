import { useId, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'

// Erica Synths（Black系）っぽい見た目の検証用サンプル。?sample で開く。
// 立体感・本物っぽさ重視：削り出しの黒ツマミ＋黒アルミ板＋ネジ＋沈んだLCD。
// 本体スタイルとは独立（.sample 配下にスコープ）。方向が固まったら本体へ展開する。

const VB = 100
const A0 = -135
const A1 = 135
const SENS_SPAN = 150

function polar(cx: number, cy: number, r: number, angleDeg: number): [number, number] {
  const a = (angleDeg * Math.PI) / 180
  return [cx + r * Math.sin(a), cy - r * Math.cos(a)]
}
function mix(a: [number, number, number], b: [number, number, number], t: number) {
  const c = (i: number) => Math.round(a[i] + (b[i] - a[i]) * t)
  return `rgb(${c(0)},${c(1)},${c(2)})`
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
  const uid = useId().replace(/:/g, '')

  const r = VB / 2
  const tickR = r * 0.94
  const skirtR = r * 0.68
  const capR = r * 0.5
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
    const [bx, by] = polar(r, r, tickR - (major ? r * 0.11 : r * 0.06), ta)
    ticks.push(
      <line key={i} x1={ax} y1={ay} x2={bx} y2={by} stroke={major ? '#e7edf2' : '#79828d'} strokeWidth={major ? 1.5 : 0.9} strokeLinecap="round" />,
    )
  }

  // フルート（削り出しの溝）：溝はツマミと一緒に回り、光源(左上)は固定。
  // → 回すと溝が動くが、明るい部分は常に左上に留まる＝本物の金属の見え方。
  const LIGHT = -52
  const flutes = []
  const N = 44
  const fi = capR + r * 0.03
  const fo = skirtR - r * 0.01
  for (let i = 0; i < N; i++) {
    const t = (i / N) * 360 + ang
    const [ax, ay] = polar(r, r, fi, t)
    const [bx, by] = polar(r, r, fo, t)
    const shade = (Math.cos(((t - LIGHT) * Math.PI) / 180) + 1) / 2
    flutes.push(
      <line key={i} x1={ax} y1={ay} x2={bx} y2={by} stroke={mix([5, 6, 8], [74, 80, 90], Math.pow(shade, 1.4))} strokeWidth={1.1} strokeLinecap="butt" />,
    )
  }

  const [pix, piy] = polar(r, r, capR * 0.16, ang)
  const [pox, poy] = polar(r, r, capR * 0.92, ang)

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
        <defs>
          <radialGradient id={'cap' + uid} cx="38%" cy="28%" r="80%">
            <stop offset="0%" stopColor="#30343b" />
            <stop offset="46%" stopColor="#14171c" />
            <stop offset="100%" stopColor="#050608" />
          </radialGradient>
          <radialGradient id={'skirt' + uid} cx="40%" cy="30%" r="85%">
            <stop offset="0%" stopColor="#22262d" />
            <stop offset="72%" stopColor="#0f1115" />
            <stop offset="100%" stopColor="#040506" />
          </radialGradient>
          <filter id={'ds' + uid} x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="2.4" stdDeviation="2.2" floodColor="#000" floodOpacity="0.7" />
          </filter>
        </defs>

        {/* パネル印刷の目盛り */}
        <g>{ticks}</g>

        {/* ツマミ本体（影付きで浮かせる） */}
        <g filter={`url(#ds${uid})`}>
          {/* スカート（削り出しの土台） */}
          <circle cx={r} cy={r} r={skirtR} fill={`url(#skirt${uid})`} stroke="#000" strokeWidth={0.6} />
          <g>{flutes}</g>
          {/* スカート上面の縁ハイライト */}
          <circle cx={r} cy={r} r={skirtR - 0.6} fill="none" stroke="#3a3f47" strokeWidth={0.5} opacity={0.5} />
          {/* ドーム状のキャップ */}
          <circle cx={r} cy={r} r={capR} fill={`url(#cap${uid})`} stroke="#000" strokeWidth={0.8} />
          {/* 白い指針（彫り込み風：黒の下地＋白線） */}
          <line x1={pix} y1={piy} x2={pox} y2={poy} stroke="#000" strokeWidth={r * 0.085} strokeLinecap="round" />
          <line x1={pix} y1={piy} x2={pox} y2={poy} stroke="#f4f7fa" strokeWidth={r * 0.045} strokeLinecap="round" />
        </g>
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
      <div className="sample-note">見本 / 立体感・所有感の検証</div>
      <div className="sample-panel">
        <span className="screw screw--tl" />
        <span className="screw screw--tr" />
        <span className="screw screw--bl" />
        <span className="screw screw--br" />
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
