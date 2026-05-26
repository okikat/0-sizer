import type { EnvParams, LfoDest } from '../audio/useSynth'

// 音色プリセット。選ぶと 波形・ENV・FILTER(cutoff/res)・LFO(rate/depth)・
// OSC2(mix/detune)・NOISE・DELAY・GLIDE・FILTER ENV のすべてがその値へ
// アニメーションで動く（lfoDest だけは離散切替で即時）。
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
  glideAmt: number     // 0〜10（GLIDE 滑る速さ）
  filterEnvAmt: number     // 0〜10（フィルターEnv 持ち上げ量）
  filterEnvDecay: number   // 0〜10（フィルターEnv 戻り時間）
}

export const PRESETS: Preset[] = [
  // 実楽器寄り
  {
    name: 'ピアノ',
    type: 'sawtooth',
    env: { attack: 0.003, decay: 0.9, sustain: 0.15, release: 0.3 },
    cutoff: 0.55, res: 0, lfoRate: 3, lfoDepth: 0,
    mixAmt: 5, detuneAmt: 2, noiseAmt: 1, lfoDest: 'pitch', delayTimeAmt: 3, delayMixAmt: 0, glideAmt: 0,
    filterEnvAmt: 8, filterEnvDecay: 3,
  },
  {
    name: 'オルガン',
    type: 'sawtooth',
    env: { attack: 0.002, decay: 0.05, sustain: 1.0, release: 0.05 },
    cutoff: 0.8, res: 1, lfoRate: 6, lfoDepth: 2,
    mixAmt: 5, detuneAmt: 2, noiseAmt: 0, lfoDest: 'amp', delayTimeAmt: 3, delayMixAmt: 1, glideAmt: 0,
    filterEnvAmt: 0, filterEnvDecay: 1,
  },
  {
    name: 'フルート',
    type: 'sine',
    env: { attack: 0.12, decay: 0.2, sustain: 0.85, release: 0.2 },
    cutoff: 1.0, res: 0, lfoRate: 5, lfoDepth: 1.5,
    mixAmt: 0, detuneAmt: 0, noiseAmt: 2, lfoDest: 'pitch', delayTimeAmt: 4, delayMixAmt: 1, glideAmt: 1,
    filterEnvAmt: 0, filterEnvDecay: 1,
  },
  {
    name: 'ストリングス',
    type: 'sawtooth',
    env: { attack: 0.5, decay: 0.4, sustain: 0.9, release: 0.8 },
    cutoff: 0.5, res: 1, lfoRate: 4, lfoDepth: 2,
    mixAmt: 5, detuneAmt: 5, noiseAmt: 0, lfoDest: 'pitch', delayTimeAmt: 6, delayMixAmt: 2, glideAmt: 0,
    filterEnvAmt: 0, filterEnvDecay: 1,
  },
  {
    name: 'ベース',
    type: 'sawtooth',
    env: { attack: 0.002, decay: 0.6, sustain: 0.0, release: 0.15 },
    cutoff: 0.3, res: 2, lfoRate: 3, lfoDepth: 0,
    mixAmt: 5, detuneAmt: 2, noiseAmt: 1, lfoDest: 'pitch', delayTimeAmt: 3, delayMixAmt: 0, glideAmt: 1,
    filterEnvAmt: 8, filterEnvDecay: 2,
  },
  {
    name: 'テルミン',
    type: 'sine',
    env: { attack: 0.25, decay: 0.2, sustain: 1.0, release: 0.4 },
    cutoff: 1.0, res: 0, lfoRate: 5, lfoDepth: 5,
    mixAmt: 0, detuneAmt: 0, noiseAmt: 0, lfoDest: 'pitch', delayTimeAmt: 5, delayMixAmt: 2, glideAmt: 5,
    filterEnvAmt: 0, filterEnvDecay: 1,
  },
  // シンセ寄り
  {
    name: 'シンセリード',
    type: 'sawtooth',
    env: { attack: 0.005, decay: 0.25, sustain: 0.85, release: 0.3 },
    cutoff: 0.78, res: 4, lfoRate: 5, lfoDepth: 2,
    mixAmt: 5, detuneAmt: 4, noiseAmt: 0, lfoDest: 'pitch', delayTimeAmt: 4, delayMixAmt: 3, glideAmt: 2,
    filterEnvAmt: 4, filterEnvDecay: 2,
  },
  {
    name: 'シンセパッド',
    type: 'triangle',
    env: { attack: 0.9, decay: 0.6, sustain: 0.9, release: 1.4 },
    cutoff: 0.55, res: 1, lfoRate: 2, lfoDepth: 2,
    mixAmt: 5, detuneAmt: 6, noiseAmt: 0, lfoDest: 'cutoff', delayTimeAmt: 6, delayMixAmt: 4, glideAmt: 0,
    filterEnvAmt: 0, filterEnvDecay: 1,
  },
  {
    name: 'チップチューン',
    type: 'square',
    env: { attack: 0.001, decay: 0.08, sustain: 0.6, release: 0.05 },
    cutoff: 1.0, res: 0, lfoRate: 3, lfoDepth: 0,
    mixAmt: 0, detuneAmt: 0, noiseAmt: 0, lfoDest: 'pitch', delayTimeAmt: 2, delayMixAmt: 1, glideAmt: 0,
    filterEnvAmt: 0, filterEnvDecay: 1,
  },
  {
    name: 'アシッドベース',
    type: 'sawtooth',
    env: { attack: 0.002, decay: 0.3, sustain: 0.0, release: 0.15 },
    cutoff: 0.3, res: 8, lfoRate: 3, lfoDepth: 0,
    mixAmt: 0, detuneAmt: 0, noiseAmt: 0, lfoDest: 'pitch', delayTimeAmt: 3, delayMixAmt: 3, glideAmt: 2,
    filterEnvAmt: 10, filterEnvDecay: 2,
  },
]
