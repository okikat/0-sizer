import { useRef } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'

interface Props {
  min: number
  max: number
  value: number
  label: string
  fine?: boolean
  showValue?: boolean
  format?: (v: number) => string
  onChange: (v: number) => void
}

const FINE = 0.25
// 感度の基準（このpx動かすと min→max）。実トラックよりやや小さめで端まで届きやすく。
const SPAN = 64

/** 縦スライダー（A/D/S/R 用）。controlled。上ドラッグで増加。 */
export function Slider({ min, max, value, label, fine = false, showValue = true, format, onChange }: Props) {
  const drag = useRef<{ lastY: number; val: number } | null>(null)

  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    drag.current = { lastY: e.clientY, val: value }
    e.currentTarget.setPointerCapture?.(e.pointerId)
    e.preventDefault()
  }
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current) return
    const dy = drag.current.lastY - e.clientY
    drag.current.lastY = e.clientY
    const sens = ((max - min) / SPAN) * (e.shiftKey || fine ? FINE : 1)
    const nv = Math.max(min, Math.min(max, drag.current.val + dy * sens))
    drag.current.val = nv
    onChange(nv)
  }
  const onUp = () => {
    drag.current = null
  }

  const pct = ((value - min) / (max - min)) * 100

  return (
    <div className="slider-wrap">
      {showValue && <div className="slider-val"><span>{format ? format(value) : value.toFixed(2)}</span></div>}
      <div
        className="slider-hit"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <div className="slider-track">
          <div className="slider-fill" style={{ height: `${pct}%` }} />
          <div className="slider-handle" style={{ bottom: `calc(${pct}% - 7px)` }} />
        </div>
      </div>
      <div className="slider-label">{label}</div>
    </div>
  )
}
