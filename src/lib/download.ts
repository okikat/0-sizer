// ブラウザでファイルを保存させる小ヘルパー。Blob → 一時 URL → アンカークリック。
// iOS Safari ではダウンロードが共有シート／新規タブになることがあるが、保存自体は可能。

export function downloadFile(filename: string, data: BlobPart, mime: string): void {
  const blob = new Blob([data], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // 少し置いてから URL を解放（クリック処理が走り切るまで保持）。
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
