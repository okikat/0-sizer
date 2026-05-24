interface Props {
  title: string
  paragraphs: string[]
  onClose: () => void
}

/** チュートリアルの解説ポップアップ。背景タップ or ボタンで閉じる。 */
export function Popup({ title, paragraphs, onClose }: Props) {
  return (
    <div className="popup-backdrop fade-in" onClick={onClose}>
      <div className="popup pop-in" onClick={(e) => e.stopPropagation()}>
        <h3 className="popup-title">{title}</h3>
        {paragraphs.map((p, i) => (
          <p key={i} className="popup-p">
            {p}
          </p>
        ))}
        <button className="popup-ok" onClick={onClose}>
          わかった
        </button>
      </div>
    </div>
  )
}
