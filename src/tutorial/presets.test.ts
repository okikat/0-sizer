import { describe, it, expect } from 'vitest'
import { PRESETS } from './presets'

// プリセットは画面上で順番に並ぶので、欠番／重複名／レンジ違反があると
// 「あれ、選んだのと違う音が出る」事故になる。構造を最低限ガードする。
describe('PRESETS', () => {
  it('1 つ以上ある', () => {
    expect(PRESETS.length).toBeGreaterThan(0)
  })

  it('name は全てユニーク', () => {
    const names = PRESETS.map((p) => p.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('全プリセットの 0〜10 つまみが範囲内', () => {
    const knob10 = [
      'res', 'lfoRate', 'lfoDepth', 'mixAmt', 'detuneAmt', 'noiseAmt',
      'delayTimeAmt', 'delayMixAmt', 'glideAmt',
      'filterEnvAmt', 'filterEnvDecay', 'reverbMixAmt',
    ] as const
    for (const p of PRESETS) {
      for (const k of knob10) {
        const v = p[k] as number
        expect(v, `${p.name}.${k}`).toBeGreaterThanOrEqual(0)
        expect(v, `${p.name}.${k}`).toBeLessThanOrEqual(10)
      }
    }
  })

  it('cutoff は 0〜1（FILTER CUTOFF は他と違ってこのレンジ）', () => {
    for (const p of PRESETS) {
      expect(p.cutoff, `${p.name}.cutoff`).toBeGreaterThanOrEqual(0)
      expect(p.cutoff, `${p.name}.cutoff`).toBeLessThanOrEqual(1)
    }
  })

  it('env は 4 段（attack/decay/sustain/release）全て >= 0、sustain は 0〜1', () => {
    for (const p of PRESETS) {
      expect(p.env.attack, `${p.name}.attack`).toBeGreaterThanOrEqual(0)
      expect(p.env.decay, `${p.name}.decay`).toBeGreaterThanOrEqual(0)
      expect(p.env.sustain, `${p.name}.sustain`).toBeGreaterThanOrEqual(0)
      expect(p.env.sustain, `${p.name}.sustain`).toBeLessThanOrEqual(1)
      expect(p.env.release, `${p.name}.release`).toBeGreaterThanOrEqual(0)
    }
  })

  it('type / osc2Type は OscillatorType の 4 種に限る', () => {
    const valid = new Set(['sine', 'square', 'sawtooth', 'triangle'])
    for (const p of PRESETS) {
      expect(valid.has(p.type), `${p.name}.type = ${p.type}`).toBe(true)
      expect(valid.has(p.osc2Type), `${p.name}.osc2Type = ${p.osc2Type}`).toBe(true)
    }
  })

  it('filterType は lowpass / highpass / bandpass のいずれか', () => {
    const valid = new Set(['lowpass', 'highpass', 'bandpass'])
    for (const p of PRESETS) {
      expect(valid.has(p.filterType), `${p.name}.filterType = ${p.filterType}`).toBe(true)
    }
  })

  it('osc2Oct は -2〜+2 の整数', () => {
    for (const p of PRESETS) {
      expect(Number.isInteger(p.osc2Oct), `${p.name}.osc2Oct`).toBe(true)
      expect(p.osc2Oct, `${p.name}.osc2Oct`).toBeGreaterThanOrEqual(-2)
      expect(p.osc2Oct, `${p.name}.osc2Oct`).toBeLessThanOrEqual(2)
    }
  })

  it('lfoDest は pitch / cutoff / amp のいずれか', () => {
    const valid = new Set(['pitch', 'cutoff', 'amp'])
    for (const p of PRESETS) {
      expect(valid.has(p.lfoDest), `${p.name}.lfoDest = ${p.lfoDest}`).toBe(true)
    }
  })
})
