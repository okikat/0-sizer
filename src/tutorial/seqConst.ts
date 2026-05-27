// シーケンサーの基本定数とキー作成関数。SeqPanel.tsx は React コンポーネントのみを
// 公開したいので（Fast Refresh）、こちらに切り出してある。

export const SEQ_STEPS = 16

// 並びは「上＝高音」のピアノロール慣習。C4(60) を一番下、B4(71) を一番上。
export const SEQ_PITCHES: number[] = [71, 69, 67, 65, 64, 62, 60]

export const SEQ_NOTE_LABEL: Record<number, string> = {
  60: 'C', 62: 'D', 64: 'E', 65: 'F', 67: 'G', 69: 'A', 71: 'B',
}

export const SEQ_BPM_MIN = 40
export const SEQ_BPM_MAX = 240

// スイング：偶数 16 分から奇数 16 分への間隔比を伸ばす量。
// 0%＝ストレート、50%＝3 連符フィール（2:1）、66%＝強めのシャッフル。
export const SEQ_SWING_MIN = 0
export const SEQ_SWING_MAX = 66

/** パターン内のセル識別子：`{ステップ}_{midi}`。 */
export const cellKey = (step: number, midi: number) => `${step}_${midi}`
