// SEQ（打ち込み画面）の操作ヘルプ。隠れジェスチャ（長押しでタイ、長押しで
// パターンコピー等）は初見では分からないので、「?」からいつでも引けるようにする。
// PRESET / SONG と同じホログラム投影風の枠を流用。
// 文面は音楽用語をやさしく噛み砕く方針（アプリ内で教える）。

interface Props {
  onClose: () => void
}

interface HelpItem {
  op: string
  desc: string
}

interface HelpGroup {
  title: string
  items: HelpItem[]
}

const GROUPS: HelpGroup[] = [
  {
    title: 'マス目（打ち込み）',
    items: [
      { op: 'マスをタップ', desc: '音を置く／消す。上ほど高い音、横は時間（左から右へ進む）。' },
      { op: '「強弱」ボタン ON 中にタップ', desc: '同じマスを押すたび 強 → 中 → 弱 → 無 と変わる。強い音ほど明るく光る。' },
      { op: 'マスを長押し → 横にスライド', desc: '音を伸ばして隣とつなげる（タイ）。始点から左右どちらにも引ける。行きすぎたら戻すと、その分だけ消える。' },
    ],
  },
  {
    title: 'スロット（A B C D）',
    items: [
      { op: 'A〜D をタップ', desc: '編集するパターンを切り替え。1 曲の中で「Aメロ・サビ」のように使い分けられる。' },
      { op: 'A〜D を長押し → 別のスロットをタップ', desc: 'パターンを丸ごとコピー（音・タイ・強弱・CUTOFF も一緒に）。「B を A の複製から作る」のに便利。' },
    ],
  },
  {
    title: 'SONG（曲の流れ）',
    items: [
      { op: '○ / ⏵ ボタン', desc: 'ON にすると、並べたスロットを上から順に自動で再生して 1 曲に。' },
      { op: '並びの各マスをタップ', desc: 'A → B → C → D と循環して、どのパターンを鳴らすか決める。' },
      { op: '＋ / −', desc: '並びの長さ（小節数）を増やす／減らす。' },
    ],
  },
  {
    title: 'CUTOFF（音の明るさの自動変化）',
    items: [
      { op: 'AUTO ボタン', desc: 'ON にすると、各ステップで音の明るさ（フィルター）を動かせる。下のバーを上下にドラッグして描く。' },
      { op: '▲ / ▼', desc: 'CUTOFF レーンの折りたたみ。' },
      { op: '虫めがね − / ○ / ＋', desc: 'マス目の表示を縮小／原寸／拡大。狙いやすい大きさに。' },
      { op: '↶ / ↷', desc: '元に戻す／やり直す。' },
    ],
  },
  {
    title: '再生まわり',
    items: [
      { op: '▶ / ■', desc: '再生／停止。' },
      { op: '♩ の − / ＋', desc: 'テンポ（速さ）。TAP を数回叩くとそのリズムで速さが決まる。' },
      { op: 'SW（スイング）', desc: '裏拍を少し遅らせて「ハネた」ノリにする。0% で真っ直ぐ。' },
      { op: 'M（ミュート） / S（ソロ）', desc: 'M=そのトラックを消音。S=ソロにしたトラックだけが鳴る（他は黙る）。複数のトラックを同時にソロにもできる。' },
    ],
  },
]

export function SeqHelpModal({ onClose }: Props) {
  return (
    <div className="preset-modal-layer" onClick={onClose}>
      <div className="preset-modal song-modal seqhelp-modal" onClick={(e) => e.stopPropagation()}>
        <div className="preset-modal-scanlines" aria-hidden />
        <div className="preset-modal-head">
          <span className="preset-modal-title">SEQ ヘルプ</span>
          <button className="preset-modal-close" onClick={onClose} aria-label="閉じる">
            ×
          </button>
        </div>
        <div className="seqhelp-body">
          {GROUPS.map((g) => (
            <div className="seqhelp-group" key={g.title}>
              <div className="seqhelp-grouptitle">{g.title}</div>
              {g.items.map((it) => (
                <div className="seqhelp-item" key={it.op}>
                  <div className="seqhelp-op">{it.op}</div>
                  <div className="seqhelp-desc">{it.desc}</div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
