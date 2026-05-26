// ツマミの「つまみ量(amt)」と実パラメータ／表示の変換。modules と App で共有する。

export const fmtTime = (v: number) => (v < 1 ? `${Math.round(v * 1000)} ms` : `${v.toFixed(2)} s`)
export const fmtPct = (v: number) => `${Math.round(v * 100)} %`

// カットオフは「つまみ 0〜1」を低音域寄りの対数カーブで 80Hz〜16kHz に対応させる。
const F_MIN = 80
const F_MAX = 16000
export const cutoffNormToHz = (n: number) => F_MIN * Math.pow(F_MAX / F_MIN, n)
export const fmtHz = (hz: number) => (hz >= 1000 ? `${(hz / 1000).toFixed(1)}k` : `${Math.round(hz)}`)

// RES は「つまみ 0〜10」を Q 0.7（クセ無し）〜16（強め）に対応させる。
export const resAmtToQ = (amt: number) => 0.7 + (amt / 10) * (16 - 0.7)

// LFO RATE は「つまみ 0〜10」を 0.3〜12Hz に。DEPTH は「0〜10」を 0〜200セント(=2半音)に。
export const lfoRateToHz = (amt: number) => 0.3 + (amt / 10) * (12 - 0.3)
export const lfoDepthToCents = (amt: number) => (amt / 10) * 200

// MIX VOL は「つまみ 0〜10」をマスター音量 0〜1 に。PAN は「-5〜5」を 定位 -1〜1 に。
export const volAmtToGain = (amt: number) => amt / 10
export const panAmtToPos = (amt: number) => amt / 5
export const fmtPan = (amt: number) => (amt === 0 ? 'C' : amt < 0 ? `L${Math.abs(Math.round(amt))}` : `R${Math.round(amt)}`)

// NOISE LEVEL は「つまみ 0〜10」を 0〜0.5 のゲインに（オシ2本と釣り合う上限）。
export const noiseAmtToLevel = (amt: number) => (amt / 10) * 0.5

// DELAY TIME は「つまみ 0〜10」を 50〜1000ms（線形）。
export const delayTimeAmtToSec = (amt: number) => 0.05 + (amt / 10) * 0.95
export const fmtDelayMs = (sec: number) => `${Math.round(sec * 1000)}`
// DELAY MIX は「つまみ 0〜10」を 0〜0.5 の送り量に。
export const delayMixAmtToLevel = (amt: number) => (amt / 10) * 0.5

// GLIDE TIME は「つまみ 0〜10」を 5〜505ms（時定数 tau）。0で即時、大きいほどゆっくり滑る。
export const glideAmtToTau = (amt: number) => 0.005 + (amt / 10) * 0.5

// FILTER ENV AMOUNT は「つまみ 0〜10」を 0〜3 オクターブの持ち上げに。
export const fenvAmtToOctaves = (amt: number) => (amt / 10) * 3
// FILTER ENV DECAY は「つまみ 0〜10」を 50ms〜1.5s に。
export const fenvDecayAmtToSec = (amt: number) => 0.05 + (amt / 10) * 1.45

// OSC2 DETUNE は「つまみ 0〜10」を 0〜50 セントに（広めの厚み）。
export const detuneAmtToCents = (amt: number) => amt * 5
// OSC2 MIX は「つまみ 0〜10」を 0〜1 のバランス（0=OSC1のみ, 10=OSC2のみ, 5=半々）。
export const mixAmtToBalance = (amt: number) => amt / 10
export const fmtMix = (amt: number) => {
  const a = Math.round(amt)
  if (a === 5) return 'M' // middle
  if (a < 5) return `1:${5 - a}` // OSC1 dominant
  return `${a - 5}:2` // OSC2 dominant
}
