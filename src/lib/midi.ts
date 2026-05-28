// Standard MIDI File（SMF, format 1）を最小実装で書き出す。
// SEQ の「SONG 並び」を 1 本の線形タイムラインに展開し、各シンセトラックを
// 1 つの MIDI トラックにする。タイ＝音価の延長、ベロシティ段階＝MIDI velocity。
//
// 含めるもの：音符（ノートオン/オフ）、ベロシティ、テンポ。
// 含めないもの：スイング（ストレートで書き出す）、CUTOFF オートメーション、
//   音色そのもの（MIDI はノート情報のみ。音色は受け側の楽器で作る）。

import { SEQ_STEPS, SEQ_PITCHES, cellKey } from '../tutorial/seqConst'
import type { Project } from './project'

const PPQ = 480 // 4 分音符あたりの tick 数
const TICKS_PER_STEP = PPQ / 4 // 16 分音符 = 120 tick
const GATE_GAP = 12 // 連続音が重ならないよう、音価末尾を少し削る tick
// ベロシティ段階(0=弱,1=中,2=強) → MIDI velocity。
const VEL_TO_MIDI = [53, 89, 127]

// ---- バイト列ユーティリティ ----

/** 可変長数値（delta-time 等）。MIDI の VLQ エンコード。 */
function vlq(value: number): number[] {
  let v = Math.max(0, Math.floor(value))
  const bytes = [v & 0x7f]
  v >>= 7
  while (v > 0) {
    bytes.unshift((v & 0x7f) | 0x80)
    v >>= 7
  }
  return bytes
}

const u16 = (n: number): number[] => [(n >> 8) & 0xff, n & 0xff]
const u32 = (n: number): number[] => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff]

function chunk(id: string, data: number[]): number[] {
  const head = [...id].map((c) => c.charCodeAt(0))
  return [...head, ...u32(data.length), ...data]
}

// ---- ノート抽出 ----

interface NoteEvent {
  tick: number // 絶対 tick
  durTicks: number
  midi: number
  velocity: number
}

/**
 * 1 トラック分のパターン群を SONG 並びに沿って線形ノートに展開する。
 * タイ（連続 ON ＋ tied フラグ）は 1 つの長い音にまとめる。バーは跨がない。
 */
function extractNotes(slots: Project['patterns'][number], songSequence: number[]): NoteEvent[] {
  const notes: NoteEvent[] = []
  songSequence.forEach((slotIdx, pos) => {
    const pattern = slots[slotIdx]
    if (!pattern) return
    const barTick = pos * SEQ_STEPS * TICKS_PER_STEP
    for (const midi of SEQ_PITCHES) {
      for (let step = 0; step < SEQ_STEPS; step++) {
        const key = cellKey(step, midi)
        if (!pattern.on.has(key)) continue
        // 継続音（前セルが ON かつ tied）はここでは起点にしない。
        const prevKey = step > 0 ? cellKey(step - 1, midi) : null
        const isContinuation = prevKey !== null && pattern.on.has(prevKey) && pattern.tied.has(prevKey)
        if (isContinuation) continue
        // 音価：tied で繋がる限り延長（バー内）。
        let lenSteps = 1
        let cur = step
        while (
          cur < SEQ_STEPS - 1 &&
          pattern.tied.has(cellKey(cur, midi)) &&
          pattern.on.has(cellKey(cur + 1, midi))
        ) {
          lenSteps++
          cur++
        }
        const vel = pattern.vel.get(key) ?? 2
        notes.push({
          tick: barTick + step * TICKS_PER_STEP,
          durTicks: Math.max(30, lenSteps * TICKS_PER_STEP - GATE_GAP),
          midi,
          velocity: VEL_TO_MIDI[vel] ?? 127,
        })
      }
    }
  })
  return notes
}

/** ノート列 → MTrk のイベントバイト列（チャンネル ch、0..15）。 */
function notesToTrack(notes: NoteEvent[], ch: number): number[] {
  // 絶対 tick のオン/オフを 1 列に並べ、tick 昇順 → delta に変換。
  interface Ev { tick: number; type: 'on' | 'off'; midi: number; vel: number }
  const evs: Ev[] = []
  for (const n of notes) {
    evs.push({ tick: n.tick, type: 'on', midi: n.midi, vel: n.velocity })
    evs.push({ tick: n.tick + n.durTicks, type: 'off', midi: n.midi, vel: 0 })
  }
  // 同 tick では off を先に（重なり回避）。
  evs.sort((a, b) => a.tick - b.tick || (a.type === b.type ? 0 : a.type === 'off' ? -1 : 1))

  const bytes: number[] = []
  let last = 0
  for (const e of evs) {
    const delta = e.tick - last
    last = e.tick
    bytes.push(...vlq(delta))
    if (e.type === 'on') {
      bytes.push(0x90 | (ch & 0x0f), e.midi & 0x7f, e.vel & 0x7f)
    } else {
      bytes.push(0x80 | (ch & 0x0f), e.midi & 0x7f, 0x00)
    }
  }
  // End of Track
  bytes.push(...vlq(0), 0xff, 0x2f, 0x00)
  return bytes
}

/** テンポトラック（meta）。BPM → microseconds/quarter。 */
function tempoTrack(bpm: number): number[] {
  const usPerQuarter = Math.round(60_000_000 / Math.max(1, bpm))
  const bytes: number[] = []
  // tempo
  bytes.push(...vlq(0), 0xff, 0x51, 0x03, (usPerQuarter >> 16) & 0xff, (usPerQuarter >> 8) & 0xff, usPerQuarter & 0xff)
  // time signature 4/4（24 MIDI clocks/click, 8 32nd/quarter）
  bytes.push(...vlq(0), 0xff, 0x58, 0x04, 0x04, 0x02, 0x18, 0x08)
  bytes.push(...vlq(0), 0xff, 0x2f, 0x00)
  return bytes
}

/**
 * Project から SMF（format 1）バイト列を生成する。
 * トラック構成：[0]=テンポ, [1..]=各シンセトラック。
 * 返り値は ArrayBuffer（Blob にそのまま渡せる）。
 */
export function projectToMidi(project: Project): ArrayBuffer {
  const trackChunks: number[][] = []
  trackChunks.push(chunk('MTrk', tempoTrack(project.bpm)))
  project.patterns.forEach((slots, i) => {
    const notes = extractNotes(slots, project.songSequence)
    trackChunks.push(chunk('MTrk', notesToTrack(notes, i)))
  })
  const ntracks = trackChunks.length
  const header = chunk('MThd', [...u16(1), ...u16(ntracks), ...u16(PPQ)])
  const all = [...header, ...trackChunks.flat()]
  const buf = new ArrayBuffer(all.length)
  new Uint8Array(buf).set(all)
  return buf
}
