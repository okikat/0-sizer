import { describe, it, expect } from 'vitest'
import { projectToMidi } from './midi'
import {
  emptyPattern,
  defaultAutomations,
  defaultTracks,
  TRACK_COUNT,
} from './seqStorage'
import { SLOTS_PER_TRACK } from '../tutorial/seqConst'
import type { Project } from './project'

function projectWith(onCells: Array<[number, number, number, number]>): Project {
  // onCells: [track, slot, step, midi]
  const patterns = Array.from({ length: TRACK_COUNT }, () =>
    Array.from({ length: SLOTS_PER_TRACK }, () => emptyPattern()),
  )
  for (const [t, s, step, midi] of onCells) {
    patterns[t][s].on.add(`${step}_${midi}`)
  }
  return {
    bpm: 120,
    swing: 0,
    patterns,
    automations: defaultAutomations(),
    automationEnabled: [false, false],
    songSequence: [0],
    songMode: false,
    tracks: defaultTracks(),
  }
}

const ascii = (bytes: Uint8Array, start: number, len: number) =>
  String.fromCharCode(...Array.from(bytes.slice(start, start + len)))

describe('midi: SMF 生成', () => {
  it('MThd ヘッダで始まり、format=1・division=480', () => {
    const buf = projectToMidi(projectWith([]))
    const b = new Uint8Array(buf)
    expect(ascii(b, 0, 4)).toBe('MThd')
    // length = 6
    expect([b[4], b[5], b[6], b[7]]).toEqual([0, 0, 0, 6])
    // format = 1
    expect([b[8], b[9]]).toEqual([0, 1])
    // ntracks = テンポ + TRACK_COUNT
    expect((b[10] << 8) | b[11]).toBe(1 + TRACK_COUNT)
    // division = 480
    expect((b[12] << 8) | b[13]).toBe(480)
  })

  it('トラックチャンクは MTrk で始まる', () => {
    const b = new Uint8Array(projectToMidi(projectWith([])))
    // ヘッダ 14 バイトの直後がテンポトラック
    expect(ascii(b, 14, 4)).toBe('MTrk')
  })

  it('ノートを置くと NoteOn(0x90) と NoteOff(0x80) が出現する', () => {
    const b = new Uint8Array(projectToMidi(projectWith([[0, 0, 0, 60]])))
    let hasOn = false
    let hasOff = false
    for (let i = 0; i < b.length; i++) {
      if (b[i] === 0x90 && b[i + 1] === 60) hasOn = true
      if (b[i] === 0x80 && b[i + 1] === 60) hasOff = true
    }
    expect(hasOn).toBe(true)
    expect(hasOff).toBe(true)
  })

  it('ノートが無くても壊れず生成できる（全トラック空）', () => {
    const buf = projectToMidi(projectWith([]))
    expect(buf.byteLength).toBeGreaterThan(14)
  })

  it('末尾に End of Track（FF 2F 00）を含む', () => {
    const b = new Uint8Array(projectToMidi(projectWith([[0, 0, 0, 60]])))
    let count = 0
    for (let i = 0; i < b.length - 2; i++) {
      if (b[i] === 0xff && b[i + 1] === 0x2f && b[i + 2] === 0x00) count++
    }
    // テンポ + 各トラックぶん
    expect(count).toBe(1 + TRACK_COUNT)
  })
})
