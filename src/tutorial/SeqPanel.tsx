import { useEffect, useRef } from 'react'
import { SEQ_STEPS, SEQ_PITCHES, SEQ_NOTE_LABEL, SEQ_BPM_MIN, SEQ_BPM_MAX, SEQ_SWING_MIN, SEQ_SWING_MAX, SLOT_LABELS, cellKey } from './seqConst'

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
  /** 1 トラックあたりのパターンスロット数（A/B/C/D）。 */
  slotsPerTrack: number
  /** 編集中のトラック index（0 始まり）。 */
  activeTrack: number
  onTrack: (t: number) => void
  /** 各トラックの「いま鳴ってるスロット」。 */
  currentSlot: number[]
  /** 各トラックの「次ループ頭で切り替わる予約スロット」（-1 なら予約なし）。 */
  pendingSlot: number[]
  onSelectSlot: (track: number, slot: number) => void
  /** トラックごとの MUTE 状態。 */
  trackMute: boolean[]
  /** トラックごとの SOLO 状態。 */
  trackSolo: boolean[]
  onToggleMute: (t: number) => void
  onToggleSolo: (t: number) => void
  /** SONG モード：ON の間 songSequence をループ頭ごとに進めて全トラックのスロットを切替。 */
  songMode: boolean
  /** SONG のポジション列（各要素は 0..SLOTS_PER_TRACK-1）。 */
  songSequence: number[]
  /** 現在再生中の SONG ポジション。停止中は 0。 */
  songPosition: number
  onToggleSongMode: () => void
  onCycleSongPosition: (positionIdx: number) => void
  onAddSongPosition: () => void
  onRemoveSongPosition: () => void
  /** アクティブトラック × 編集中スロットのパターン。
   *  on = 点灯セルキー、tied = 「次のステップへ繋ぐ」フラグ付きセルキー。 */
  pattern: { on: Set<string>; tied: Set<string> }
  /** スライドでのタイ塗り：from→to の方向で隣り合うセル間にタイを引く。 */
  onPaintTie: (from: { step: number; midi: number }, to: { step: number; midi: number }) => void
  /** 同上の CUTOFF オートメーション値（0〜1、ステップ毎）。 */
  automation: number[]
  /** アクティブトラックのオートメーション有効フラグ（トラック単位、スロット横断）。 */
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
  slotsPerTrack,
  activeTrack,
  onTrack,
  currentSlot,
  pendingSlot,
  onSelectSlot,
  songMode,
  songSequence,
  songPosition,
  onToggleSongMode,
  onCycleSongPosition,
  onAddSongPosition,
  onRemoveSongPosition,
  trackMute,
  trackSolo,
  onToggleMute,
  onToggleSolo,
  pattern,
  onPaintTie,
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

  // スライドジェスチャ用の状態。
  //   - startCell / startX：開始セルと座標
  //   - inSlide：水平 12px 以上動いたら true（タイ塗りモードに突入）
  //   - lastStep：直近に visit したステップ（同じセルを何度も処理しないため）
  // タップ判定：pointerup 時点で inSlide === false なら toggle。
  // touch-action: pan-y で縦スクロールは browser に任せる → 垂直ドラッグでは pointercancel が来る。
  const slideRef = useRef<{
    startStep: number
    startMidi: number
    startX: number
    startY: number
    inSlide: boolean
    lastStep: number
  } | null>(null)

  const updateSlideFromPoint = (clientX: number, clientY: number) => {
    const s = slideRef.current
    if (!s) return
    if (!s.inSlide) {
      // しきい値判定：水平 12px 以上なら slide モード ON。垂直方向だけの動きでは ON にしない。
      const dx = clientX - s.startX
      const dy = clientY - s.startY
      if (Math.abs(dx) < 12) return
      if (Math.abs(dy) > Math.abs(dx) + 6) return // 垂直優位の動きはスクロール意図とみなして無視
      s.inSlide = true
    }
    // 指の下のセルを特定。setPointerCapture 中でも document.elementFromPoint なら他のセルが取れる。
    const el = document.elementFromPoint(clientX, clientY) as HTMLElement | null
    const cell = el?.closest('.seq-cell') as HTMLElement | null
    if (!cell) return
    const stepStr = cell.dataset.step
    const midiStr = cell.dataset.midi
    if (stepStr === undefined || midiStr === undefined) return
    const step = Number(stepStr)
    const midi = Number(midiStr)
    // 同じ row 限定。違う row に逸れたら無視（戻ってきたら再開）。
    if (midi !== s.startMidi) return
    if (step === s.lastStep) return
    onPaintTie(
      { step: s.lastStep, midi: s.startMidi },
      { step, midi: s.startMidi },
    )
    s.lastStep = step
  }

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

      {/* トラックごとの 1 行：[TRACK N] [M] [S] [A B C D] [プレイヘッド先取り] 。
          - TRACK N：アクティブトラック（PANEL の編集対象）を切替
          - M / S：MUTE（赤）／ SOLO（黄）。MUTE は SEQ のみ、鍵盤は鳴る
          - A B C D：パターンスロット。playing は強調、pending（予約）は点滅
          - クリック動作：停止中=即時切替、再生中=次ループ頭で切替（同じスロットを再タップで予約取消） */}
      <div className="seq-tracks">
        {Array.from({ length: trackCount }).map((_, i) => {
          const anySolo = trackSolo.some((s) => s)
          const silenced = trackMute[i] || (anySolo && !trackSolo[i])
          return (
            <div key={i} className={'seq-track-row' + (silenced ? ' silenced' : '') + (activeTrack === i ? ' active' : '')}>
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
              <div className="seq-slots">
                {Array.from({ length: slotsPerTrack }).map((_, s) => {
                  const isPlaying = currentSlot[i] === s
                  const isPending = pendingSlot[i] === s
                  return (
                    <button
                      key={s}
                      className={'seq-slot-btn'
                        + (isPlaying ? ' playing' : '')
                        + (isPending ? ' pending' : '')
                        + (songMode ? ' song-driven' : '')}
                      onClick={() => onSelectSlot(i, s)}
                      disabled={songMode}
                      aria-pressed={isPlaying}
                      aria-label={`トラック ${i + 1} スロット ${SLOT_LABELS[s]}`}
                    >
                      {SLOT_LABELS[s] ?? s}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* SONG モード行：スロットの並び（position 列）と ⏵ トグルで「曲が自動で進む」体験を作る。
          - ⏵ が ON：再生中、ループ頭ごとに次 position へ進み、その position のスロットを全トラックに適用
          - 各 position をタップで A→B→C→D→A と循環。+/− で長さを変更（1〜16）
          - 再生中は songPosition の cell が強調される。SONG ON 中、トラック行のスロットボタンは無効化 */}
      <div className="seq-song">
        <span className="seq-song-label">SONG</span>
        <button
          className={'seq-song-toggle' + (songMode ? ' on' : '')}
          onClick={onToggleSongMode}
          aria-pressed={songMode}
          aria-label="SONG モード"
          title="SONG モード"
        >
          {songMode ? '⏵' : '○'}
        </button>
        <div className="seq-song-positions">
          {songSequence.map((slot, i) => (
            <button
              key={i}
              className={'seq-song-pos'
                + (songMode && playing && songPosition === i ? ' playing' : '')}
              onClick={() => onCycleSongPosition(i)}
              aria-label={`SONG ポジション ${i + 1}：スロット ${SLOT_LABELS[slot] ?? slot}`}
            >
              {SLOT_LABELS[slot] ?? slot}
            </button>
          ))}
        </div>
        <button className="seq-song-bump" onClick={onAddSongPosition} aria-label="ポジション追加">＋</button>
        <button className="seq-song-bump" onClick={onRemoveSongPosition} aria-label="ポジション削除">−</button>
      </div>

      <div className="seq-grid-wrap" ref={gridScrollRef}>
        <div className="seq-grid">
          {SEQ_PITCHES.map((midi) => (
            <div className="seq-row" key={midi}>
              <span className="seq-row-label">{SEQ_NOTE_LABEL[midi]}</span>
              {Array.from({ length: SEQ_STEPS }).map((_, step) => {
                const key = cellKey(step, midi)
                const on = pattern.on.has(key)
                const inCol = currentStep === step
                // tied 表示は「次セルへの繋ぎ」を持っているかどうか。前セル側の tied フラグも見て tied-prev を描く。
                const tiedNext = on && pattern.tied.has(key) && step < SEQ_STEPS - 1 && pattern.on.has(cellKey(step + 1, midi))
                const tiedPrev = on && step > 0 && pattern.tied.has(cellKey(step - 1, midi)) && pattern.on.has(cellKey(step - 1, midi))
                const cls = 'seq-cell'
                  + (on ? ' on' : '')
                  + (inCol ? ' col-active' : '')
                  + (step > 0 && step % 4 === 0 ? ' bar-start' : '')
                  + (tiedPrev ? ' tied-prev' : '')
                  + (tiedNext ? ' tied-next' : '')
                return (
                  <button
                    key={step}
                    data-step={step}
                    data-midi={midi}
                    className={cls}
                    aria-label={`step ${step + 1} ${SEQ_NOTE_LABEL[midi]}`}
                    onPointerDown={(e) => {
                      // タップ vs スライド判定を始める。pointer capture でセル外に出ても event 来るが、
                      // どのセルかは elementFromPoint で都度判定する。
                      e.currentTarget.setPointerCapture(e.pointerId)
                      slideRef.current = {
                        startStep: step,
                        startMidi: midi,
                        startX: e.clientX,
                        startY: e.clientY,
                        inSlide: false,
                        lastStep: step,
                      }
                    }}
                    onPointerMove={(e) => updateSlideFromPoint(e.clientX, e.clientY)}
                    onPointerUp={(e) => {
                      const s = slideRef.current
                      slideRef.current = null
                      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                        e.currentTarget.releasePointerCapture(e.pointerId)
                      }
                      // スライドが始まっていなければ普通のタップとして toggle。
                      if (s && !s.inSlide && s.startStep === step && s.startMidi === midi) {
                        onToggleCell(step, midi)
                      }
                    }}
                    onPointerCancel={() => {
                      // touch-action: pan-y による垂直スクロール開始など → タイ塗りも tap も取りやめ。
                      slideRef.current = null
                    }}
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
