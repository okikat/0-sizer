import { describe, it, expect } from 'vitest'
import { midiToFreq, noteName } from './notes'

describe('notes', () => {
  it('midiToFreq: A4 = 440Hz', () => {
    expect(midiToFreq(69)).toBeCloseTo(440)
  })
  it('midiToFreq: 1オクターブ上で2倍', () => {
    expect(midiToFreq(81)).toBeCloseTo(880)
  })
  it('noteName: 440Hz は A4', () => {
    expect(noteName(440)).toBe('A4')
  })
  it('noteName: 約261.6Hz は C4', () => {
    expect(noteName(261.63)).toBe('C4')
  })
})
