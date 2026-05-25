import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'

interface Props {
  onNoteOn: (midi: number) => void
  onNoteOff: () => void
  /** 鍵盤上の音名（ドレミ・♯）を出すか。盤面では「解説表示」と連動。 */
  showLabels?: boolean
}

const LOW = 48 // C3
const HIGH = 84 // C6
const WKEY_W = 40
const BW = WKEY_W * 0.6
const WHITE_OFFSETS = [0, 2, 4, 5, 7, 9, 11]
const BLACK_OFFSETS = [1, 3, 6, 8, 10]
const NAME: Record<number, string> = { 0: 'ド', 2: 'レ', 4: 'ミ', 5: 'ファ', 7: 'ソ', 9: 'ラ', 11: 'シ' }
// PC キーは「ホームのオクターブ（C4〜C5）」だけに割り当てる。
const KMAP: Record<string, number> = {
  a: 60, w: 61, s: 62, e: 63, d: 64, f: 65, t: 66, g: 67, y: 68, h: 69, u: 70, j: 71, k: 72,
}
const KLABEL: Record<number, string> = {
  60: 'A', 61: 'W', 62: 'S', 63: 'E', 64: 'D', 65: 'F', 66: 'T', 67: 'G', 68: 'Y', 69: 'H', 70: 'U', 71: 'J', 72: 'K',
}

interface White { m: number; wi: number; name: string; isC: boolean; oct: number }
interface Black { m: number; x: number }

function buildKeys() {
  const whites: White[] = []
  const blacks: Black[] = []
  const wiByMidi: Record<number, number> = {}
  let wi = 0
  for (let m = LOW; m <= HIGH; m++) {
    const pc = m % 12
    if (WHITE_OFFSETS.includes(pc)) {
      wiByMidi[m] = wi
      whites.push({ m, wi, name: NAME[pc], isC: pc === 0, oct: Math.floor(m / 12) - 1 })
      wi++
    }
  }
  for (let m = LOW; m <= HIGH; m++) {
    const pc = m % 12
    if (BLACK_OFFSETS.includes(pc)) {
      const lw = wiByMidi[m - 1]
      if (lw != null) blacks.push({ m, x: (lw + 1) * WKEY_W })
    }
  }
  return { whites, blacks }
}

const { whites: WHITES, blacks: BLACKS } = buildKeys()
const TOTAL_W = WHITES.length * WKEY_W
const HOME_X = (WHITES.find((w) => w.m === 60)!.wi + 3.5) * WKEY_W // ホームのオクターブ中央
// ホーム(C4)からの距離で記号を変える：0=◎ / 1=● / 2以上=・
const cMark = (oct: number) => {
  const d = Math.abs(oct - 4)
  return d === 0 ? '◎' : d === 1 ? '●' : '・'
}

/** 多オクターブの鍵盤。キーは弾く専用、移動は下のバー。ドの位置を◎/●/・で示す。 */
export function Keyboard({ onNoteOn, onNoteOff, showLabels = true }: Props) {
  const [active, setActive] = useState<Set<number>>(new Set())
  const [win, setWin] = useState({ left: 0, width: 1 })
  const pointers = useRef<Map<number, number>>(new Map())
  const held = useRef<number[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)
  const pianoRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const barDrag = useRef(false)

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

  // iOS の長押し拡大鏡(ルーペ)対策：user-select:none だけでは出てしまうので、
  // 鍵盤の touch 既定動作を止める。pointerdown は別系統なので発音には影響しない。
  useEffect(() => {
    const el = pianoRef.current
    if (!el) return
    const prevent = (e: TouchEvent) => e.preventDefault()
    el.addEventListener('touchstart', prevent, { passive: false })
    el.addEventListener('touchmove', prevent, { passive: false })
    return () => {
      el.removeEventListener('touchstart', prevent)
      el.removeEventListener('touchmove', prevent)
    }
  }, [])

  const syncWin = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const sw = el.scrollWidth || 1
    setWin({ left: el.scrollLeft / sw, width: el.clientWidth / sw })
  }, [])

  const center = useCallback((smooth: boolean) => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ left: Math.max(0, HOME_X - el.clientWidth / 2), behavior: smooth ? 'smooth' : 'auto' })
  }, [])

  useEffect(() => {
    center(false)
    syncWin()
  }, [center, syncWin])

  const barTo = (clientX: number) => {
    const bar = barRef.current
    const el = scrollRef.current
    if (!bar || !el) return
    const r = bar.getBoundingClientRect()
    const frac = Math.min(1, Math.max(0, (clientX - r.left) / r.width))
    el.scrollLeft = frac * el.scrollWidth - el.clientWidth / 2
  }
  const onBarDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    barDrag.current = true
    e.currentTarget.setPointerCapture?.(e.pointerId)
    barTo(e.clientX)
    e.preventDefault()
  }
  const onBarMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (barDrag.current) barTo(e.clientX)
  }
  const onBarUp = () => {
    barDrag.current = false
  }

  return (
    <div className="kbd">
      <div className="kbd-scroll" ref={scrollRef} onScroll={syncWin}>
        <div className="piano" ref={pianoRef} style={{ width: TOTAL_W }} onContextMenu={(e) => e.preventDefault()}>
          {WHITES.map((w) => (
            <div
              key={w.m}
              className={'wkey' + (active.has(w.m) ? ' active' : '')}
              style={{ left: w.wi * WKEY_W, width: WKEY_W }}
              onPointerDown={(e) => {
                pointers.current.set(e.pointerId, w.m)
                press(w.m)
                e.preventDefault()
              }}
            >
              {w.isC && <span className={'ckey-mark' + (w.oct === 4 ? ' home' : '')}>{cMark(w.oct)}</span>}
              {KLABEL[w.m] && <span className="kk">{KLABEL[w.m]}</span>}
              {showLabels && <span className="kn">{w.name}</span>}
            </div>
          ))}
          {BLACKS.map((b) => (
            <div
              key={b.m}
              className={'bkey' + (active.has(b.m) ? ' active' : '')}
              style={{ left: b.x - BW / 2, width: BW }}
              onPointerDown={(e) => {
                pointers.current.set(e.pointerId, b.m)
                press(b.m)
                e.preventDefault()
              }}
            >
              {KLABEL[b.m] && <span className="kk">{KLABEL[b.m]}</span>}
              {showLabels && <span className="kn">♯</span>}
            </div>
          ))}
        </div>
      </div>

      <div className="kbd-nav">
        <button className="kbd-home" onClick={() => center(true)} aria-label="ホーム位置(ド)に戻る">
          ◎
        </button>
        <div
          className="kbd-bar"
          ref={barRef}
          onPointerDown={onBarDown}
          onPointerMove={onBarMove}
          onPointerUp={onBarUp}
          onPointerCancel={onBarUp}
        >
          <div className="kbd-bar-win" style={{ left: `${win.left * 100}%`, width: `${win.width * 100}%` }} />
          {WHITES.filter((w) => w.isC).map((w) => (
            <span
              key={w.m}
              className={'kbd-bar-c' + (w.oct === 4 ? ' home' : '')}
              style={{ left: `${((w.wi * WKEY_W + WKEY_W / 2) / TOTAL_W) * 100}%` }}
            >
              {cMark(w.oct)}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
