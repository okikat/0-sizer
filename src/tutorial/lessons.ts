// 盤面のフレーム（枠）単位。レッスンはフレームを1つ以上「実体化」させる。
export type FrameId = 'keys' | 'wave' | 'pitch' | 'fine' | 'snap' | 'env' | 'filter'

export const FRAME_TITLE: Record<FrameId, string> = {
  keys: '鍵盤',
  wave: '波形',
  pitch: 'PITCH',
  fine: '微調整',
  snap: 'スナップ',
  env: 'エンベロープ',
  filter: 'フィルター',
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
      'シンセはまず「波形」で音のキャラが決まります。サイン波＝やわらか、三角波＝サイン波とノコギリ波の中間、ノコギリ波＝ジャリッと豊か、矩形（くけい）波＝ピコピコ。',
      'まず波形のボタンを選び、それから下の鍵盤を鳴らしてみて。波形ごとに計器の形と音色が変わります。',
    ],
  },
  {
    id: 'pitch',
    realizes: ['pitch', 'fine', 'snap'],
    stageTitle: '高さ：PITCH と微調整',
    popup: [
      '「PITCH」は全体の音の高さ（チューニング）。上下にドラッグで半音ずつ変わります。ダブルタップで0に戻ります。',
      '「微調整」をONにすると、ゆっくり動いて細かく合わせられます。逆に「スナップ」をONにすると、キリのいい値に「カクッ」と止まりながら動きます（PITCHなら半音ぴったり）。',
      '鍵盤を弾きながらPITCHを動かすと、弾く音の全体がスーッとズレます。',
    ],
  },
  {
    id: 'env',
    realizes: ['env'],
    stageTitle: '時間変化：エンベロープ（A D S R）',
    popup: [
      'エンベロープは「音量の時間変化」。鍵盤を押してから離すまでの、音のふくらみ方を作ります。',
      'A＝立ち上がり（押した直後の伸び）／D＝減衰（ピークから下がる）／S＝持続の音量（押し続けの大きさ）／R＝余韻（離した後の伸び）。',
      '下の鍵盤を「押しっぱなし→離す」で試しながらスライダーを動かすと、グラフと音が一緒に変わります。例：Aを長くすると、フワッと入る音に。',
      'envelope（エンベロープ）＝「包み込む外形」。音の輪郭を描く線、という意味。',
      'A ＝ Attack（アタック／立ち上がり）',
      'D ＝ Decay（ディケイ／減衰）',
      'S ＝ Sustain（サステイン／持続）',
      'R ＝ Release（リリース／余韻）',
    ],
  },
  {
    id: 'filter',
    realizes: ['filter'],
    stageTitle: '明るさ：フィルター',
    popup: [
      'フィルターは音の「明るさ」を決める担当。ドアを閉めて隣の部屋の音を聞くと、高い音だけが消えてこもって聞こえますよね。あれと同じで、高い音を削って、やわらかい・暗い音を作れます。',
      '「CUTOFF」は “どの高さから上を削るか” の境目。下げるほど高い音が削られてこもり、上げるほど明るくクリアになります。鍵盤を押しっぱなしにして回すと、変化がはっきりわかります。',
      '「RES」は、その削る境目あたりの音だけを、逆にグッと持ち上げて強調するツマミ。上げると境目の音が「ミョ〜ン」と口笛のように目立ちます。RES を上げた状態で CUTOFF をゆっくり動かすと、強調された音が一緒に動いて、シンセらしい「ニュイ〜ン」が出ます。',
      'コツ：RES の効果は、波形が「ノコギリ波」や「矩形波」のときにはっきり出ます。サイン波（いちばんやわらかい波）だと倍音が少ないので、ほとんど変化しません。',
      'CUTOFF（カットオフ）＝どの高さから上を削るか、の境目。',
      'RES ＝ Resonance（レゾナンス／共鳴）。削る境目の音をどれだけ強調するか。',
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
      '波形で音のキャラが変わります。サイン波＝やわらか／三角波＝サイン波とノコギリ波の中間／ノコギリ波＝ジャリッと豊か／矩形（くけい）波＝ピコピコ。',
    ],
  },
  pitch: {
    title: 'PITCH',
    paragraphs: ['PITCH は全体の音の高さ（チューニング）。上下にドラッグで半音ずつ、ダブルタップで0に戻ります。'],
  },
  fine: {
    title: '微調整',
    paragraphs: ['ON にすると、ツマミ・スライダーがゆっくり動いて、細かく合わせられます（全コントロールに効きます）。もう一度押すと OFF。'],
  },
  snap: {
    title: 'スナップ',
    paragraphs: ['ON にすると、キリのいい値に「カクッ」と止まりながら動きます（PITCHは半音、RESは1きざみ等）。全コントロールに効きます。もう一度押すと OFF。'],
  },
  env: {
    title: 'エンベロープ',
    paragraphs: [
      '音量の時間変化（A＝立ち上がり／D＝減衰／S＝持続音量／R＝余韻）。鍵盤を押す→離すで形が音になります。',
    ],
  },
  filter: {
    title: 'フィルター',
    paragraphs: [
      '音の明るさを調整します。CUTOFF を下げると “その高さから上” が削られてこもり、上げると明るくクリアに。',
      'RES は、CUTOFF で決めた削る境目の音を強調するツマミ。RES を上げて CUTOFF を動かすと、シンセらしい「ニュイ〜ン」というクセが出ます（ノコギリ波・矩形波だと効果がはっきり）。',
    ],
  },
}

export const ALL_FRAMES: FrameId[] = LESSONS.flatMap((l) => l.realizes)
