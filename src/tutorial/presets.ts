import type { EnvParams } from '../audio/useSynth'

// 音色プリセット。選ぶと 波形・ENV・FILTER(cutoff/res)・LFO(rate/depth) が
// その値へアニメーションで動く。PITCH/VOL/PAN は触らない（演奏・仕上げのため）。
// cutoff は 0〜1（つまみ量）、res/lfoRate/lfoDepth は 0〜10（つまみ量）。
// 単一オシレーター・モノフォニックの制約内で、それっぽさを再現した近似音。
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
  // 実楽器寄り
  { name: 'ピアノ',     type: 'sawtooth', env: { attack: 0.005, decay: 0.6,  sustain: 0.25, release: 0.4 }, cutoff: 0.65, res: 1, lfoRate: 3, lfoDepth: 0 },
  { name: 'オルガン',   type: 'sawtooth', env: { attack: 0.001, decay: 0.1,  sustain: 1.0,  release: 0.05 }, cutoff: 0.8,  res: 1, lfoRate: 3, lfoDepth: 0 },
  { name: 'フルート',   type: 'sine',     env: { attack: 0.08,  decay: 0.2,  sustain: 0.85, release: 0.2 }, cutoff: 0.95, res: 0, lfoRate: 5, lfoDepth: 1 },
  { name: 'ストリングス', type: 'sawtooth', env: { attack: 0.5,   decay: 0.5,  sustain: 0.9,  release: 0.8 }, cutoff: 0.6,  res: 1, lfoRate: 4, lfoDepth: 1 },
  { name: 'ベース',     type: 'sawtooth', env: { attack: 0.003, decay: 0.3,  sustain: 0.5,  release: 0.15 }, cutoff: 0.4,  res: 2, lfoRate: 3, lfoDepth: 0 },
  { name: 'テルミン',   type: 'sine',     env: { attack: 0.15,  decay: 0.2,  sustain: 1.0,  release: 0.3 }, cutoff: 1.0,  res: 0, lfoRate: 5, lfoDepth: 4 },

  // シンセ寄り
  { name: 'シンセリード', type: 'sawtooth', env: { attack: 0.01,  decay: 0.3,  sustain: 0.8,  release: 0.3 }, cutoff: 0.75, res: 4, lfoRate: 5, lfoDepth: 2 },
  { name: 'シンセパッド', type: 'triangle', env: { attack: 0.8,   decay: 0.5,  sustain: 0.9,  release: 1.0 }, cutoff: 0.55, res: 1, lfoRate: 2, lfoDepth: 2 },
  { name: 'チップチューン', type: 'square', env: { attack: 0.001, decay: 0.1,  sustain: 0.5,  release: 0.05 }, cutoff: 1.0, res: 0, lfoRate: 3, lfoDepth: 0 },
  { name: 'アシッドベース', type: 'sawtooth', env: { attack: 0.005, decay: 0.25, sustain: 0.4, release: 0.2 }, cutoff: 0.35, res: 8, lfoRate: 3, lfoDepth: 0 },
]
