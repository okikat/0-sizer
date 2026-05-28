// 「曲（プロジェクト）」のシリアライズ層。
// SEQ の全データ（パターン／オートメーション／SONG 並び／BPM／スイング／音色）を
// 1 つの JSON 安全なオブジェクトにまとめる。名前付き保存（songLibrary）と
// JSON エクスポート／インポートの両方がこれを共有する。

import {
  SLOTS_PER_TRACK,
  SONG_MIN_LENGTH,
  SONG_MAX_LENGTH,
  SEQ_BPM_MIN,
  SEQ_BPM_MAX,
  SEQ_SWING_MIN,
  SEQ_SWING_MAX,
} from '../tutorial/seqConst'
import {
  TRACK_COUNT,
  DEFAULT_SONG_SEQUENCE,
  defaultTracks,
  defaultAutomations,
  normalizeAutomationArr,
  emptyPattern,
  type TrackSlotPattern,
  type SoundState,
} from './seqStorage'
import type { FilterKind } from '../audio/useSynth'

export const PROJECT_VERSION = 1

/** ランタイムの曲データ。App の state とほぼ 1:1。 */
export interface Project {
  bpm: number
  swing: number
  patterns: TrackSlotPattern[][]
  automations: number[][][]
  automationEnabled: boolean[]
  songSequence: number[]
  songMode: boolean
  tracks: SoundState[]
}

interface SerializedSlot {
  on: string[]
  tied: string[]
  vel: Record<string, number>
}

export interface SerializedProject {
  v: number
  bpm: number
  swing: number
  patterns: SerializedSlot[][]
  automations: number[][][]
  automationEnabled: boolean[]
  songSequence: number[]
  songMode: boolean
  tracks: SoundState[]
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

export function serializeProject(p: Project): SerializedProject {
  return {
    v: PROJECT_VERSION,
    bpm: p.bpm,
    swing: p.swing,
    patterns: p.patterns.map((slots) =>
      slots.map((slot) => ({
        on: Array.from(slot.on),
        tied: Array.from(slot.tied),
        vel: Object.fromEntries(slot.vel),
      })),
    ),
    automations: p.automations.map((slots) => slots.map((arr) => [...arr])),
    automationEnabled: [...p.automationEnabled],
    songSequence: [...p.songSequence],
    songMode: p.songMode,
    tracks: p.tracks.map((s) => ({ ...s, env: { ...s.env } })),
  }
}

/** 1 スロット分の serialized → TrackSlotPattern。壊れていれば空。 */
function parseSlot(raw: unknown): TrackSlotPattern {
  const p = emptyPattern()
  if (!raw || typeof raw !== 'object') return p
  const r = raw as Partial<SerializedSlot>
  const on = new Set(Array.isArray(r.on) ? r.on.filter((k) => typeof k === 'string') : [])
  const tied = new Set(Array.isArray(r.tied) ? r.tied.filter((k) => typeof k === 'string') : [])
  const vel = new Map<string, number>()
  if (r.vel && typeof r.vel === 'object') {
    for (const [k, v] of Object.entries(r.vel)) {
      const n = Number(v)
      if (on.has(k) && (n === 0 || n === 1)) vel.set(k, n)
    }
  }
  return { on, tied, vel }
}

/**
 * 任意の入力（パース済み JSON）を検証して Project に整える。
 * 欠損・型違い・範囲外は安全側のデフォルトで埋める。復元不能なら null。
 */
export function deserializeProject(raw: unknown): Project | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Partial<SerializedProject>

  // パターン：TRACK_COUNT × SLOTS_PER_TRACK に整える。
  const patterns: TrackSlotPattern[][] = Array.from({ length: TRACK_COUNT }, (_, t) =>
    Array.from({ length: SLOTS_PER_TRACK }, (_, s) => {
      const slot = Array.isArray(r.patterns?.[t]) ? r.patterns![t][s] : undefined
      return parseSlot(slot)
    }),
  )

  // オートメーション：TRACK_COUNT × SLOTS_PER_TRACK × SEQ_STEPS。
  const automations: number[][][] = defaultAutomations()
  if (Array.isArray(r.automations)) {
    for (let t = 0; t < TRACK_COUNT; t++) {
      const slots = r.automations[t]
      if (!Array.isArray(slots)) continue
      for (let s = 0; s < SLOTS_PER_TRACK; s++) {
        automations[t][s] = normalizeAutomationArr(slots[s])
      }
    }
  }

  // オートメーション有効フラグ。
  const automationEnabled: boolean[] = Array(TRACK_COUNT).fill(false)
  if (Array.isArray(r.automationEnabled)) {
    for (let t = 0; t < TRACK_COUNT; t++) automationEnabled[t] = Boolean(r.automationEnabled[t])
  }

  // SONG 並び：0..SLOTS_PER_TRACK-1、長さ 1..SONG_MAX_LENGTH。
  let songSequence = [...DEFAULT_SONG_SEQUENCE]
  if (Array.isArray(r.songSequence) && r.songSequence.length > 0) {
    const out = r.songSequence
      .slice(0, SONG_MAX_LENGTH)
      .map((v) => {
        const n = Number(v)
        return Number.isFinite(n) && n >= 0 && n < SLOTS_PER_TRACK ? Math.floor(n) : 0
      })
    if (out.length >= SONG_MIN_LENGTH) songSequence = out
  }

  // 音色：DEFAULT_SOUND をベースに既知フィールドを merge。
  const WAVES: OscillatorType[] = ['sine', 'triangle', 'sawtooth', 'square']
  const FILTERS: FilterKind[] = ['lowpass', 'highpass', 'bandpass']
  const tracks: SoundState[] = defaultTracks().map((def, i) => {
    const t = Array.isArray(r.tracks) ? r.tracks[i] : undefined
    if (!t || typeof t !== 'object') return def
    const src = t as Partial<SoundState>
    const merged: SoundState = {
      ...def,
      ...src,
      env: { ...def.env, ...(src.env ?? {}) },
    }
    // 追加パラメータは型・範囲外を既定へ寄せる（壊れた JSON でも安全に鳴らす）。
    merged.type = WAVES.includes(merged.type) ? merged.type : def.type
    merged.osc2Type = WAVES.includes(merged.osc2Type) ? merged.osc2Type : def.osc2Type
    merged.filterType = FILTERS.includes(merged.filterType) ? merged.filterType : def.filterType
    merged.osc2Oct = Number.isFinite(Number(merged.osc2Oct)) ? clamp(Math.round(Number(merged.osc2Oct)), -2, 2) : def.osc2Oct
    // 裏方 Env パラメータ：つまみ系は 0〜10、ピッチEnv 量は -12〜+12 半音。
    const num = (v: unknown, lo: number, hi: number, d: number) =>
      Number.isFinite(Number(v)) ? clamp(Number(v), lo, hi) : d
    merged.pulseWidth = num(merged.pulseWidth, 0.05, 0.95, def.pulseWidth)
    merged.fenvAttack = num(merged.fenvAttack, 0, 10, def.fenvAttack)
    merged.fenvSustain = num(merged.fenvSustain, 0, 10, def.fenvSustain)
    merged.fenvRelease = num(merged.fenvRelease, 0, 10, def.fenvRelease)
    merged.pitchEnvAmt = num(merged.pitchEnvAmt, -12, 12, def.pitchEnvAmt)
    merged.pitchEnvDecay = num(merged.pitchEnvDecay, 0, 10, def.pitchEnvDecay)
    return merged
  })

  const bpm = Number.isFinite(Number(r.bpm)) ? clamp(Number(r.bpm), SEQ_BPM_MIN, SEQ_BPM_MAX) : 120
  const swing = Number.isFinite(Number(r.swing)) ? clamp(Number(r.swing), SEQ_SWING_MIN, SEQ_SWING_MAX) : 0

  return {
    bpm,
    swing,
    patterns,
    automations,
    automationEnabled,
    songSequence,
    songMode: Boolean(r.songMode),
    tracks,
  }
}

export function projectToJSON(p: Project): string {
  return JSON.stringify(serializeProject(p))
}

export function projectFromJSON(text: string): Project | null {
  try {
    return deserializeProject(JSON.parse(text))
  } catch {
    return null
  }
}

/** 全パターンが空かどうか（保存ボタンの無効化や警告に使える）。 */
export function isProjectEmpty(p: Project): boolean {
  return p.patterns.every((slots) => slots.every((slot) => slot.on.size === 0))
}
