import { useCallback, useEffect, useRef, useState } from 'react'

interface Props {
  onNoteOn: (midi: number) => void
  onNoteOff: () => void
}

const WHITES = [
  { m: 60, l: 'ド', k: 'A' },
  { m: 62, l: 'レ', k: 'S' },
  { m: 64, l: 'ミ', k: 'D' },
  { m: 65, l: 'ファ', k: 'F' },
  { m: 67, l: 'ソ', k: 'G' },
  { m: 69, l: 'ラ', k: 'H' },
  { m: 71, l: 'シ', k: 'J' },
  { m: 72, l: 'ド', k: 'K' },
]
const BLACKS = [
  { m: 61, pos: 1, k: 'W' },
  { m: 63, pos: 2, k: 'E' },
  { m: 66, pos: 4, k: 'T' },
  { m: 68, pos: 5, k: 'Y' },
  { m: 70, pos: 6, k: 'U' },
]
const KMAP: Record<string, number> = {
  a: 60, w: 61, s: 62, e: 63, d: 64, f: 65, t: 66, g: 67, y: 68, h: 69, u: 70, j: 71, k: 72,
}

/** 1オクターブの鍵盤。離散の音を弾く担当（マウス/タッチ + PCキー a s d f g h j k / w e t y u）。 */
export function Keyboard({ onNoteOn, onNoteOff }: Props) {
  const [active, setActive] = useState<Set<number>>(new Set())
  const ww = 100 / WHITES.length
  const bw = ww * 0.6
  // 指(ポインタ)ごとに押している音を覚える。1個だけ覚える実装だと複数指で
  // 取りこぼし、離しても鍵盤が押されたまま(鳴りっぱなし)になる。
  const pointers = useRef<Map<number, number>>(new Map())
  // 押している音の「順番」。離したとき、残っている直近の音へ戻す(モノ=最後優先)。
  const held = useRef<number[]>([])

  const press = useCallback(
    (m: number) => {
      const h = held.current
      if (h.includes(m)) return
      h.push(m)
      setActive(new Set(h))
      onNoteOn(m)
    },
    [onNoteOn],
  )

  const release = useCallback(
    (m: number) => {
      const h = held.current
      const i = h.indexOf(m)
      if (i === -1) return
      const wasTop = i === h.length - 1
      h.splice(i, 1)
      setActive(new Set(h))
      if (h.length === 0) onNoteOff()
      else if (wasTop) onNoteOn(h[h.length - 1])
    },
    [onNoteOff, onNoteOn],
  )

  useEffect(() => {
    const up = (e: PointerEvent) => {
      const m = pointers.current.get(e.pointerId)
      if (m == null) return
      pointers.current.delete(e.pointerId)
      release(m)
    }
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [release])

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.repeat) return
      const m = KMAP[e.key]
      if (m == null) return
      press(m)
    }
    const up = (e: KeyboardEvent) => {
      const m = KMAP[e.key]
      if (m == null) return
      release(m)
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [press, release])

  return (
    <div className="piano">
      {WHITES.map((k, i) => (
        <div
          key={k.m}
          className={'wkey' + (active.has(k.m) ? ' active' : '')}
          style={{ left: `${i * ww}%`, width: `${ww}%` }}
          onPointerDown={(e) => {
            pointers.current.set(e.pointerId, k.m)
            press(k.m)
            e.preventDefault()
          }}
        >
          <span className="kk">{k.k}</span>
          <span className="kn">{k.l}</span>
        </div>
      ))}
      {BLACKS.map((k) => (
        <div
          key={k.m}
          className={'bkey' + (active.has(k.m) ? ' active' : '')}
          style={{ left: `${k.pos * ww - bw / 2}%`, width: `${bw}%` }}
          onPointerDown={(e) => {
            pointers.current.set(e.pointerId, k.m)
            press(k.m)
            e.preventDefault()
          }}
        >
          <span className="kk">{k.k}</span>
          <span className="kn">♯</span>
        </div>
      ))}
    </div>
  )
}
