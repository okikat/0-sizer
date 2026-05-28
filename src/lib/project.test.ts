import { describe, it, expect } from 'vitest'
import {
  serializeProject,
  deserializeProject,
  projectToJSON,
  projectFromJSON,
  isProjectEmpty,
  type Project,
} from './project'
import {
  emptyPattern,
  defaultAutomations,
  defaultTracks,
  DEFAULT_SONG_SEQUENCE,
  TRACK_COUNT,
} from './seqStorage'
import { SLOTS_PER_TRACK, SEQ_STEPS } from '../tutorial/seqConst'

function sampleProject(): Project {
  const patterns = Array.from({ length: TRACK_COUNT }, () =>
    Array.from({ length: SLOTS_PER_TRACK }, () => emptyPattern()),
  )
  // トラック0スロットAに「タイ＋強弱」入りのパターンを置く。
  patterns[0][0].on.add('0_60')
  patterns[0][0].on.add('1_60')
  patterns[0][0].tied.add('0_60')
  patterns[0][0].vel.set('1_60', 0) // 弱
  patterns[1][2].on.add('4_67')
  patterns[1][2].vel.set('4_67', 1) // 中
  return {
    bpm: 128,
    swing: 20,
    patterns,
    automations: defaultAutomations(),
    automationEnabled: [true, false],
    songSequence: [0, 0, 1, 2],
    songMode: true,
    tracks: defaultTracks(),
  }
}

describe('project: シリアライズの往復', () => {
  it('serialize → deserialize で主要データが保たれる', () => {
    const p = sampleProject()
    const round = deserializeProject(serializeProject(p))!
    expect(round).not.toBeNull()
    expect(round.bpm).toBe(128)
    expect(round.swing).toBe(20)
    expect(round.songMode).toBe(true)
    expect(round.songSequence).toEqual([0, 0, 1, 2])
    expect(round.automationEnabled.length).toBe(TRACK_COUNT)
    expect(round.automationEnabled[0]).toBe(true)
    expect(round.automationEnabled[1]).toBe(false)
    // パターン（on/tied/vel）の往復
    expect(round.patterns[0][0].on.has('0_60')).toBe(true)
    expect(round.patterns[0][0].on.has('1_60')).toBe(true)
    expect(round.patterns[0][0].tied.has('0_60')).toBe(true)
    expect(round.patterns[0][0].vel.get('1_60')).toBe(0)
    expect(round.patterns[1][2].vel.get('4_67')).toBe(1)
  })

  it('JSON 文字列の往復でも保たれる', () => {
    const p = sampleProject()
    const round = projectFromJSON(projectToJSON(p))!
    expect(round.patterns[0][0].vel.get('1_60')).toBe(0)
    expect(round.songSequence).toEqual([0, 0, 1, 2])
  })

  it('vel は on に含まれるキー・値 0/1 のみ採用（強=エントリ無し）', () => {
    const raw = {
      v: 1,
      bpm: 120,
      swing: 0,
      patterns: [
        [{ on: ['0_60'], tied: [], vel: { '0_60': 2, '9_60': 0 } }],
      ],
      automations: [],
      automationEnabled: [],
      songSequence: [0],
      songMode: false,
      tracks: [],
    }
    const p = deserializeProject(raw)!
    // 値 2（強）は保存しない、on に無い 9_60 も無視
    expect(p.patterns[0][0].vel.has('0_60')).toBe(false)
    expect(p.patterns[0][0].vel.has('9_60')).toBe(false)
    expect(p.patterns[0][0].on.has('0_60')).toBe(true)
  })

  it('壊れた入力は安全側のデフォルトに整う', () => {
    const p = deserializeProject({ bpm: 'x', songSequence: 'nope', patterns: 'broken' })!
    expect(p).not.toBeNull()
    expect(p.bpm).toBe(120) // 非数値 → 既定
    expect(p.songSequence).toEqual(DEFAULT_SONG_SEQUENCE)
    expect(p.patterns.length).toBe(TRACK_COUNT)
    expect(p.patterns[0].length).toBe(SLOTS_PER_TRACK)
    expect(p.automations[0][0].length).toBe(SEQ_STEPS)
  })

  it('音色の追加パラメータ（osc2Type / osc2Oct / filterType）が往復する', () => {
    const p = sampleProject()
    p.tracks[0] = { ...p.tracks[0], osc2Type: 'square', osc2Oct: -1, filterType: 'highpass' }
    const round = deserializeProject(serializeProject(p))!
    expect(round.tracks[0].osc2Type).toBe('square')
    expect(round.tracks[0].osc2Oct).toBe(-1)
    expect(round.tracks[0].filterType).toBe('highpass')
  })

  it('裏方 Env（filterEnv ADSR / pitchEnv）が往復し、範囲外はクランプ', () => {
    const p = sampleProject()
    p.tracks[0] = { ...p.tracks[0], fenvAttack: 5, fenvSustain: 7, fenvRelease: 3, pitchEnvAmt: -7, pitchEnvDecay: 4 }
    const round = deserializeProject(serializeProject(p))!
    expect(round.tracks[0].fenvAttack).toBe(5)
    expect(round.tracks[0].fenvSustain).toBe(7)
    expect(round.tracks[0].fenvRelease).toBe(3)
    expect(round.tracks[0].pitchEnvAmt).toBe(-7)
    expect(round.tracks[0].pitchEnvDecay).toBe(4)
    // 範囲外はクランプ（pitchEnvAmt は -12〜+12、つまみは 0〜10）
    const bad = deserializeProject({
      bpm: 120, songSequence: [0],
      tracks: [{ fenvAttack: 99, pitchEnvAmt: -99 }],
    })!
    expect(bad.tracks[0].fenvAttack).toBe(10)
    expect(bad.tracks[0].pitchEnvAmt).toBe(-12)
  })

  it('追加パラメータの型違い・範囲外は既定へ寄せる', () => {
    const raw = {
      v: 1,
      bpm: 120,
      swing: 0,
      patterns: [],
      automations: [],
      automationEnabled: [],
      songSequence: [0],
      songMode: false,
      tracks: [{ osc2Type: 'bogus', osc2Oct: 99, filterType: 'nope' }],
    }
    const p = deserializeProject(raw)!
    expect(p.tracks[0].osc2Type).toBe('sine')      // 不正 → 既定
    expect(p.tracks[0].filterType).toBe('lowpass') // 不正 → 既定
    expect(p.tracks[0].osc2Oct).toBe(2)            // 99 → クランプ +2
  })

  it('null / 非オブジェクトは null', () => {
    expect(deserializeProject(null)).toBeNull()
    expect(deserializeProject(42)).toBeNull()
    expect(projectFromJSON('not json')).toBeNull()
  })

  it('BPM / SWING は範囲外でクランプ', () => {
    const p = deserializeProject({ bpm: 9999, swing: -50, songSequence: [0] })!
    expect(p.bpm).toBeLessThanOrEqual(240)
    expect(p.swing).toBeGreaterThanOrEqual(0)
  })

  it('songSequence は 0..SLOTS_PER_TRACK-1 にクランプ、長さ上限あり', () => {
    const p = deserializeProject({ songSequence: [0, 5, -1, 99, 2], bpm: 120 })!
    for (const v of p.songSequence) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(SLOTS_PER_TRACK)
    }
  })

  it('isProjectEmpty：全パターン空で true、1 つでも ON があれば false', () => {
    const empty = deserializeProject({ bpm: 120, songSequence: [0] })!
    expect(isProjectEmpty(empty)).toBe(true)
    expect(isProjectEmpty(sampleProject())).toBe(false)
  })
})
