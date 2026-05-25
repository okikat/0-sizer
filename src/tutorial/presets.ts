import type { EnvParams } from '../audio/useSynth'

// 音色プリセット。選ぶと 波形・ENV・FILTER(cutoff/res)・LFO(rate/depth) が
// その値へアニメーションで動く。PITCH/VOL/PAN は触らない（演奏・仕上げのため）。
// cutoff は 0〜1（つまみ量）、res/lfoRate/lfoDepth は 0〜10（つまみ量）。
export interface Preset {
  name: string
  type: OscillatorType
  env: EnvParams
  cutoff: number
  res: number
  lfoRate: number
  lfoDepth: number
}

export const PRESETS: Preset[] = [
  { name: 'やわらか', type: 'sine', env: { attack: 0.4, decay: 0.5, sustain: 0.8, release: 0.6 }, cutoff: 0.5, res: 0, lfoRate: 3, lfoDepth: 0 },
  { name: 'ピコピコ', type: 'square', env: { attack: 0.001, decay: 0.12, sustain: 0.4, release: 0.1 }, cutoff: 1, res: 1, lfoRate: 3, lfoDepth: 0 },
  { name: 'ぶっといリード', type: 'sawtooth', env: { attack: 0.02, decay: 0.3, sustain: 0.7, release: 0.3 }, cutoff: 0.7, res: 3, lfoRate: 3, lfoDepth: 0 },
  { name: 'ニュイ〜ン', type: 'sawtooth', env: { attack: 0.05, decay: 0.4, sustain: 0.6, release: 0.4 }, cutoff: 0.45, res: 8, lfoRate: 3, lfoDepth: 0 },
  { name: 'ゆれるパッド', type: 'triangle', env: { attack: 0.6, decay: 0.6, sustain: 0.85, release: 0.8 }, cutoff: 0.55, res: 1, lfoRate: 3, lfoDepth: 3 },
]
