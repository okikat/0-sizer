// 盤面のフレーム（枠）単位。レッスンはフレームを1つ以上「実体化」させる。
export type FrameId = 'keys' | 'wave' | 'pitch' | 'fine'

export const FRAME_TITLE: Record<FrameId, string> = {
  keys: '鍵盤',
  wave: '波形',
  pitch: 'PITCH',
  fine: '微調整',
}

export interface Lesson {
  /** 点滅＆収納(FLIP)の対象になる主フレーム */
  id: FrameId
  /** このレッスンで盤面に現れるフレーム群 */
  realizes: FrameId[]
  stageTitle: string
  popup: string[]
}

export const LESSONS: Lesson[] = [
  {
    id: 'keys',
    realizes: ['keys'],
    stageTitle: '弾く：鍵盤',
    popup: [
      '鍵盤は「ドレミ」を弾く担当。押している間だけ音が出ます。',
      'スマホは指でタップ。PCは A S D F G H J K（黒鍵は W E T Y U）でも弾けます。',
      'まずはいろいろ押して、音が出るのを確かめてみて。',
    ],
  },
  {
    id: 'wave',
    realizes: ['wave'],
    stageTitle: '音のキャラ：波形',
    popup: [
      'シンセはまず「波形」で音のキャラが決まります。サイン＝やわらか、三角＝その中間、ノコギリ＝ジャリッと豊か、矩形（くけい）＝ピコピコ。',
      '下の鍵盤を鳴らしながら波形を切り替えると、計器の形と音色の違いが分かります。',
    ],
  },
  {
    id: 'pitch',
    realizes: ['pitch', 'fine'],
    stageTitle: '高さ：PITCH と微調整',
    popup: [
      '「PITCH」は全体の高さ（チューニング）。上下にドラッグで半音ずつ変わります。ダブルタップで0に戻ります。',
      '「微調整」をONにすると、ゆっくり動いて細かく合わせられます。',
      '鍵盤を弾きながらPITCHを動かすと、弾く音の全体がスーッとズレます。',
    ],
  },
]

/** フレームを教えたレッスン（解説の再表示用）。 */
export function lessonForFrame(frame: FrameId): Lesson {
  return LESSONS.find((l) => l.realizes.includes(frame))!
}

/** 盤面の「?」用：フレームごとの単独ヘルプ（その枠の話だけ）。 */
export const FRAME_HELP: Record<FrameId, { title: string; paragraphs: string[] }> = {
  keys: {
    title: '鍵盤',
    paragraphs: [
      '鍵盤は「ドレミ」を弾く担当。押している間だけ音が出ます。',
      'スマホは指でタップ、PCは A S D F G H J K（黒鍵は W E T Y U）。',
    ],
  },
  wave: {
    title: '波形',
    paragraphs: [
      '波形で音のキャラが変わります。サイン＝やわらか／三角＝中間／ノコギリ＝ジャリッと豊か／矩形（くけい）＝ピコピコ。',
    ],
  },
  pitch: {
    title: 'PITCH',
    paragraphs: ['PITCH は全体の高さ（チューニング）。上下にドラッグで半音ずつ、ダブルタップで0に戻ります。'],
  },
  fine: {
    title: '微調整',
    paragraphs: ['ON にすると、ツマミがゆっくり動いて細かく合わせられます（全てのツマミに効きます）。もう一度押すと OFF。'],
  },
}

export const ALL_FRAMES: FrameId[] = LESSONS.flatMap((l) => l.realizes)
