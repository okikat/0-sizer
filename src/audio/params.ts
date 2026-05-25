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
