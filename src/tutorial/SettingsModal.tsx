import type { KeyLabelStyle } from '../lib/seqStorage'

interface Props {
  keyLabelStyle: KeyLabelStyle
  onChangeKeyLabelStyle: (s: KeyLabelStyle) => void
  onClose: () => void
}

/**
 * 設定モーダル。PRESET / SONG と同じホログラム投影風の枠を流用。
 * いまは「白鍵ラベルの表記（階名／音名）」のみ。今後の設定もここに足す。
 */
export function SettingsModal({ keyLabelStyle, onChangeKeyLabelStyle, onClose }: Props) {
  return (
    <div className="preset-modal-layer" onClick={onClose}>
      <div className="preset-modal song-modal" onClick={(e) => e.stopPropagation()}>
        <div className="preset-modal-scanlines" aria-hidden />
        <div className="preset-modal-head">
          <span className="preset-modal-title">設定</span>
          <button className="preset-modal-close" onClick={onClose} aria-label="閉じる">
            ×
          </button>
        </div>

        <div className="song-modal-section">
          <div className="song-modal-label">鍵盤の文字（解説表示 ON のとき）</div>
          <div className="settings-segmented">
            <button
              className={'settings-seg' + (keyLabelStyle === 'solfege' ? ' sel' : '')}
              onClick={() => onChangeKeyLabelStyle('solfege')}
              aria-pressed={keyLabelStyle === 'solfege'}
            >
              階名（ドレミ）
            </button>
            <button
              className={'settings-seg' + (keyLabelStyle === 'note' ? ' sel' : '')}
              onClick={() => onChangeKeyLabelStyle('note')}
              aria-pressed={keyLabelStyle === 'note'}
            >
              音名（CDE）
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
