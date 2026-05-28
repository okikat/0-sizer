// シーケンサーの基本定数とキー作成関数。SeqPanel.tsx は React コンポーネントのみを
// 公開したいので（Fast Refresh）、こちらに切り出してある。

export const SEQ_STEPS = 16

// 1 トラックあたりのパターンスロット数（A〜H）。
// バース／コーラス／ブリッジ等の「セクション」単位で持てるパターン枠。
export const SLOTS_PER_TRACK = 8
export const SLOT_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const

// SONG モード：スロットの並び（position 列）。1 position = 1 ループ分。
// 最低 1 position は必要。最大は UI の見やすさで 16 まで（4 拍 × 16 = 16 小節相当）。
export const SONG_MIN_LENGTH = 1
export const SONG_MAX_LENGTH = 16

// 並びは「上＝高音」のピアノロール慣習。白鍵 2 オクターブ（C3〜B4）。
// 14 行あるので、1 トラックの中に「ベース域（C3〜B3）＋メロディ域（C4〜B4）」を同居させられる。
export const SEQ_PITCHES: number[] = [
  71, 69, 67, 65, 64, 62, 60, // B4 A4 G4 F4 E4 D4 C4 （メロディ域）
  59, 57, 55, 53, 52, 50, 48, // B3 A3 G3 F3 E3 D3 C3 （ベース域）
]

// ラベルには必ずオクターブ番号を付ける（"C" だと上下のどちらの C か分からない）。
export const SEQ_NOTE_LABEL: Record<number, string> = {
  48: 'C3', 50: 'D3', 52: 'E3', 53: 'F3', 55: 'G3', 57: 'A3', 59: 'B3',
  60: 'C4', 62: 'D4', 64: 'E4', 65: 'F4', 67: 'G4', 69: 'A4', 71: 'B4',
}

export const SEQ_BPM_MIN = 40
export const SEQ_BPM_MAX = 240

// スイング：偶数 16 分から奇数 16 分への間隔比を伸ばす量。
// 0%＝ストレート、50%＝3 連符フィール（2:1）、66%＝強めのシャッフル。
export const SEQ_SWING_MIN = 0
export const SEQ_SWING_MAX = 66

/** パターン内のセル識別子：`{ステップ}_{midi}`。 */
export const cellKey = (step: number, midi: number) => `${step}_${midi}`

// トラックごとの識別色。「どのトラックがどの音か」を一目で分けるための色分けに使う。
// CSS の rgba(...) に流し込めるよう RGB の三つ組文字列で持つ（例: rgba(var(--track-rgb), .5)）。
// T1 は既存テーマのティールを継承。以降は彩度をそろえた琥珀・藤・珊瑚。
export const TRACK_RGB: string[] = [
  '90, 209, 196', // T1 ティール
  '232, 192, 106', // T2 琥珀
  '198, 150, 240', // T3 藤
  '240, 145, 127', // T4 珊瑚
]
/** トラック index → CSS で使える色文字列（範囲外は T1 にフォールバック）。 */
export const trackRgb = (i: number): string => TRACK_RGB[i] ?? TRACK_RGB[0]
