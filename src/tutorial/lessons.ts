export type LessonId = 'osc' | 'keys'

export interface Lesson {
  id: LessonId
  /** ゴースト盤面のスロットに出すモジュール名 */
  panelTitle: string
  /** ポップアップ解説の見出し */
  stageTitle: string
  /** ポップアップ本文（要約。長文解説はここに集約する） */
  popup: string[]
}

export const LESSONS: Lesson[] = [
  {
    id: 'osc',
    panelTitle: 'オシレーター',
    stageTitle: '音を作る：波形とPITCH',
    popup: [
      'シンセはまず「波形」で音のキャラを決めます。サイン=やわらか、三角=その中間、ノコギリ=ジャリッと豊か、矩形=ピコピコ。',
      '「PITCH」ツマミは全体の高さ（チューニング）。上下にドラッグで半音ずつ。Shiftで微調整、ダブルクリックで0に戻ります。',
      '「鳴らす」を押すと音が出ます。波形を切り替えながら、計器に出る波のかたちと音の違いを聴き比べてみて。',
    ],
  },
  {
    id: 'keys',
    panelTitle: '鍵盤',
    stageTitle: '弾く：鍵盤',
    popup: [
      '鍵盤は「ドレミ」を弾く担当。押している間だけ音が出ます。',
      'スマホは指でタップ、PCは A S D F G H J K（黒鍵は W E T Y U）でも弾けます。',
      'さっきのPITCHを動かすと、弾く音の全体がズレます。役割分担＝鍵盤で弾く／ツマミで調律。',
    ],
  },
]
