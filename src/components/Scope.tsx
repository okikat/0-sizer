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
      for (let x = 0; x <= w; x++) {
        const t = (x / w) * cycles + phase
        const y = mid - waveValue(typeRef.current, t) * (h * 0.38)
        if (x === 0) g.moveTo(x, y)
        else g.lineTo(x, y)
      }
      g.stroke()

      if (playRef.current) phase += 0.02
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [])

  return <canvas ref={ref} width={528} height={110} className="scope" />
}
