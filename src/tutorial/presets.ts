import type { EnvParams } from '../audio/useSynth'

// 音色プリセット。選ぶと 波形・ENV・FILTER(cutoff/res)・LFO(rate/depth) が
// その値へアニメーションで動く。加えて内部パラメータ（detune・フィルターEnv）も
// プリセット時に切り替わるが、これらはツマミ表示なし。
// cutoff は 0〜1（つまみ量）、res/lfoRate/lfoDepth は 0〜10（つまみ量）。
export interface Preset {
  name: string
  type: OscillatorType
  env: EnvParams
  cutoff: number
  res: number
  lfoRate: number
  lfoDepth: number
  /** 2本目オシレーターのデチューン（セント）。0 で素、大きいほど厚く豊か。 */
  detune: number
  /** 弾いた瞬間にフィルターを持ち上げる量（オクターブ）。0 でフィルターEnvなし。 */
  filterEnvAmt: number
  /** フィルターが基準値へ戻る時間（秒）。 */
  filterEnvDecay: number
}

export const PRESETS: Preset[] = [
  // 実楽器寄り
  {
    name: 'ピアノ',
    type: 'sawtooth',
    env: { attack: 0.003, decay: 0.8, sustain: 0.2, release: 0.25 },
    cutoff: 0.55, res: 0, lfoRate: 3, lfoDepth: 0,
    detune: 6, filterEnvAmt: 2.5, filterEnvDecay: 0.45,
  },
  {
    name: 'オルガン',
    type: 'sawtooth',
    env: { attack: 0.002, decay: 0.05, sustain: 1.0, release: 0.05 },
    cutoff: 0.8, res: 1, lfoRate: 5, lfoDepth: 1,
    detune: 5, filterEnvAmt: 0, filterEnvDecay: 0.2,
  },
  {
    name: 'フルート',
    type: 'sine',
    env: { attack: 0.1, decay: 0.2, sustain: 0.85, release: 0.15 },
    cutoff: 1.0, res: 0, lfoRate: 5, lfoDepth: 1.5,
    detune: 0, filterEnvAmt: 0, filterEnvDecay: 0.2,
  },
  {
    name: 'ストリングス',
    type: 'sawtooth',
    env: { attack: 0.4, decay: 0.4, sustain: 0.85, release: 0.6 },
    cutoff: 0.5, res: 1, lfoRate: 4, lfoDepth: 2,
    detune: 12, filterEnvAmt: 0, filterEnvDecay: 0.2,
  },
  {
    name: 'ベース',
    type: 'sawtooth',
    env: { attack: 0.002, decay: 0.6, sustain: 0.0, release: 0.15 },
    cutoff: 0.3, res: 2, lfoRate: 3, lfoDepth: 0,
    detune: 3, filterEnvAmt: 2, filterEnvDecay: 0.4,
  },
  {
    name: 'テルミン',
    type: 'sine',
    env: { attack: 0.2, decay: 0.2, sustain: 1.0, release: 0.3 },
    cutoff: 1.0, res: 0, lfoRate: 5, lfoDepth: 5,
    detune: 0, filterEnvAmt: 0, filterEnvDecay: 0.2,
  },
  // シンセ寄り
  {
    name: 'シンセリード',
    type: 'sawtooth',
    env: { attack: 0.005, decay: 0.25, sustain: 0.85, release: 0.3 },
    cutoff: 0.78, res: 4, lfoRate: 5, lfoDepth: 2,
    detune: 8, filterEnvAmt: 1.2, filterEnvDecay: 0.3,
  },
  {
    name: 'シンセパッド',
    type: 'triangle',
    env: { attack: 0.9, decay: 0.6, sustain: 0.9, release: 1.2 },
    cutoff: 0.55, res: 1, lfoRate: 2, lfoDepth: 2,
    detune: 14, filterEnvAmt: 0, filterEnvDecay: 0.2,
  },
  {
    name: 'チップチューン',
    type: 'square',
    env: { attack: 0.001, decay: 0.08, sustain: 0.6, release: 0.05 },
    cutoff: 1.0, res: 0, lfoRate: 3, lfoDepth: 0,
    detune: 0, filterEnvAmt: 0, filterEnvDecay: 0.2,
  },
  {
    name: 'アシッドベース',
    type: 'sawtooth',
    env: { attack: 0.002, decay: 0.3, sustain: 0.0, release: 0.15 },
    cutoff: 0.3, res: 8, lfoRate: 3, lfoDepth: 0,
    detune: 0, filterEnvAmt: 3, filterEnvDecay: 0.35,
  },
]
