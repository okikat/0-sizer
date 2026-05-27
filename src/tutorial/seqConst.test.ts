import { describe, it, expect } from 'vitest'
import {
  SEQ_STEPS,
  SLOTS_PER_TRACK,
  SLOT_LABELS,
  SEQ_PITCHES,
  SEQ_NOTE_LABEL,
  SEQ_BPM_MIN,
  SEQ_BPM_MAX,
  SEQ_SWING_MIN,
  SEQ_SWING_MAX,
  SONG_MIN_LENGTH,
  SONG_MAX_LENGTH,
  cellKey,
} from './seqConst'

describe('seqConst', () => {
  it('SEQ_STEPS は 16（4 拍×4）', () => {
    expect(SEQ_STEPS).toBe(16)
  })

  it('SLOT_LABELS は A B C D で SLOTS_PER_TRACK と一致', () => {
    expect(SLOT_LABELS).toEqual(['A', 'B', 'C', 'D'])
    expect(SLOT_LABELS.length).toBe(SLOTS_PER_TRACK)
  })

  it('SEQ_PITCHES は 14 行（白鍵 2 オクターブ C3〜B4）で上から高音順', () => {
    expect(SEQ_PITCHES.length).toBe(14)
    // 並びは「上＝高音」のピアノロール慣習
    for (let i = 1; i < SEQ_PITCHES.length; i++) {
      expect(SEQ_PITCHES[i]).toBeLessThan(SEQ_PITCHES[i - 1])
    }
    // 最高音 = B4(71)、最低音 = C3(48)
    expect(SEQ_PITCHES[0]).toBe(71)
    expect(SEQ_PITCHES[SEQ_PITCHES.length - 1]).toBe(48)
  })

  it('SEQ_PITCHES は全て白鍵（半音 = 1, 3, 6, 8, 10 を含まない）', () => {
    const blackKeySemitones = new Set([1, 3, 6, 8, 10])
    for (const midi of SEQ_PITCHES) {
      expect(blackKeySemitones.has(midi % 12)).toBe(false)
    }
  })

  it('SEQ_NOTE_LABEL は全 SEQ_PITCHES をカバー（オクターブ番号付き）', () => {
    for (const midi of SEQ_PITCHES) {
      const label = SEQ_NOTE_LABEL[midi]
      expect(label).toBeDefined()
      expect(label).toMatch(/^[A-G][34]$/)
    }
  })

  it('BPM / SWING のレンジは音楽的に妥当', () => {
    expect(SEQ_BPM_MIN).toBeLessThan(SEQ_BPM_MAX)
    expect(SEQ_BPM_MIN).toBeGreaterThanOrEqual(20)
    expect(SEQ_BPM_MAX).toBeLessThanOrEqual(300)
    expect(SEQ_SWING_MIN).toBe(0)
    expect(SEQ_SWING_MAX).toBeGreaterThan(0)
    expect(SEQ_SWING_MAX).toBeLessThanOrEqual(100)
  })

  it('SONG_MIN_LENGTH ≤ SONG_MAX_LENGTH', () => {
    expect(SONG_MIN_LENGTH).toBeGreaterThanOrEqual(1)
    expect(SONG_MAX_LENGTH).toBeGreaterThanOrEqual(SONG_MIN_LENGTH)
  })

  describe('cellKey', () => {
    it('"{step}_{midi}" 形式の文字列', () => {
      expect(cellKey(0, 60)).toBe('0_60')
      expect(cellKey(15, 71)).toBe('15_71')
    })

    it('異なる step / midi は必ず異なるキー', () => {
      const keys = new Set<string>()
      for (let step = 0; step < SEQ_STEPS; step++) {
        for (const midi of SEQ_PITCHES) {
          keys.add(cellKey(step, midi))
        }
      }
      expect(keys.size).toBe(SEQ_STEPS * SEQ_PITCHES.length)
    })
  })
})
