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

/** パターン内のセル識別子：`{ステップ}_{midi}`。 */
export const cellKey = (step: number, midi: number) => `${step}_${midi}`
