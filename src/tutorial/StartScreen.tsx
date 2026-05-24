interface Props {
  onStart: () => void
}

/** スタート画面。ロゴ＋「はじめる」。背景にゴースト盤面がうっすら見える。 */
export function StartScreen({ onStart }: Props) {
  return (
    <div className="screen start-screen fade-in">
      <div className="start-inner">
        <div className="brand">
          <span className="tag">0-sizer</span>
        </div>
        <p className="start-sub">手のひらのシンセサイザー</p>
        <button className="cta" onClick={onStart}>
          はじめる
        </button>
      </div>
    </div>
  )
}
