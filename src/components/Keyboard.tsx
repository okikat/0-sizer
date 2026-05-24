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
  const pointerMidi = useRef<number | null>(null)

  const press = useCallback(
    (m: number) => {
      setActive((prev) => {
        const next = new Set(prev)
        next.add(m)
        return next
      })
      onNoteOn(m)
    },
    [onNoteOn],
  )

  const release = useCallback(
    (m: number) => {
      setActive((prev) => {
        const next = new Set(prev)
        next.delete(m)
        if (next.size === 0) onNoteOff()
        return next
      })
    },
    [onNoteOff],
  )

  useEffect(() => {
    const up = () => {
      if (pointerMidi.current != null) {
        release(pointerMidi.current)
        pointerMidi.current = null
      }
    }
    window.addEventListener('pointerup', up)
    return () => window.removeEventListener('pointerup', up)
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
            pointerMidi.current = k.m
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
            pointerMidi.current = k.m
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
