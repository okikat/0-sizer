// シーケンサーの基本定数とキー作成関数。SeqPanel.tsx は React コンポーネントのみを
// 公開したいので（Fast Refresh）、こちらに切り出してある。

export const SEQ_STEPS = 16

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
