import type { Preset } from './presets'

interface Props {
  presets: Preset[]
  onPick: (p: Preset) => void
  onClose: () => void
}

/**
 * PRESET 一覧をホログラム投影風に開くモーダル。
 * タブ行の真上から、ティールの「投影」として広がる。プリセット数が枠に収まる間は
 * スクロールせずに全件表示。多くなったら縦スクロール（右端にスクロールバー用の余白を確保）。
 */
export function PresetModal({ presets, onPick, onClose }: Props) {
  return (
    <div className="preset-modal-layer" onClick={onClose}>
      <div className="preset-modal" onClick={(e) => e.stopPropagation()}>
        <div className="preset-modal-scanlines" aria-hidden />
        <div className="preset-modal-head">
          <span className="preset-modal-title">PRESET</span>
          <button className="preset-modal-close" onClick={onClose} aria-label="閉じる">
            ×
          </button>
        </div>
        <div className="preset-modal-list">
          {presets.map((p) => (
            <button
              key={p.name}
              className="preset-modal-btn"
              onClick={() => {
                onPick(p)
                onClose()
              }}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
