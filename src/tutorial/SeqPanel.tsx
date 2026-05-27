import { SEQ_STEPS, SEQ_PITCHES, SEQ_NOTE_LABEL, SEQ_BPM_MIN, SEQ_BPM_MAX, SEQ_SWING_MIN, SEQ_SWING_MAX, cellKey } from './seqConst'

// 16 ステップ × 7 白鍵（C4〜B4）の最小シーケンサー。1 トラック・パターンは Set<string>。
// 再生・タイミング・音源との接続は App 側が持つ（このコンポーネントは表示と操作のみ）。
//
// タイ：同じ行で隣接セルを連続オンにすると、自動的に「1 つの長い音」として鳴る。
// UI は変えない（連続オン＝タイ）。スイング：トランスポート行に SW% で出す。
// タップテンポ：TAP を 2 回以上叩くと、平均間隔から BPM が決まる。

interface Props {
  pattern: Set<string>
  /** 現在再生中のステップ番号。停止中は -1。 */
  currentStep: number
  playing: boolean
  bpm: number
  swing: number
  onToggleCell: (step: number, midi: number) => void
  onClear: () => void
  onTogglePlay: () => void
  onBpm: (b: number) => void
  onSwing: (s: number) => void
  onTap: () => void
}

export function SeqPanel({
  pattern,
  currentStep,
  playing,
  bpm,
  swing,
  onToggleCell,
  onClear,
  onTogglePlay,
  onBpm,
  onSwing,
  onTap,
}: Props) {
  const bumpBpm = (d: number) => onBpm(Math.max(SEQ_BPM_MIN, Math.min(SEQ_BPM_MAX, bpm + d)))
  const bumpSwing = (d: number) => onSwing(Math.max(SEQ_SWING_MIN, Math.min(SEQ_SWING_MAX, swing + d)))

  return (
    <div className="seq-panel">
      <div className="seq-transport">
        {/* グループ 1：再生・テンポ。BPM 周りと TAP は離れないように 1 クラスタにまとめる。 */}
        <div className="seq-transport-cluster">
          <button
            className={'seq-play' + (playing ? ' on' : '')}
            onClick={onTogglePlay}
            aria-label={playing ? '停止' : '再生'}
          >
            {playing ? '⏹' : '▶'}
          </button>

          <div className="seq-bpm">
            <button className="seq-bump" onClick={() => bumpBpm(-10)} aria-label="BPM -10">−10</button>
            <button className="seq-bump" onClick={() => bumpBpm(-1)} aria-label="BPM -1">−</button>
            <div className="seq-num-display">
              <span className="seq-num-label">♩</span>
              <span className="seq-num-value">{bpm}</span>
            </div>
            <button className="seq-bump" onClick={() => bumpBpm(1)} aria-label="BPM +1">＋</button>
            <button className="seq-bump" onClick={() => bumpBpm(10)} aria-label="BPM +10">＋10</button>
          </div>

          <button className="seq-tap" onClick={onTap} aria-label="タップでテンポ">TAP</button>
        </div>

        {/* グループ 2：スイング・クリア。 */}
        <div className="seq-transport-cluster">
          <div className="seq-swing">
            <button className="seq-bump" onClick={() => bumpSwing(-10)} aria-label="SWING -10">−10</button>
            <button className="seq-bump" onClick={() => bumpSwing(-1)} aria-label="SWING -1">−</button>
            <div className="seq-num-display">
              <span className="seq-num-label">SW</span>
              <span className="seq-num-value">{swing}%</span>
            </div>
            <button className="seq-bump" onClick={() => bumpSwing(1)} aria-label="SWING +1">＋</button>
            <button className="seq-bump" onClick={() => bumpSwing(10)} aria-label="SWING +10">＋10</button>
          </div>
          <button className="seq-clear" onClick={onClear}>クリア</button>
        </div>
      </div>

      <div className="seq-grid-wrap">
        <div className="seq-grid">
          {SEQ_PITCHES.map((midi) => (
            <div className="seq-row" key={midi}>
              <span className="seq-row-label">{SEQ_NOTE_LABEL[midi]}</span>
              {Array.from({ length: SEQ_STEPS }).map((_, step) => {
                const on = pattern.has(cellKey(step, midi))
                const inCol = currentStep === step
                // タイ表示：直前セルがオンなら「前と繋がっている」、直後セルがオンなら「後ろと繋がる」。
                // 連続オン区間の途中・末尾を視覚で区別すると、長い音が直感的に読める。
                const tiedPrev = on && step > 0 && pattern.has(cellKey(step - 1, midi))
                const tiedNext = on && step < SEQ_STEPS - 1 && pattern.has(cellKey(step + 1, midi))
                const cls = 'seq-cell'
                  + (on ? ' on' : '')
                  + (inCol ? ' col-active' : '')
                  + (step > 0 && step % 4 === 0 ? ' bar-start' : '')
                  + (tiedPrev ? ' tied-prev' : '')
                  + (tiedNext ? ' tied-next' : '')
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
