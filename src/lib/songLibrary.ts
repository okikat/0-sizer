// 名前付きで複数の曲を localStorage に保存・一覧・読込・削除する。
// 1 エントリ = { name, savedAt, project(serialized) }。本体の自動保存（0sizer.*）とは別枠で、
// ユーザーが意図的に「残す」スナップショット群。

import {
  serializeProject,
  deserializeProject,
  type Project,
  type SerializedProject,
} from './project'

export const SONGS_KEY = '0sizer.songs'

export interface SavedSong {
  name: string
  savedAt: number
  project: SerializedProject
}

function readAll(): SavedSong[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(SONGS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (s): s is SavedSong =>
        s && typeof s === 'object' && typeof s.name === 'string' && s.project && typeof s.project === 'object',
    )
  } catch {
    return []
  }
}

function writeAll(songs: SavedSong[]): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(SONGS_KEY, JSON.stringify(songs))
  } catch {
    /* 容量超過などは握りつぶす（呼び出し側で list を再取得すれば実態が分かる） */
  }
}

/** 新しい順（savedAt 降順）に並べて返す。 */
export function listSongs(): SavedSong[] {
  return readAll().sort((a, b) => b.savedAt - a.savedAt)
}

/** 同名があれば上書き。更新後の一覧を返す。 */
export function saveSong(name: string, project: Project): SavedSong[] {
  const trimmed = name.trim() || '無題'
  const songs = readAll().filter((s) => s.name !== trimmed)
  songs.push({ name: trimmed, savedAt: Date.now(), project: serializeProject(project) })
  writeAll(songs)
  return listSongs()
}

/** 名前で読み込み。見つからない／壊れていれば null。 */
export function loadSong(name: string): Project | null {
  const found = readAll().find((s) => s.name === name)
  if (!found) return null
  return deserializeProject(found.project)
}

/** 名前で削除。更新後の一覧を返す。 */
export function deleteSong(name: string): SavedSong[] {
  writeAll(readAll().filter((s) => s.name !== name))
  return listSongs()
}

/** 既定の保存名（「曲 N」で未使用の最小 N）。 */
export function suggestSongName(): string {
  const names = new Set(readAll().map((s) => s.name))
  let n = 1
  while (names.has(`曲 ${n}`)) n++
  return `曲 ${n}`
}
