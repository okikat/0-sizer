import { describe, it, expect } from 'vitest'
import {
  cutoffNormToHz,
  resAmtToQ,
  lfoRateToHz,
  lfoDepthToCents,
  volAmtToGain,
  panAmtToPos,
  noiseAmtToLevel,
  delayTimeAmtToSec,
  delayMixAmtToLevel,
  reverbMixAmtToLevel,
  glideAmtToTau,
  fenvAmtToOctaves,
  fenvDecayAmtToSec,
  fenvAttackAmtToSec,
  fenvReleaseAmtToSec,
  fenvSustainAmtToFrac,
  pitchEnvDecayAmtToSec,
  detuneAmtToCents,
  mixAmtToBalance,
  fmtTime,
  fmtPct,
  fmtHz,
  fmtPan,
  fmtDelayMs,
  fmtMix,
} from './params'

// ツマミ→実パラメータ変換テスト。境界（0 と 10）と中点（5）で
// 仕様コメント通りの値が出ることを確認する。
describe('params: knob → engine value', () => {
  it('cutoffNormToHz: 0→80Hz, 1→16kHz, 中央は対数で約 1131Hz', () => {
    expect(cutoffNormToHz(0)).toBeCloseTo(80)
    expect(cutoffNormToHz(1)).toBeCloseTo(16000)
    expect(cutoffNormToHz(0.5)).toBeCloseTo(Math.sqrt(80 * 16000), 0)
  })

  it('resAmtToQ: 0→0.7, 10→16', () => {
    expect(resAmtToQ(0)).toBeCloseTo(0.7)
    expect(resAmtToQ(10)).toBeCloseTo(16)
  })

  it('lfoRateToHz: 0→0.3Hz, 10→12Hz', () => {
    expect(lfoRateToHz(0)).toBeCloseTo(0.3)
    expect(lfoRateToHz(10)).toBeCloseTo(12)
  })

  it('lfoDepthToCents: 0→0, 10→200セント', () => {
    expect(lfoDepthToCents(0)).toBe(0)
    expect(lfoDepthToCents(10)).toBe(200)
  })

  it('volAmtToGain: 0→0, 10→1', () => {
    expect(volAmtToGain(0)).toBe(0)
    expect(volAmtToGain(10)).toBe(1)
  })

  it('panAmtToPos: -5→-1, 5→1, 0→0', () => {
    expect(panAmtToPos(-5)).toBe(-1)
    expect(panAmtToPos(5)).toBe(1)
    expect(panAmtToPos(0)).toBe(0)
  })

  it('noiseAmtToLevel: 0→0, 10→0.5', () => {
    expect(noiseAmtToLevel(0)).toBe(0)
    expect(noiseAmtToLevel(10)).toBe(0.5)
  })

  it('delayTimeAmtToSec: 0→0.05s, 10→1s', () => {
    expect(delayTimeAmtToSec(0)).toBeCloseTo(0.05)
    expect(delayTimeAmtToSec(10)).toBeCloseTo(1)
  })

  it('delayMixAmtToLevel: 0→0, 10→0.5', () => {
    expect(delayMixAmtToLevel(0)).toBe(0)
    expect(delayMixAmtToLevel(10)).toBe(0.5)
  })

  it('reverbMixAmtToLevel: 0→0, 10→0.5', () => {
    expect(reverbMixAmtToLevel(0)).toBe(0)
    expect(reverbMixAmtToLevel(10)).toBe(0.5)
  })

  it('glideAmtToTau: 0→0.005s, 10→0.505s', () => {
    expect(glideAmtToTau(0)).toBeCloseTo(0.005)
    expect(glideAmtToTau(10)).toBeCloseTo(0.505)
  })

  it('fenvAmtToOctaves: 0→0, 10→3 オクターブ', () => {
    expect(fenvAmtToOctaves(0)).toBe(0)
    expect(fenvAmtToOctaves(10)).toBe(3)
  })

  it('fenvDecayAmtToSec: 0→0.05s, 10→1.5s', () => {
    expect(fenvDecayAmtToSec(0)).toBeCloseTo(0.05)
    expect(fenvDecayAmtToSec(10)).toBeCloseTo(1.5)
  })

  it('fenvAttack/Release: 0→0s, 10→1.2s', () => {
    expect(fenvAttackAmtToSec(0)).toBeCloseTo(0)
    expect(fenvAttackAmtToSec(10)).toBeCloseTo(1.2)
    expect(fenvReleaseAmtToSec(0)).toBeCloseTo(0)
    expect(fenvReleaseAmtToSec(10)).toBeCloseTo(1.2)
  })

  it('fenvSustainAmtToFrac: 0→0, 10→1（範囲外はクランプ）', () => {
    expect(fenvSustainAmtToFrac(0)).toBe(0)
    expect(fenvSustainAmtToFrac(10)).toBe(1)
    expect(fenvSustainAmtToFrac(20)).toBe(1)
    expect(fenvSustainAmtToFrac(-5)).toBe(0)
  })

  it('pitchEnvDecayAmtToSec: 0→0.005s, 10→0.805s', () => {
    expect(pitchEnvDecayAmtToSec(0)).toBeCloseTo(0.005)
    expect(pitchEnvDecayAmtToSec(10)).toBeCloseTo(0.805)
  })

  it('detuneAmtToCents: 0→0, 10→50 セント', () => {
    expect(detuneAmtToCents(0)).toBe(0)
    expect(detuneAmtToCents(10)).toBe(50)
  })

  it('mixAmtToBalance: 0→0, 5→0.5, 10→1', () => {
    expect(mixAmtToBalance(0)).toBe(0)
    expect(mixAmtToBalance(5)).toBe(0.5)
    expect(mixAmtToBalance(10)).toBe(1)
  })
})

describe('params: display formatters', () => {
  it('fmtTime: <1s は ms、≥1s は s 表記', () => {
    expect(fmtTime(0.5)).toBe('500 ms')
    expect(fmtTime(1.234)).toBe('1.23 s')
  })

  it('fmtPct: 小数→整数 %', () => {
    expect(fmtPct(0.5)).toBe('50 %')
    expect(fmtPct(0)).toBe('0 %')
    expect(fmtPct(1)).toBe('100 %')
  })

  it('fmtHz: 1000Hz 未満はそのまま、以上は k 単位', () => {
    expect(fmtHz(500)).toBe('500')
    expect(fmtHz(1500)).toBe('1.5k')
    expect(fmtHz(16000)).toBe('16.0k')
  })

  it('fmtPan: 0→C、負→Lx、正→Rx', () => {
    expect(fmtPan(0)).toBe('C')
    expect(fmtPan(-3)).toBe('L3')
    expect(fmtPan(4)).toBe('R4')
  })

  it('fmtDelayMs: 秒→ms 文字列', () => {
    expect(fmtDelayMs(0.25)).toBe('250')
    expect(fmtDelayMs(1)).toBe('1000')
  })

  it('fmtMix: 5→M、<5→1:n、>5→n:2', () => {
    expect(fmtMix(5)).toBe('M')
    expect(fmtMix(0)).toBe('1:5')
    expect(fmtMix(3)).toBe('1:2')
    expect(fmtMix(7)).toBe('2:2')
    expect(fmtMix(10)).toBe('5:2')
  })
})

describe('params: 単調性（音作りの直感を担保）', () => {
  it('cutoff は単調増加', () => {
    let prev = -Infinity
    for (let i = 0; i <= 10; i++) {
      const v = cutoffNormToHz(i / 10)
      expect(v).toBeGreaterThan(prev)
      prev = v
    }
  })

  it('lfoRate / glide / delay / fenvDecay は全て単調増加', () => {
    for (let i = 1; i <= 10; i++) {
      const a = i / 10
      const b = (i - 1) / 10
      expect(lfoRateToHz(i)).toBeGreaterThan(lfoRateToHz(i - 1))
      expect(glideAmtToTau(i)).toBeGreaterThan(glideAmtToTau(i - 1))
      expect(delayTimeAmtToSec(i)).toBeGreaterThan(delayTimeAmtToSec(i - 1))
      expect(fenvDecayAmtToSec(i)).toBeGreaterThan(fenvDecayAmtToSec(i - 1))
      // 値そのものを参照しない（lint 警告抑止）
      void a; void b
    }
  })
})
