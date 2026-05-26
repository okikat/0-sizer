import { SEQ_STEPS, SEQ_PITCHES, SEQ_NOTE_LABEL, SEQ_BPM_MIN, SEQ_BPM_MAX, cellKey } from './seqConst'

// 16 ステップ × 7 白鍵（C4〜B4）の最小シーケンサー。1 トラック・パターンは Set<string>。
// 再生・タイミング・音源との接続は App 側が持つ（このコンポーネントは表示と操作のみ）。

interface Props {
  pattern: Set<string>
  /** 現在再生中のステップ番号。停止中は -1。 */
  currentStep: number
  playing: boolean
  bpm: number
  onToggleCell: (step: number, midi: number) => void
  onClear: () => void
  onTogglePlay: () => void
  onBpm: (b: number) => void
}

export function SeqPanel({
  pattern,
  currentStep,
  playing,
  bpm,
  onToggleCell,
  onClear,
  onTogglePlay,
  onBpm,
}: Props) {
  const bumpBpm = (d: number) => onBpm(Math.max(SEQ_BPM_MIN, Math.min(SEQ_BPM_MAX, bpm + d)))

  return (
    <div className="seq-panel">
      <div className="seq-transport">
        <button
          className={'seq-play' + (playing ? ' on' : '')}
          onClick={onTogglePlay}
          aria-label={playing ? '停止' : '再生'}
        >
          {playing ? '⏹' : '▶'}
        </button>

        <div className="seq-bpm">
          <button className="seq-bpm-bump" onClick={() => bumpBpm(-10)} aria-label="BPM -10">−10</button>
          <button className="seq-bpm-bump" onClick={() => bumpBpm(-1)} aria-label="BPM -1">−</button>
          <div className="seq-bpm-display">
            <span className="seq-bpm-label">♩</span>
            <span className="seq-bpm-value">{bpm}</span>
          </div>
          <button className="seq-bpm-bump" onClick={() => bumpBpm(1)} aria-label="BPM +1">＋</button>
          <button className="seq-bpm-bump" onClick={() => bumpBpm(10)} aria-label="BPM +10">＋10</button>
        </div>

        <button className="seq-clear" onClick={onClear}>クリア</button>
      </div>

      <div className="seq-grid-wrap">
        <div className="seq-grid">
          {SEQ_PITCHES.map((midi) => (
            <div className="seq-row" key={midi}>
              <span className="seq-row-label">{SEQ_NOTE_LABEL[midi]}</span>
              {Array.from({ length: SEQ_STEPS }).map((_, step) => {
                const on = pattern.has(cellKey(step, midi))
                const inCol = currentStep === step
                const cls = 'seq-cell'
                  + (on ? ' on' : '')
                  + (inCol ? ' col-active' : '')
                  + (step > 0 && step % 4 === 0 ? ' bar-start' : '')
                return (
                  <button
                    key={step}
                    className={cls}
                    onClick={() => onToggleCell(step, midi)}
                    aria-label={`step ${step + 1} ${SEQ_NOTE_LABEL[midi]}`}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
