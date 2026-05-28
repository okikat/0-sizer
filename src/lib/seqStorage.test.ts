import { describe, it, expect } from 'vitest'
import {
  emptyPattern,
  migrateOldSet,
  normalizeAutomationArr,
  defaultAutomationSlot,
  defaultAutomations,
  defaultTracks,
  DEFAULT_SOUND,
  DEFAULT_SONG_SEQUENCE,
  TRACK_COUNT,
  VEL_SCALES,
  VEL_STRONG,
} from './seqStorage'
import { SEQ_STEPS, SLOTS_PER_TRACK } from '../tutorial/seqConst'

describe('seqStorage: emptyPattern', () => {
  it('空の on / tied Set と vel Map を持つ', () => {
    const p = emptyPattern()
    expect(p.on.size).toBe(0)
    expect(p.tied.size).toBe(0)
    expect(p.vel.size).toBe(0)
  })

  it('呼び出すたびに独立した Set/Map（共有でない）', () => {
    const a = emptyPattern()
    const b = emptyPattern()
    a.on.add('0_60')
    a.vel.set('0_60', 1)
    expect(b.on.size).toBe(0)
    expect(b.vel.size).toBe(0)
  })
})

describe('seqStorage: migrateOldSet（旧 v0.1〜v0.3 → 新フォーマット）', () => {
  it('隣接 step 同 midi が連続 ON なら tied を付ける', () => {
    const p = migrateOldSet(['0_60', '1_60'])
    expect(p.on).toEqual(new Set(['0_60', '1_60']))
    expect(p.tied).toEqual(new Set(['0_60'])) // 0→1 への繋ぎ
  })

  it('移行時は vel 空（全て強扱い）で音量が変わらない', () => {
    const p = migrateOldSet(['0_60', '1_60'])
    expect(p.vel.size).toBe(0)
  })

  it('隣接しない（step が飛んでる）なら tied は付かない', () => {
    const p = migrateOldSet(['0_60', '2_60'])
    expect(p.on).toEqual(new Set(['0_60', '2_60']))
    expect(p.tied.size).toBe(0)
  })

  it('違う midi なら隣接でも tied は付かない', () => {
    const p = migrateOldSet(['0_60', '1_62'])
    expect(p.tied.size).toBe(0)
  })

  it('3 連は 2 本の tied を持つ', () => {
    const p = migrateOldSet(['0_60', '1_60', '2_60'])
    expect(p.tied).toEqual(new Set(['0_60', '1_60']))
  })

  it('最終 step は tied を持たない（次が無いので）', () => {
    const lastStep = SEQ_STEPS - 1
    const p = migrateOldSet([`${lastStep}_60`])
    expect(p.tied.size).toBe(0)
  })

  it('壊れたキー（"_" が無い）は無視される', () => {
    const p = migrateOldSet(['garbage', '0_60', '1_60'])
    expect(p.on.has('garbage')).toBe(true) // on にはそのまま残る（後段で扱う）
    expect(p.tied).toEqual(new Set(['0_60']))
  })

  it('空配列 → 空パターン', () => {
    const p = migrateOldSet([])
    expect(p.on.size).toBe(0)
    expect(p.tied.size).toBe(0)
  })
})

describe('seqStorage: normalizeAutomationArr', () => {
  it('長さ SEQ_STEPS で返る（短い入力はデフォルト 0.5 で埋める）', () => {
    expect(normalizeAutomationArr([0.1, 0.2]).length).toBe(SEQ_STEPS)
  })

  it('範囲外（負・1超）は 0〜1 にクランプ', () => {
    const arr = normalizeAutomationArr([-1, 2, 0.5])
    expect(arr[0]).toBe(0)
    expect(arr[1]).toBe(1)
    expect(arr[2]).toBe(0.5)
  })

  it('非数値（NaN になる入力）は 0.5（中央）に', () => {
    // Number(null) は 0、Number(undefined) は NaN、Number('x') も NaN。
    // 仕様：Number.isFinite で振り分け、NaN なら 0.5 に。0 は有効値として扱う。
    const arr = normalizeAutomationArr(['x', undefined, NaN, 0.3])
    expect(arr[0]).toBe(0.5)
    expect(arr[1]).toBe(0.5)
    expect(arr[2]).toBe(0.5)
    expect(arr[3]).toBe(0.3)
  })

  it('配列でない入力 → 全 0.5', () => {
    const arr = normalizeAutomationArr('not-an-array' as unknown)
    expect(arr.length).toBe(SEQ_STEPS)
    expect(arr.every((v) => v === 0.5)).toBe(true)
  })

  it('長すぎる入力は SEQ_STEPS で切られる', () => {
    const long = Array(SEQ_STEPS * 2).fill(0.3)
    const arr = normalizeAutomationArr(long)
    expect(arr.length).toBe(SEQ_STEPS)
    expect(arr.every((v) => v === 0.3)).toBe(true)
  })
})

describe('seqStorage: 構造的デフォルト', () => {
  it('defaultAutomationSlot は SEQ_STEPS 個の 0.5', () => {
    const s = defaultAutomationSlot()
    expect(s.length).toBe(SEQ_STEPS)
    expect(s.every((v) => v === 0.5)).toBe(true)
  })

  it('defaultAutomations は [TRACK_COUNT][SLOTS_PER_TRACK][SEQ_STEPS]', () => {
    const a = defaultAutomations()
    expect(a.length).toBe(TRACK_COUNT)
    expect(a[0].length).toBe(SLOTS_PER_TRACK)
    expect(a[0][0].length).toBe(SEQ_STEPS)
  })

  it('defaultTracks は TRACK_COUNT 個の独立 SoundState（env も共有しない）', () => {
    const t = defaultTracks()
    expect(t.length).toBe(TRACK_COUNT)
    t[0].env.attack = 999
    expect(t[1].env.attack).not.toBe(999)
  })

  it('DEFAULT_SOUND の音作りつまみは妥当な範囲', () => {
    expect(DEFAULT_SOUND.cutoff).toBeGreaterThanOrEqual(0)
    expect(DEFAULT_SOUND.cutoff).toBeLessThanOrEqual(1)
    expect(DEFAULT_SOUND.vol).toBeGreaterThanOrEqual(0)
    expect(DEFAULT_SOUND.vol).toBeLessThanOrEqual(10)
    expect(DEFAULT_SOUND.pan).toBeGreaterThanOrEqual(-5)
    expect(DEFAULT_SOUND.pan).toBeLessThanOrEqual(5)
  })

  it('DEFAULT_SOUND の追加パラメータ（OSC2 波形/oct, フィルタ種別）が既定値', () => {
    expect(DEFAULT_SOUND.osc2Type).toBe('sine')
    expect(DEFAULT_SOUND.osc2Oct).toBe(0)
    expect(DEFAULT_SOUND.filterType).toBe('lowpass')
  })

  it('DEFAULT_SONG_SEQUENCE は全て 0 ≤ v < SLOTS_PER_TRACK', () => {
    expect(DEFAULT_SONG_SEQUENCE.length).toBeGreaterThan(0)
    for (const v of DEFAULT_SONG_SEQUENCE) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(SLOTS_PER_TRACK)
    }
  })

  it('VEL_SCALES は弱<中<強の昇順、全て 0〜1、強(=VEL_STRONG)はフル(1.0)', () => {
    expect(VEL_SCALES.length).toBe(3)
    expect(VEL_SCALES[0]).toBeLessThan(VEL_SCALES[1])
    expect(VEL_SCALES[1]).toBeLessThan(VEL_SCALES[2])
    for (const v of VEL_SCALES) {
      expect(v).toBeGreaterThan(0)
      expect(v).toBeLessThanOrEqual(1)
    }
    // 強は VEL_STRONG=2 番目のインデックス、音量フル。既存パターンの音が変わらない担保。
    expect(VEL_STRONG).toBe(2)
    expect(VEL_SCALES[VEL_STRONG]).toBe(1.0)
  })
})
