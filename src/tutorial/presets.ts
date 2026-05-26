import type { EnvParams, LfoDest } from '../audio/useSynth'

// 音色プリセット。選ぶと 波形・ENV・FILTER(cutoff/res)・LFO(rate/depth)・
// OSC2(mix/detune) が、その値へアニメーションで動く。加えて内部パラメータの
// フィルターEnv もプリセット時に切り替わる（ツマミ表示なし、エンジン内部）。
// 値はすべて「つまみ量(0〜10 等)」で持つ。実パラメータへの変換は audio/params で行う。
export interface Preset {
  name: string
  type: OscillatorType
  env: EnvParams
  cutoff: number      // 0〜1 のつまみ量（FILTER CUTOFF）
  res: number         // 0〜10
  lfoRate: number     // 0〜10
  lfoDepth: number    // 0〜10
  mixAmt: number      // 0〜10（OSC2 ミックスバランス。0=OSC1のみ, 5=半々, 10=OSC2のみ）
  detuneAmt: number   // 0〜10（OSC2 デチューン）
  noiseAmt: number    // 0〜10（NOISE 音量）
  lfoDest: LfoDest    // LFO の行き先（pitch=ビブラート / cutoff=オートワウ / amp=トレモロ）
  delayTimeAmt: number // 0〜10（DELAY 遅れる時間 50〜1000ms）
  delayMixAmt: number  // 0〜10（DELAY 山びこの大きさ）
  filterEnvAmt: number     // フィルターEnv 持ち上げ（オクターブ）
  filterEnvDecay: number   // フィルターEnv 戻り時間（秒）
}

export const PRESETS: Preset[] = [
  // 実楽器寄り
  {
    name: 'ピアノ',
    type: 'sawtooth',
    env: { attack: 0.003, decay: 0.8, sustain: 0.2, release: 0.25 },
    cutoff: 0.55, res: 0, lfoRate: 3, lfoDepth: 0,
    mixAmt: 5, detuneAmt: 1, noiseAmt: 0, lfoDest: 'pitch', delayTimeAmt: 3, delayMixAmt: 0,
    filterEnvAmt: 2.5, filterEnvDecay: 0.45,
  },
  {
    name: 'オルガン',
    type: 'sawtooth',
    env: { attack: 0.002, decay: 0.05, sustain: 1.0, release: 0.05 },
    cutoff: 0.8, res: 1, lfoRate: 5, lfoDepth: 1,
    mixAmt: 5, detuneAmt: 1, noiseAmt: 0, lfoDest: 'pitch', delayTimeAmt: 3, delayMixAmt: 0,
    filterEnvAmt: 0, filterEnvDecay: 0.2,
  },
  {
    name: 'フルート',
    type: 'sine',
    env: { attack: 0.1, decay: 0.2, sustain: 0.85, release: 0.15 },
    cutoff: 1.0, res: 0, lfoRate: 5, lfoDepth: 1.5,
    mixAmt: 0, detuneAmt: 0, noiseAmt: 1, lfoDest: 'pitch', delayTimeAmt: 3, delayMixAmt: 0,
    filterEnvAmt: 0, filterEnvDecay: 0.2,
  },
  {
    name: 'ストリングス',
    type: 'sawtooth',
    env: { attack: 0.4, decay: 0.4, sustain: 0.85, release: 0.6 },
    cutoff: 0.5, res: 1, lfoRate: 4, lfoDepth: 2,
    mixAmt: 5, detuneAmt: 3, noiseAmt: 0, lfoDest: 'pitch', delayTimeAmt: 3, delayMixAmt: 0,
    filterEnvAmt: 0, filterEnvDecay: 0.2,
  },
  {
    name: 'ベース',
    type: 'sawtooth',
    env: { attack: 0.002, decay: 0.6, sustain: 0.0, release: 0.15 },
    cutoff: 0.3, res: 2, lfoRate: 3, lfoDepth: 0,
    mixAmt: 5, detuneAmt: 1, noiseAmt: 0, lfoDest: 'pitch', delayTimeAmt: 3, delayMixAmt: 0,
    filterEnvAmt: 2, filterEnvDecay: 0.4,
  },
  {
    name: 'テルミン',
    type: 'sine',
    env: { attack: 0.2, decay: 0.2, sustain: 1.0, release: 0.3 },
    cutoff: 1.0, res: 0, lfoRate: 5, lfoDepth: 5,
    mixAmt: 0, detuneAmt: 0, noiseAmt: 0, lfoDest: 'pitch', delayTimeAmt: 3, delayMixAmt: 0,
    filterEnvAmt: 0, filterEnvDecay: 0.2,
  },
  // シンセ寄り
  {
    name: 'シンセリード',
    type: 'sawtooth',
    env: { attack: 0.005, decay: 0.25, sustain: 0.85, release: 0.3 },
    cutoff: 0.78, res: 4, lfoRate: 5, lfoDepth: 2,
    mixAmt: 5, detuneAmt: 2, noiseAmt: 0, lfoDest: 'pitch', delayTimeAmt: 4, delayMixAmt: 2,
    filterEnvAmt: 1.2, filterEnvDecay: 0.3,
  },
  {
    name: 'シンセパッド',
    type: 'triangle',
    env: { attack: 0.9, decay: 0.6, sustain: 0.9, release: 1.2 },
    cutoff: 0.55, res: 1, lfoRate: 2, lfoDepth: 2,
    mixAmt: 5, detuneAmt: 4, noiseAmt: 0, lfoDest: 'pitch', delayTimeAmt: 6, delayMixAmt: 3,
    filterEnvAmt: 0, filterEnvDecay: 0.2,
  },
  {
    name: 'チップチューン',
    type: 'square',
    env: { attack: 0.001, decay: 0.08, sustain: 0.6, release: 0.05 },
    cutoff: 1.0, res: 0, lfoRate: 3, lfoDepth: 0,
    mixAmt: 0, detuneAmt: 0, noiseAmt: 0, lfoDest: 'pitch', delayTimeAmt: 3, delayMixAmt: 0,
    filterEnvAmt: 0, filterEnvDecay: 0.2,
  },
  {
    name: 'アシッドベース',
    type: 'sawtooth',
    env: { attack: 0.002, decay: 0.3, sustain: 0.0, release: 0.15 },
    cutoff: 0.3, res: 8, lfoRate: 3, lfoDepth: 0,
    mixAmt: 0, detuneAmt: 0, noiseAmt: 0, lfoDest: 'pitch', delayTimeAmt: 3, delayMixAmt: 2,
    filterEnvAmt: 3, filterEnvDecay: 0.35,
  },
]
