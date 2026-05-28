import { useRef, useState } from 'react'
import type { SavedSong } from '../lib/songLibrary'

interface Props {
  songs: SavedSong[]
  defaultName: string
  onSave: (name: string) => void
  onLoad: (name: string) => void
  onDelete: (name: string) => void
  onExportMidi: () => void
  onExportJson: () => void
  onImportJson: (file: File) => void
  onClose: () => void
}

/** 日時を「MM/DD HH:mm」で軽く表示。 */
function fmtTime(ms: number): string {
  const d = new Date(ms)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/**
 * 「ソング」モーダル。PRESET と同じホログラム投影風の枠を流用。
 * 上：現在の曲に名前を付けて保存。中：保存済み一覧（開く／削除）。下：書き出し／読み込み。
 */
export function SongModal({
  songs,
  defaultName,
  onSave,
  onLoad,
  onDelete,
  onExportMidi,
  onExportJson,
  onImportJson,
  onClose,
}: Props) {
  const [name, setName] = useState(defaultName)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  return (
    <div className="preset-modal-layer" onClick={onClose}>
      <div className="preset-modal song-modal" onClick={(e) => e.stopPropagation()}>
        <div className="preset-modal-scanlines" aria-hidden />
        <div className="preset-modal-head">
          <span className="preset-modal-title">SONG</span>
          <button className="preset-modal-close" onClick={onClose} aria-label="閉じる">
            ×
          </button>
        </div>

        {/* 保存 */}
        <div className="song-modal-section">
          <div className="song-modal-label">この曲を保存</div>
          <div className="song-modal-saverow">
            <input
              className="song-modal-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="曲名"
              maxLength={40}
            />
            <button className="song-modal-act" onClick={() => onSave(name)}>
              保存
            </button>
          </div>
        </div>

        {/* 一覧 */}
        <div className="song-modal-section">
          <div className="song-modal-label">保存した曲</div>
          {songs.length === 0 ? (
            <div className="song-modal-empty">まだ保存された曲はありません</div>
          ) : (
            <div className="song-modal-list">
              {songs.map((s) => (
                <div className="song-modal-row" key={s.name}>
                  <button className="song-modal-open" onClick={() => onLoad(s.name)} title="この曲を開く">
                    <span className="song-modal-name">{s.name}</span>
                    <span className="song-modal-date">{fmtTime(s.savedAt)}</span>
                  </button>
                  {confirmDelete === s.name ? (
                    <button
                      className="song-modal-del confirm"
                      onClick={() => {
                        onDelete(s.name)
                        setConfirmDelete(null)
                      }}
                    >
                      消す？
                    </button>
                  ) : (
                    <button className="song-modal-del" onClick={() => setConfirmDelete(s.name)} aria-label="削除">
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 書き出し／読み込み */}
        <div className="song-modal-section">
          <div className="song-modal-label">書き出し／読み込み</div>
          <div className="song-modal-exprow">
            <button className="song-modal-act" onClick={onExportMidi}>
              MIDI
            </button>
            <button className="song-modal-act" onClick={onExportJson}>
              JSON 保存
            </button>
            <button className="song-modal-act" onClick={() => fileRef.current?.click()}>
              JSON 読込
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) onImportJson(f)
                e.target.value = '' // 同じファイルを連続選択できるようリセット
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
