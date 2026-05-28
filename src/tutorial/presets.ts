import type { EnvParams, LfoDest, FilterKind } from '../audio/useSynth'

// 音色プリセット。選ぶと 波形・ENV・FILTER(cutoff/res)・LFO(rate/depth)・
// OSC2(mix/detune)・NOISE・DELAY・GLIDE・FILTER ENV のすべてがその値へ
// アニメーションで動く（lfoDest だけは離散切替で即時）。
// 値はすべて「つまみ量(0〜10 等)」で持つ。実パラメータへの変換は audio/params で行う。
export interface Preset {
  name: string
  type: OscillatorType       // OSC1 波形
  osc2Type: OscillatorType   // OSC2 波形（OSC1 と独立）
  osc2Oct: number            // OSC2 のオクターブ移調（-2〜+2、整数）
  filterType: FilterKind     // フィルター種別（lowpass=上を削る / highpass=下を削る / bandpass=その帯だけ）
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
  filterEnvDecay: number   // 0〜10（フィルターEnv 戻り時間＝サステインへ向かう減衰）
  reverbMixAmt: number     // 0〜10（REVERB 響きの混ぜ量）
  // --- 裏方（任意）。UI なし。未指定なら 0＝従来挙動。プリセットの再現度を上げる用 ---
  pulseWidth?: number        // 0〜1（既定 0.5=矩形）。type/osc2Type が square のとき効く
  filterEnvAttack?: number   // 0〜10（フィルターEnv 立ち上がり）
  filterEnvSustain?: number  // 0〜10（フィルターEnv 保持する明るさの割合）
  filterEnvRelease?: number  // 0〜10（離鍵後に base へ戻る時間）
  pitchEnvAmt?: number       // -12〜+12（発音直後の音程ずれ・半音）
  pitchEnvDecay?: number     // 0〜10（音程が目標へ収まる時間）
}

// 現行プリセット（Codex 生成・名前と音を一致させたもの）。
export const PRESETS: Preset[] = [
  {
    name: 'ピアノ',
    type: 'triangle',
    osc2Type: 'sine',
    osc2Oct: 1,
    filterType: 'lowpass',
    env: { attack: 0.003, decay: 1.15, sustain: 0.18, release: 0.42 },
    cutoff: 0.45,
    res: 1.5,
    lfoRate: 4,
    lfoDepth: 0,
    mixAmt: 2.8,
    detuneAmt: 0.2,
    noiseAmt: 0.22,
    lfoDest: 'pitch',
    delayTimeAmt: 1.4,
    delayMixAmt: 0.7,
    glideAmt: 0,
    filterEnvAmt: 3.8,
    filterEnvDecay: 2.1,
    reverbMixAmt: 2.5,
    filterEnvAttack: 0,
    filterEnvSustain: 0,
    filterEnvRelease: 1.2,
  },
  {
    name: 'エレキギター',
    type: 'sawtooth',
    osc2Type: 'square',
    osc2Oct: 0,
    filterType: 'bandpass',
    env: { attack: 0.006, decay: 0.52, sustain: 0.34, release: 0.2 },
    cutoff: 0.49,
    res: 4.4,
    lfoRate: 5.4,
    lfoDepth: 0.22,
    mixAmt: 4.7,
    detuneAmt: 1.2,
    noiseAmt: 0.42,
    lfoDest: 'pitch',
    delayTimeAmt: 2.6,
    delayMixAmt: 1.5,
    glideAmt: 0.35,
    filterEnvAmt: 2.2,
    filterEnvDecay: 1.25,
    reverbMixAmt: 2,
    filterEnvAttack: 0,
    filterEnvSustain: 1.6,
    filterEnvRelease: 0.5,
    pitchEnvAmt: 0.35,
    pitchEnvDecay: 0.7,
    pulseWidth: 0.36,
  },
  {
    name: 'エレキベース',
    type: 'triangle',
    osc2Type: 'square',
    osc2Oct: -1,
    filterType: 'lowpass',
    env: { attack: 0.018, decay: 0.95, sustain: 0.46, release: 0.18 },
    cutoff: 0.24,
    res: 1.7,
    lfoRate: 2.2,
    lfoDepth: 0,
    mixAmt: 3.5,
    detuneAmt: 0.35,
    noiseAmt: 0.06,
    lfoDest: 'cutoff',
    delayTimeAmt: 0.6,
    delayMixAmt: 0,
    glideAmt: 0.45,
    filterEnvAmt: 2.8,
    filterEnvDecay: 2.2,
    reverbMixAmt: 0.25,
    filterEnvAttack: 0,
    filterEnvSustain: 1.8,
    filterEnvRelease: 0.6,
    pitchEnvAmt: 0.55,
    pitchEnvDecay: 0.8,
    pulseWidth: 0.48,
  },
  {
    name: 'バイオリン',
    type: 'sawtooth',
    osc2Type: 'square',
    osc2Oct: 0,
    filterType: 'lowpass',
    env: { attack: 0.18, decay: 0.45, sustain: 0.86, release: 0.68 },
    cutoff: 0.55,
    res: 2.4,
    lfoRate: 5.7,
    lfoDepth: 0.68,
    mixAmt: 4.3,
    detuneAmt: 2.1,
    noiseAmt: 0.16,
    lfoDest: 'pitch',
    delayTimeAmt: 2.2,
    delayMixAmt: 0.8,
    glideAmt: 0.85,
    filterEnvAmt: 0.9,
    filterEnvDecay: 3.4,
    reverbMixAmt: 4.2,
    filterEnvAttack: 1.2,
    filterEnvSustain: 6.5,
    filterEnvRelease: 4,
    pulseWidth: 0.34,
  },
  {
    name: 'テルミン',
    type: 'sine',
    osc2Type: 'triangle',
    osc2Oct: 0,
    filterType: 'lowpass',
    env: { attack: 0.08, decay: 0.2, sustain: 0.95, release: 0.65 },
    cutoff: 0.72,
    res: 1.1,
    lfoRate: 6.2,
    lfoDepth: 0.9,
    mixAmt: 2.3,
    detuneAmt: 0.15,
    noiseAmt: 0,
    lfoDest: 'pitch',
    delayTimeAmt: 3.8,
    delayMixAmt: 1.7,
    glideAmt: 7.6,
    filterEnvAmt: 0,
    filterEnvDecay: 1,
    reverbMixAmt: 4.8,
  },
]

// 旧プリセット（一旦非表示）。復活させる時はこの配列を PRESETS に戻す。
export const LEGACY_PRESETS: Preset[] = [
  // 実楽器寄り
  {
    name: 'ピアノ',
    type: 'sawtooth',
    osc2Type: 'sawtooth', osc2Oct: 0, filterType: 'lowpass',
    env: { attack: 0.003, decay: 0.9, sustain: 0.15, release: 0.3 },
    cutoff: 0.55, res: 0, lfoRate: 3, lfoDepth: 0,
    mixAmt: 5, detuneAmt: 2, noiseAmt: 1, lfoDest: 'pitch', delayTimeAmt: 3, delayMixAmt: 0, glideAmt: 0,
    filterEnvAmt: 8, filterEnvDecay: 3, reverbMixAmt: 3,
  },
  {
    name: 'オルガン',
    type: 'sawtooth',
    osc2Type: 'sawtooth', osc2Oct: 0, filterType: 'lowpass',
    env: { attack: 0.002, decay: 0.05, sustain: 1.0, release: 0.05 },
    cutoff: 0.8, res: 1, lfoRate: 6, lfoDepth: 2,
    mixAmt: 5, detuneAmt: 2, noiseAmt: 0, lfoDest: 'amp', delayTimeAmt: 3, delayMixAmt: 1, glideAmt: 0,
    filterEnvAmt: 0, filterEnvDecay: 1, reverbMixAmt: 4,
  },
  {
    name: 'フルート',
    type: 'sine',
    osc2Type: 'sine', osc2Oct: 0, filterType: 'lowpass',
    env: { attack: 0.12, decay: 0.2, sustain: 0.85, release: 0.2 },
    cutoff: 1.0, res: 0, lfoRate: 5, lfoDepth: 1.5,
    mixAmt: 0, detuneAmt: 0, noiseAmt: 2, lfoDest: 'pitch', delayTimeAmt: 4, delayMixAmt: 1, glideAmt: 1,
    filterEnvAmt: 0, filterEnvDecay: 1, reverbMixAmt: 5,
  },
  {
    name: 'ストリングス',
    type: 'sawtooth',
    osc2Type: 'sawtooth', osc2Oct: 0, filterType: 'lowpass',
    env: { attack: 0.5, decay: 0.4, sustain: 0.9, release: 0.8 },
    cutoff: 0.5, res: 1, lfoRate: 4, lfoDepth: 2,
    mixAmt: 5, detuneAmt: 5, noiseAmt: 0, lfoDest: 'pitch', delayTimeAmt: 6, delayMixAmt: 2, glideAmt: 0,
    filterEnvAmt: 0, filterEnvDecay: 1, reverbMixAmt: 7,
  },
  {
    name: 'ベース',
    type: 'sawtooth',
    osc2Type: 'sawtooth', osc2Oct: 0, filterType: 'lowpass',
    env: { attack: 0.002, decay: 0.6, sustain: 0.0, release: 0.15 },
    cutoff: 0.3, res: 2, lfoRate: 3, lfoDepth: 0,
    mixAmt: 5, detuneAmt: 2, noiseAmt: 1, lfoDest: 'pitch', delayTimeAmt: 3, delayMixAmt: 0, glideAmt: 1,
    filterEnvAmt: 8, filterEnvDecay: 2, reverbMixAmt: 2,
  },
  {
    name: 'テルミン',
    type: 'sine',
    osc2Type: 'sine', osc2Oct: 0, filterType: 'lowpass',
    env: { attack: 0.25, decay: 0.2, sustain: 1.0, release: 0.4 },
    cutoff: 1.0, res: 0, lfoRate: 5, lfoDepth: 5,
    mixAmt: 0, detuneAmt: 0, noiseAmt: 0, lfoDest: 'pitch', delayTimeAmt: 5, delayMixAmt: 2, glideAmt: 5,
    filterEnvAmt: 0, filterEnvDecay: 1, reverbMixAmt: 6,
  },
  // シンセ寄り
  {
    name: 'シンセリード',
    type: 'sawtooth',
    osc2Type: 'sawtooth', osc2Oct: 0, filterType: 'lowpass',
    env: { attack: 0.005, decay: 0.25, sustain: 0.85, release: 0.3 },
    cutoff: 0.78, res: 4, lfoRate: 5, lfoDepth: 2,
    mixAmt: 5, detuneAmt: 4, noiseAmt: 0, lfoDest: 'pitch', delayTimeAmt: 4, delayMixAmt: 3, glideAmt: 2,
    filterEnvAmt: 4, filterEnvDecay: 2, reverbMixAmt: 4,
  },
  {
    name: 'シンセパッド',
    type: 'triangle',
    osc2Type: 'triangle', osc2Oct: 0, filterType: 'lowpass',
    env: { attack: 0.9, decay: 0.6, sustain: 0.9, release: 1.4 },
    cutoff: 0.55, res: 1, lfoRate: 2, lfoDepth: 2,
    mixAmt: 5, detuneAmt: 6, noiseAmt: 0, lfoDest: 'cutoff', delayTimeAmt: 6, delayMixAmt: 4, glideAmt: 0,
    filterEnvAmt: 0, filterEnvDecay: 1, reverbMixAmt: 8,
  },
  {
    name: 'チップチューン',
    type: 'square',
    osc2Type: 'square', osc2Oct: 0, filterType: 'lowpass',
    env: { attack: 0.001, decay: 0.08, sustain: 0.6, release: 0.05 },
    cutoff: 1.0, res: 0, lfoRate: 3, lfoDepth: 0,
    mixAmt: 0, detuneAmt: 0, noiseAmt: 0, lfoDest: 'pitch', delayTimeAmt: 2, delayMixAmt: 1, glideAmt: 0,
    filterEnvAmt: 0, filterEnvDecay: 1, reverbMixAmt: 1,
  },
  {
    name: 'アシッドベース',
    type: 'sawtooth',
    osc2Type: 'sawtooth', osc2Oct: 0, filterType: 'lowpass',
    env: { attack: 0.002, decay: 0.3, sustain: 0.0, release: 0.15 },
    cutoff: 0.3, res: 8, lfoRate: 3, lfoDepth: 0,
    mixAmt: 0, detuneAmt: 0, noiseAmt: 0, lfoDest: 'pitch', delayTimeAmt: 3, delayMixAmt: 3, glideAmt: 2,
    filterEnvAmt: 10, filterEnvDecay: 2, reverbMixAmt: 2,
  },
]
