import { useEffect, useRef } from 'react'

interface Props {
  type: OscillatorType
  playing: boolean
}

function waveValue(type: OscillatorType, t: number): number {
  switch (type) {
    case 'sine':
      return Math.sin(t * 2 * Math.PI)
    case 'triangle':
      return 2 * Math.abs(2 * (t - Math.floor(t + 0.5))) - 1
    case 'sawtooth':
      return 2 * (t - Math.floor(t + 0.5))
    case 'square':
      return t % 1 < 0.5 ? 1 : -1
    default:
      return 0
  }
}

/** 計器：今の波形を描く。鳴っている間は波が流れ、色がオレンジに変わる。 */
export function Scope({ type, playing }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const typeRef = useRef(type)
  const playRef = useRef(playing)

  // render 中ではなく effect で同期する（react-hooks/refs ルール）
  useEffect(() => {
    typeRef.current = type
    playRef.current = playing
  }, [type, playing])

  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    const g = cv.getContext('2d')
    if (!g) return
    let raf = 0
    let phase = 0
    let last = 0
    // 描画は 30fps に間引く（毎フレームの canvas 描画が音声処理を圧迫しないように）。
    const minDelta = 1000 / 30

    const draw = () => {
      const w = cv.width
      const h = cv.height
      const mid = h / 2
      g.clearRect(0, 0, w, h)
      g.strokeStyle = '#1d2530'
      g.lineWidth = 1
      g.beginPath()
      g.moveTo(0, mid)
      g.lineTo(w, mid)
      g.stroke()

      g.strokeStyle = playRef.current ? '#f2a65a' : '#5ad1c4'
      g.lineWidth = 2.5
      g.beginPath()
      const cycles = 3
      // 2px 刻みで点数を半分にして描画コストを下げる（見た目はほぼ同じ）。
      for (let x = 0; x <= w; x += 2) {
        const t = (x / w) * cycles + phase
        const y = mid - waveValue(typeRef.current, t) * (h * 0.38)
        if (x === 0) g.moveTo(x, y)
        else g.lineTo(x, y)
      }
      g.stroke()
    }

    const loop = (ts: number) => {
      if (ts - last >= minDelta) {
        last = ts
        draw()
        if (playRef.current) phase += 0.04
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  return <canvas ref={ref} width={528} height={110} className="scope" />
}
