import { useId, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from 'react'

export type KnobFormat = { main: string; sub?: string }

interface Props {
  min: number
  max: number
  defaultValue: number
  label?: string
  /** 微調整モード。Shift キー（PC）の代わりにスマホではボタンで ON にする。 */
  fine?: boolean
  /** スナップ（カクカク）モード。ON で snapStep 刻みに値が量子化される。 */
  snap?: boolean
  /** スナップ時の刻み（値の単位）。未指定ならスナップしない。 */
  snapStep?: number
  /** 目盛りの分割数（既定10）。スナップ刻みや値域に合わせて変える。 */
  tickCount?: number
  /** 値（赤LED表示）を出すか（盤面では「解説表示」トグルで制御）。 */
  showText?: boolean
  /** ツマミ下のドラッグ操作ヒントを出すか（盤面では枠が広がるので出さない）。 */
  showHint?: boolean
  /** OK後の「パネル装着形へのモーフ」中。値LED・ヒントを畳んで消す。 */
  morphing?: boolean
  format?: (v: number) => KnobFormat
  onChange?: (v: number) => void
}

// 描画は固定の viewBox(100)で行い、表示サイズは CSS（セル）に任せる＝伸縮自在。
const VB = 100
const A0 = -135
const A1 = 135
// 微調整時はゆっくり動く。PC は Shift、スマホは「微調整」ボタンで ON。
const FINE = 0.25
// ドラッグ感度の基準（この px 動かすと min→max）。描画サイズに依らず一定。
const SENS_SPAN = 150
// フルート（削り出しの溝）の光源は左上に固定（回しても明部は左上に残る＝金属の見え方）。
const LIGHT = -52

function polar(cx: number, cy: number, r: number, angleDeg: number): [number, number] {
  const a = (angleDeg * Math.PI) / 180
  return [cx + r * Math.sin(a), cy - r * Math.cos(a)]
}
function mix(a: [number, number, number], b: [number, number, number], t: number) {
  const c = (i: number) => Math.round(a[i] + (b[i] - a[i]) * t)
  return `rgb(${c(0)},${c(1)},${c(2)})`
}

/** 黒の削り出し風ロータリーノブ。上下ドラッグで増減・fine(Shift/ボタン)で微調整・ダブルクリックで初期値。
 *  値は下の赤LED窓に表示。表示サイズは親（グリッドのセル等）が決め、本体は枠いっぱいにスケールする。 */
export function Knob({ min, max, defaultValue, label, fine = false, snap = false, snapStep, tickCount = 10, showText = true, showHint = true, morphing = false, format, onChange }: Props) {
  const [value, setValue] = useState(defaultValue)
  const valueRef = useRef(defaultValue)
  const uid = useId().replace(/:/g, '')
  const drag = useRef<{ lastY: number } | null>(null)
  const lastTap = useRef(0)

  const r = VB / 2
  // 半径に対する比率で各寸法を決める（どのサイズでも崩れないように）。
  const tickR = r * 0.82
  const skirtR = r * 0.68
  const capR = r * 0.5
  const norm = (value - min) / (max - min)
  const ang = A0 + norm * (A1 - A0)

  // valueRef は連続値（ドラッグの蓄積）。表示・通知はスナップ時のみ刻みに丸める。
  const set = (v: number) => {
    const c = Math.max(min, Math.min(max, v))
    valueRef.current = c
    const out = snap && snapStep ? Math.max(min, Math.min(max, Math.round(c / snapStep) * snapStep)) : c
    setValue(out)
    onChange?.(out)
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
    const sens = ((max - min) / SENS_SPAN) * (e.shiftKey || fine ? FINE : 1)
    set(valueRef.current + dy * sens)
  }
  const onUp = () => {
    drag.current = null
  }
  const onWheel = (e: ReactWheelEvent<SVGSVGElement>) => {
    const step = Math.max(0.1, (max - min) / 33) * (e.shiftKey || fine ? FINE : 1)
    set(valueRef.current - Math.sign(e.deltaY) * step)
  }

  // パネル印刷の目盛り（白シルクスクリーン）。両端と中央を長めに。tickCount=分割数。
  const ticks = []
  for (let i = 0; i <= tickCount; i++) {
    const ta = A0 + (i / tickCount) * (A1 - A0)
    const major = i === 0 || i === tickCount || i * 2 === tickCount
    const [ax, ay] = polar(r, r, tickR, ta)
    const [bx, by] = polar(r, r, tickR - (major ? r * 0.1 : r * 0.055), ta)
    ticks.push(
      <line key={i} x1={ax} y1={ay} x2={bx} y2={by} stroke={major ? '#e7edf2' : '#79828d'} strokeWidth={major ? 1.5 : 0.9} strokeLinecap="round" />,
    )
  }

  // フルート（削り出しの溝）：溝はツマミと一緒に回り、光源は固定。
  const flutes = []
  const N = 44
  const fi = capR + r * 0.03
  const fo = skirtR - r * 0.01
  for (let i = 0; i < N; i++) {
    const t = (i / N) * 360 + ang
    const [ax, ay] = polar(r, r, fi, t)
    const [bx, by] = polar(r, r, fo, t)
    const shade = (Math.cos(((t - LIGHT) * Math.PI) / 180) + 1) / 2
    flutes.push(<line key={i} x1={ax} y1={ay} x2={bx} y2={by} stroke={mix([5, 6, 8], [74, 80, 90], Math.pow(shade, 1.4))} strokeWidth={1.1} strokeLinecap="butt" />)
  }

  const [pix, piy] = polar(r, r, capR * 0.16, ang)
  const [pox, poy] = polar(r, r, capR * 0.92, ang)
  const f = format ? format(value) : { main: String(Math.round(value)) }

  return (
    <div className="knob-wrap">
      <div className="knob-dial">
        <svg
          className="knob-svg"
          viewBox={`0 0 ${VB} ${VB}`}
          style={{ touchAction: 'none' }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onWheel={onWheel}
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

          <g>{ticks}</g>

          <g filter={`url(#ds${uid})`}>
            <circle cx={r} cy={r} r={skirtR} fill={`url(#skirt${uid})`} stroke="#000" strokeWidth={0.6} />
            <g>{flutes}</g>
            <circle cx={r} cy={r} r={skirtR - 0.6} fill="none" stroke="#3a3f47" strokeWidth={0.5} opacity={0.5} />
            <circle cx={r} cy={r} r={capR} fill={`url(#cap${uid})`} stroke="#000" strokeWidth={0.8} />
            <line x1={pix} y1={piy} x2={pox} y2={poy} stroke="#000" strokeWidth={r * 0.085} strokeLinecap="round" />
            <line x1={pix} y1={piy} x2={pox} y2={poy} stroke="#f4f7fa" strokeWidth={r * 0.045} strokeLinecap="round" />
          </g>
        </svg>
      </div>
      {label && <div className="knob-label">{label}</div>}
      {showText && <div className={'knob-val' + (morphing ? ' collapsing' : '')}>{f.main}</div>}
      {showHint && (
        <div className={'knob-hint' + (morphing ? ' collapsing' : '')}>
          <span className="hint-mouse">上下にドラッグ ・ ダブルクリックで初期値</span>
          <span className="hint-touch">上下にドラッグ ・ ダブルタップで初期値</span>
        </div>
      )}
    </div>
  )
}
