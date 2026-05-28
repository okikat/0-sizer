// localStorage 永続化キーと、それぞれの load／default ヘルパーをまとめた純データ層。
//
// 目的：
//   - App.tsx から「画面表示と無関係な永続化／初期化ロジック」を分離してテスト可能にする
//   - 旧スキーマからの移行ロジックを 1 箇所に集約する
//
// すべての関数は副作用が「localStorage の読み取り」だけ。書き込みは App 側で行う。
// localStorage が無い環境（SSR／テスト）でも安全に動くよう、毎関数で typeof を確認する。

import type { EnvParams, LfoDest } from '../audio/useSynth'
import { SEQ_STEPS, SLOTS_PER_TRACK, SONG_MIN_LENGTH, SONG_MAX_LENGTH } from '../tutorial/seqConst'

// ====== ストレージキー ======
export const DONE_KEY = '0sizer.tutorialDone'
export const SEQ_PATTERNS_KEY = '0sizer.seqPatterns'                // [Track1, Track2]
export const SEQ_PATTERN_LEGACY_KEY = '0sizer.seqPattern'           // v0.1 単トラック時代の救出用
export const SEQ_BPM_KEY = '0sizer.seqBpm'
export const SEQ_SWING_KEY = '0sizer.seqSwing'
export const TRACKS_KEY = '0sizer.tracks'                           // トラック毎の音色（SoundState 配列）
export const ACTIVE_TRACK_KEY = '0sizer.activeTrack'
export const SEQ_AUTOMATIONS_KEY = '0sizer.seqAutomations'          // [トラック][スロット][ステップ] = 0〜1
export const SEQ_AUTOMATION_ENABLED_KEY = '0sizer.seqAutomationEnabled' // [トラック] = boolean
export const SONG_SEQUENCE_KEY = '0sizer.songSequence'              // SONG モードの並び
export const SONG_MODE_KEY = '0sizer.songMode'                      // SONG モード有効か（'1' / null）
export const CUTOFF_LANE_OPEN_KEY = '0sizer.cutoffLaneOpen'         // CUTOFF レーンを表示しているか（既定 ON）
export const KEYBOARD_VISIBLE_KEY = '0sizer.keyboardVisible'        // 鍵盤を表示しているか（既定 ON）
export const SEQ_ZOOM_KEY = '0sizer.seqZoom'                        // SEQ セルのズーム倍率
export const VELOCITY_MODE_KEY = '0sizer.velocityMode'             // ベロシティ編集モード（'1' / null）
export const KEY_LABEL_STYLE_KEY = '0sizer.keyLabelStyle'          // 白鍵ラベル：'solfege'（ドレミ）/ 'note'（音名）

// ====== トラック数（音作りトラック ＝ SEQ トラック）======
export const TRACK_COUNT = 2

// ====== 1 スロット分のパターン ======
/** `on` = 点灯セル、`tied` = 「次のステップへ繋ぐ」フラグ付きセル、
 *  `vel` = セル別ベロシティ段階（0=弱, 1=中）。未登録の ON セルは強(=2)扱い。
 *  tied は on の部分集合という前提（tied セルが off になる場合は tied からも消す）。
 *  vel も on の部分集合（強の時はエントリを持たない＝省メモリ＆移行が自明）。 */
export interface TrackSlotPattern {
  on: Set<string>
  tied: Set<string>
  vel: Map<string, number>
}

// ベロシティ段階 → 音量スケール。0=弱, 1=中, 2=強。
export const VEL_SCALES = [0.42, 0.7, 1.0] as const
/** 強(2)＝エントリなし。中(1)/弱(0)のみ vel に持つ。 */
export const VEL_STRONG = 2

export const emptyPattern = (): TrackSlotPattern => ({ on: new Set(), tied: new Set(), vel: new Map() })

/** 旧 v0.1〜v0.3 形式の Set<string> から「隣接 ON → tied」を導出して新フォーマットへ。
 *  ベロシティ情報は無いので全て強（vel 空）で移行する。 */
export const migrateOldSet = (oldOnArr: string[]): TrackSlotPattern => {
  const on = new Set(oldOnArr)
  const tied = new Set<string>()
  for (const key of on) {
    const idx = key.indexOf('_')
    if (idx < 0) continue
    const step = Number(key.slice(0, idx))
    const midi = key.slice(idx + 1)
    if (Number.isFinite(step) && step < SEQ_STEPS - 1) {
      if (on.has(`${step + 1}_${midi}`)) tied.add(key)
    }
  }
  return { on, tied, vel: new Map() }
}

// ====== 1 トラック分の音色全パラメータ ======
export interface SoundState {
  type: OscillatorType
  env: EnvParams
  cutoff: number     // 0〜1
  res: number        // 0〜10
  lfoRate: number    // 0〜10
  lfoDepth: number   // 0〜10
  lfoDest: LfoDest
  detune: number     // 0〜10
  mix: number        // 0〜10
  noise: number      // 0〜10
  delayTime: number  // 0〜10
  delayMix: number   // 0〜10
  glide: number      // 0〜10
  fenvAmt: number    // 0〜10
  fenvDecay: number  // 0〜10
  reverb: number     // 0〜10
  vol: number        // 0〜10
  pan: number        // -5〜5
}

export const DEFAULT_SOUND: SoundState = {
  type: 'sine',
  env: { attack: 0.01, decay: 0.2, sustain: 0.7, release: 0.3 },
  cutoff: 1,
  res: 0,
  lfoRate: 3,
  lfoDepth: 0,
  lfoDest: 'pitch',
  detune: 0,
  mix: 5,
  noise: 0,
  delayTime: 3,
  delayMix: 0,
  glide: 0,
  fenvAmt: 0,
  fenvDecay: 3,
  reverb: 3,
  vol: 10,
  pan: 0,
}

export const defaultTracks = (): SoundState[] =>
  Array.from({ length: TRACK_COUNT }, () => ({ ...DEFAULT_SOUND, env: { ...DEFAULT_SOUND.env } }))

export const loadTracks = (): SoundState[] => {
  if (typeof localStorage === 'undefined') return defaultTracks()
  try {
    const stored = localStorage.getItem(TRACKS_KEY)
    if (!stored) return defaultTracks()
    const parsed = JSON.parse(stored) as Partial<SoundState>[]
    return defaultTracks().map((def, i) => {
      const p = parsed[i] ?? {}
      return {
        ...def,
        ...p,
        env: { ...def.env, ...(p.env ?? {}) },
      }
    })
  } catch {
    return defaultTracks()
  }
}

export const loadActiveTrack = (): number => {
  if (typeof localStorage === 'undefined') return 0
  const n = Number(localStorage.getItem(ACTIVE_TRACK_KEY))
  if (!Number.isFinite(n) || n < 0 || n >= TRACK_COUNT) return 0
  return n
}

// ====== CUTOFF オートメーション：[トラック][スロット][ステップ] ======
export const defaultAutomationSlot = (): number[] => Array(SEQ_STEPS).fill(0.5)
export const defaultAutomations = (): number[][][] =>
  Array.from({ length: TRACK_COUNT }, () =>
    Array.from({ length: SLOTS_PER_TRACK }, () => defaultAutomationSlot()),
  )

export const normalizeAutomationArr = (raw: unknown): number[] => {
  const arr = Array(SEQ_STEPS).fill(0.5)
  if (Array.isArray(raw)) {
    for (let j = 0; j < Math.min(SEQ_STEPS, raw.length); j++) {
      const v = Number(raw[j])
      arr[j] = Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.5
    }
  }
  return arr
}

/** 旧 2D（[トラック][ステップ]）から 3D（[トラック][スロット][ステップ]）への移行込み。
 *  2D 値は各トラックのスロット 0 に詰める。 */
export const loadAutomations = (): number[][][] => {
  if (typeof localStorage === 'undefined') return defaultAutomations()
  try {
    const stored = localStorage.getItem(SEQ_AUTOMATIONS_KEY)
    if (!stored) return defaultAutomations()
    const parsed = JSON.parse(stored)
    if (!Array.isArray(parsed)) return defaultAutomations()
    const first = parsed[0]
    const isThreeD = Array.isArray(first) && Array.isArray(first[0])
    const out = defaultAutomations()
    if (isThreeD) {
      for (let t = 0; t < Math.min(TRACK_COUNT, parsed.length); t++) {
        const slots = parsed[t] as unknown[]
        if (!Array.isArray(slots)) continue
        for (let s = 0; s < Math.min(SLOTS_PER_TRACK, slots.length); s++) {
          out[t][s] = normalizeAutomationArr(slots[s])
        }
      }
    } else {
      for (let t = 0; t < Math.min(TRACK_COUNT, parsed.length); t++) {
        out[t][0] = normalizeAutomationArr(parsed[t])
      }
    }
    return out
  } catch {
    return defaultAutomations()
  }
}

export const loadAutomationEnabled = (): boolean[] => {
  if (typeof localStorage === 'undefined') return Array(TRACK_COUNT).fill(false)
  try {
    const stored = localStorage.getItem(SEQ_AUTOMATION_ENABLED_KEY)
    if (!stored) return Array(TRACK_COUNT).fill(false)
    const parsed = JSON.parse(stored) as boolean[]
    const out = Array(TRACK_COUNT).fill(false)
    for (let i = 0; i < Math.min(TRACK_COUNT, parsed.length); i++) out[i] = Boolean(parsed[i])
    return out
  } catch {
    return Array(TRACK_COUNT).fill(false)
  }
}

// ====== SONG モード（スロット並び＋有効フラグ）======
export const DEFAULT_SONG_SEQUENCE: number[] = [0, 0, 1, 1] // A A B B（4 position の "曲っぽい" 初期値）

export const loadSongSequence = (): number[] => {
  if (typeof localStorage === 'undefined') return [...DEFAULT_SONG_SEQUENCE]
  try {
    const stored = localStorage.getItem(SONG_SEQUENCE_KEY)
    if (!stored) return [...DEFAULT_SONG_SEQUENCE]
    const parsed = JSON.parse(stored)
    if (!Array.isArray(parsed) || parsed.length === 0) return [...DEFAULT_SONG_SEQUENCE]
    const out = parsed.slice(0, SONG_MAX_LENGTH).map((v) => {
      const n = Number(v)
      return Number.isFinite(n) && n >= 0 && n < SLOTS_PER_TRACK ? Math.floor(n) : 0
    })
    if (out.length < SONG_MIN_LENGTH) return [...DEFAULT_SONG_SEQUENCE]
    return out
  } catch {
    return [...DEFAULT_SONG_SEQUENCE]
  }
}

export const loadSongMode = (): boolean => {
  if (typeof localStorage === 'undefined') return false
  return localStorage.getItem(SONG_MODE_KEY) === '1'
}

export const loadVelocityMode = (): boolean => {
  if (typeof localStorage === 'undefined') return false
  return localStorage.getItem(VELOCITY_MODE_KEY) === '1'
}

// 白鍵ラベルの表記。'solfege'＝ドレミ（初心者向け既定）/ 'note'＝音名（C4 等）。
export type KeyLabelStyle = 'solfege' | 'note'
export const loadKeyLabelStyle = (): KeyLabelStyle => {
  if (typeof localStorage === 'undefined') return 'solfege'
  return localStorage.getItem(KEY_LABEL_STYLE_KEY) === 'note' ? 'note' : 'solfege'
}
