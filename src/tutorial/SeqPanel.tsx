import { useEffect, useRef } from 'react'
import { SEQ_STEPS, SEQ_PITCHES, SEQ_NOTE_LABEL, SEQ_BPM_MIN, SEQ_BPM_MAX, SEQ_SWING_MIN, SEQ_SWING_MAX, cellKey } from './seqConst'

// 16 ステップ × 7 白鍵（C4〜B4）の最小シーケンサー。マルチトラック対応。
// 再生・タイミング・音源との接続は App 側が持つ（このコンポーネントは表示と操作のみ）。
//
// タイ：同じ行で隣接セルを連続オンにすると、自動的に「1 つの長い音」として鳴る。
// UI は変えない（連続オン＝タイ）。スイング：トランスポート行に SW% で出す。
// タップテンポ：TAP を 2 回以上叩くと、平均間隔から BPM が決まる。
// トラック：1 / 2 のセレクタで切替。アクティブトラックのパターンを編集する。

interface Props {
  /** 全トラック数（現状は 2）。 */
  trackCount: number
  /** 編集中のトラック index（0 始まり）。 */
  activeTrack: number
  onTrack: (t: number) => void
  /** トラックごとの MUTE 状態。 */
  trackMute: boolean[]
  /** トラックごとの SOLO 状態。 */
  trackSolo: boolean[]
  onToggleMute: (t: number) => void
  onToggleSolo: (t: number) => void
  /** アクティブトラックのパターン。 */
  pattern: Set<string>
  /** アクティブトラックの CUTOFF オートメーション値（0〜1、ステップ毎）。 */
  automation: number[]
  /** アクティブトラックのオートメーション有効フラグ。 */
  automationEnabled: boolean
  onSetAutomation: (step: number, val: number) => void
  onToggleAutomation: () => void
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
  trackCount,
  activeTrack,
  onTrack,
  trackMute,
  trackSolo,
  onToggleMute,
  onToggleSolo,
  pattern,
  automation,
  automationEnabled,
  onSetAutomation,
  onToggleAutomation,
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

  // グリッドとオートメーションレーンの横スクロールを双方向に同期させる。
  // syncing フラグで「スクロール書き換え→相手の onScroll が発火→自分を書き換え返す」のループを防ぐ。
  const gridScrollRef = useRef<HTMLDivElement>(null)
  const laneScrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const g = gridScrollRef.current
    const l = laneScrollRef.current
    if (!g || !l) return
    let syncing = false
    const onG = () => {
      if (syncing) return
      syncing = true
      l.scrollLeft = g.scrollLeft
      syncing = false
    }
    const onL = () => {
      if (syncing) return
      syncing = true
      g.scrollLeft = l.scrollLeft
      syncing = false
    }
    g.addEventListener('scroll', onG)
    l.addEventListener('scroll', onL)
    return () => {
      g.removeEventListener('scroll', onG)
      l.removeEventListener('scroll', onL)
    }
  }, [])

  return (
    <div className="seq-panel">
      <div className="seq-transport">
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

      {/* トラックセレクタ：押されているトラックがアクティブ（編集対象＆PANEL の音色源）。
          M = MUTE（SEQ で鳴らさない・鍵盤には影響しない）、S = SOLO（ソロ群のみ鳴る）。 */}
      <div className="seq-tracks">
        <span className="seq-tracks-label">TRACK</span>
        {Array.from({ length: trackCount }).map((_, i) => {
          const anySolo = trackSolo.some((s) => s)
          const silenced = trackMute[i] || (anySolo && !trackSolo[i])
          return (
            <div key={i} className={'seq-track-strip' + (silenced ? ' silenced' : '')}>
              <button
                className={'seq-track-btn' + (activeTrack === i ? ' sel' : '')}
                onClick={() => onTrack(i)}
                aria-pressed={activeTrack === i}
                aria-label={`トラック ${i + 1} を編集`}
              >
                {i + 1}
              </button>
              <button
                className={'seq-track-flag seq-track-mute' + (trackMute[i] ? ' on' : '')}
                onClick={() => onToggleMute(i)}
                aria-pressed={trackMute[i]}
                aria-label={`トラック ${i + 1} ミュート`}
                title="MUTE"
              >
                M
              </button>
              <button
                className={'seq-track-flag seq-track-solo' + (trackSolo[i] ? ' on' : '')}
                onClick={() => onToggleSolo(i)}
                aria-pressed={trackSolo[i]}
                aria-label={`トラック ${i + 1} ソロ`}
                title="SOLO"
              >
                S
              </button>
            </div>
          )
        })}
      </div>

      <div className="seq-grid-wrap" ref={gridScrollRef}>
        <div className="seq-grid">
          {SEQ_PITCHES.map((midi) => (
            <div className="seq-row" key={midi}>
              <span className="seq-row-label">{SEQ_NOTE_LABEL[midi]}</span>
              {Array.from({ length: SEQ_STEPS }).map((_, step) => {
                const on = pattern.has(cellKey(step, midi))
                const inCol = currentStep === step
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

      {/* オートメーションレーン：CUTOFF をステップ毎に決め打ち。
          AUTO を ON にしている間、各ステップでフィルターを開閉する → フィルタースイープ。
          各セルは下から上に伸びるバー。タップで値を書く、上下ドラッグで連続調整。 */}
      <div className="seq-automation">
        <div className="seq-automation-head">
          <span className="seq-automation-label">CUTOFF</span>
          <button
            className={'seq-automation-toggle' + (automationEnabled ? ' on' : '')}
            onClick={onToggleAutomation}
            aria-pressed={automationEnabled}
          >
            AUTO
          </button>
        </div>
        <div className="seq-automation-lane-wrap" ref={laneScrollRef}>
          <div className={'seq-automation-lane' + (automationEnabled ? '' : ' disabled')}>
            <span className="seq-row-label" aria-hidden />
          {Array.from({ length: SEQ_STEPS }).map((_, step) => {
            const v = automation[step] ?? 0.5
            const inCol = currentStep === step
            const cls = 'seq-auto-cell'
              + (inCol ? ' col-active' : '')
              + (step > 0 && step % 4 === 0 ? ' bar-start' : '')
            // ポインタダウン／ムーブ：自身のセル内 Y 座標から値を計算して書き戻す。
            // setPointerCapture でセル外に出ても追従。タップでも値が即反映される。
            const updateFromPointer = (e: React.PointerEvent<HTMLDivElement>) => {
              const rect = e.currentTarget.getBoundingClientRect()
              const y = e.clientY - rect.top
              const next = Math.max(0, Math.min(1, 1 - y / rect.height))
              onSetAutomation(step, next)
            }
            return (
              <div
                key={step}
                className={cls}
                role="slider"
                aria-label={`オートメーション step ${step + 1}`}
                aria-valuenow={Math.round(v * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
                onPointerDown={(e) => {
                  e.preventDefault()
                  e.currentTarget.setPointerCapture(e.pointerId)
                  updateFromPointer(e)
                }}
                onPointerMove={(e) => {
                  if (e.buttons === 0) return // ボタン押下中だけ追従
                  updateFromPointer(e)
                }}
                onPointerUp={(e) => {
                  if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                    e.currentTarget.releasePointerCapture(e.pointerId)
                  }
                }}
              >
                <div className="seq-auto-bar" style={{ height: `${v * 100}%` }} />
              </div>
            )
          })}
          </div>
        </div>
      </div>
    </div>
  )
}
