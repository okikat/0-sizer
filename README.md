# 0-sizer

シンセサイザーを「0 から」学べる初心者向け Web アプリ。
1レッスンごとに部品（ツマミ・計器・鍵盤）が1つずつ増え、終わる頃には自分で組み立てたシンセで演奏できる、を目指す。

## 開発

```bash
npm install
npm run dev      # 開発サーバー
npm run build    # tsc -b && vite build
npm test         # Vitest
npm run lint     # ESLint
```

## デプロイ（GitHub Pages）

- `.github/workflows/deploy.yml` が main への push で自動デプロイ。
- リポジトリ Settings → Pages → Source = **GitHub Actions** を一度だけ設定。
- 公開 URL：`https://<user>.github.io/0-sizer/`
- リポジトリ名を `0-sizer` 以外にする場合は `vite.config.ts` の `base` を `'/<repo>/'` に合わせる。

## 構成

- `src/lib/notes.ts` — MIDI↔周波数・音名（純関数・テスト対象）
- `src/audio/useSynth.ts` — Web Audio エンジン（モノフォニック）
- `src/components/Knob.tsx` — 汎用ロータリーノブ
- `src/components/Keyboard.tsx` — 1オクターブ鍵盤（タッチ/マウス/PCキー）
- `src/components/Scope.tsx` — 波形ビュー（計器）
- `src/components/WaveformPicker.tsx` — 波形セレクタ
