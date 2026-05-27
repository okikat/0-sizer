import { useCallback, useEffect, useRef, useState } from 'react'
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
  /** タイ描画中の "戻り消し"：1 セルを off にして、前後の tied フラグも整理する。 */
  onEraseSeqCell: (step: number, midi: number) => void
  /** 同上の CUTOFF オートメーション値（0〜1、ステップ毎）。 */
  automation: number[]
  /** アクティブトラックのオートメーション有効フラグ（トラック単位、スロット横断）。 */
  automationEnabled: boolean
  onSetAutomation: (step: number, val: number) => void
  onToggleAutomation: () => void
  /** CUTOFF レーンの表示折り畳み。閉じている間はバー部分が消えて head 行だけ残る。 */
  cutoffLaneOpen: boolean
  onToggleCutoffLane: () => void
  /** Undo / Redo。canUndo/canRedo はボタンの活性制御。 */
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  /** ユーザー編集ジェスチャの「開始」を 1 度だけ通知（スライド初回、オートメーションドラッグ初回）。
   *  App は履歴スナップショットを 1 つ push する。 */
  onEditStart: () => void
  /** セルズーム倍率（0.6〜2.0）。2 指ピンチで App 側で更新する。 */
  zoom: number
  onZoomChange: (z: number) => void
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
  onEraseSeqCell,
  automation,
  automationEnabled,
  onSetAutomation,
  onToggleAutomation,
  cutoffLaneOpen,
  onToggleCutoffLane,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onEditStart,
  zoom,
  onZoomChange,
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

  // セル操作の 3 モード：
  //   pending：指が落ちた直後。タイマー満了 or 移動 ≥8px のどちらかで遷移
  //   pan：    移動 ≥8px が先に来た → 自前で scrollLeft/scrollTop を更新（横スクロール確保）
  //   tie：    タイマー（250ms）が先に切れた → 開始 row 全体がティール発光、左右スライドでタイ塗り
  //
  // 短押し（タイマー前に離した）＝ ON/OFF トグル。
  // pan モードは setPointerCapture して browser のスクロール判定に依存しない（iOS Safari 対策）。
  // tie モード中の elementFromPoint は y を「開始 row の中央」に固定し、指の上下ブレで途切れないようにする。
  type SlideMode = 'pending' | 'pan' | 'tie'
  const slideRef = useRef<{
    el: HTMLButtonElement
    pointerId: number
    startStep: number
    startMidi: number
    startX: number
    startY: number
    mode: SlideMode
    // pan モード用
    startScrollLeft: number
    startScrollTop: number
    // tie モード用
    rowCenterY: number
    painted: boolean
    lastStep: number
    /** タイ突入時点で「すでに ON だったセルキー」のスナップショット。
     *  paintedSteps の判定（このジェスチャで足したのか、最初から ON だったのか）に使う。 */
    initialOn: Set<string>
    /** このジェスチャで「OFF→ON にした」step の集合。戻り消しの対象はこれだけ。 */
    paintedSteps: Set<number>
  } | null>(null)
  const longPressTimerRef = useRef<number | null>(null)
  // 行全体を光らせるため、セルキーではなく開始 row の midi だけ保持する。
  const [tieActiveMidi, setTieActiveMidi] = useState<number | null>(null)

  const LONG_PRESS_MS = 250
  const MOVE_CANCEL_PX = 8

  const cancelLongPressTimer = () => {
    if (longPressTimerRef.current != null) {
      window.clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }

  const handleCellPointerDown = (step: number, midi: number, e: React.PointerEvent<HTMLButtonElement>) => {
    const el = e.currentTarget
    slideRef.current = {
      el,
      pointerId: e.pointerId,
      startStep: step,
      startMidi: midi,
      startX: e.clientX,
      startY: e.clientY,
      mode: 'pending',
      startScrollLeft: cellsAreaRef.current?.scrollLeft ?? 0,
      startScrollTop: gridScrollRef.current?.scrollTop ?? 0,
      rowCenterY: 0,
      painted: false,
      lastStep: step,
      initialOn: new Set(pattern.on),
      paintedSteps: new Set(),
    }
    cancelLongPressTimer()
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTimerRef.current = null
      const s = slideRef.current
      if (!s || s.mode !== 'pending') return
      s.mode = 'tie'
      const rect = s.el.getBoundingClientRect()
      s.rowCenterY = rect.top + rect.height / 2
      try { s.el.setPointerCapture(s.pointerId) } catch { /* noop */ }
      setTieActiveMidi(s.startMidi)
    }, LONG_PRESS_MS)
  }

  const handleCellPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const s = slideRef.current
    if (!s) return

    if (s.mode === 'pending') {
      const dx = e.clientX - s.startX
      const dy = e.clientY - s.startY
      if (Math.hypot(dx, dy) > MOVE_CANCEL_PX) {
        cancelLongPressTimer()
        s.mode = 'pan'
        // ここでキャプチャ：iOS Safari がボタン上の touch を内側スクローラに渡してくれない問題を回避。
        try { s.el.setPointerCapture(s.pointerId) } catch { /* noop */ }
      }
    }

    if (s.mode === 'pan') {
      const dx = e.clientX - s.startX
      const dy = e.clientY - s.startY
      const ca = cellsAreaRef.current
      const gs = gridScrollRef.current
      if (ca) ca.scrollLeft = s.startScrollLeft - dx
      if (gs) gs.scrollTop = s.startScrollTop - dy
      return
    }

    if (s.mode === 'tie') {
      // Y を開始 row の中央に固定 → 指が上下に多少ブレてもセルを引ける。
      const el = document.elementFromPoint(e.clientX, s.rowCenterY) as HTMLElement | null
      const cell = el?.closest('.seq-cell') as HTMLElement | null
      if (!cell) return
      const stepStr = cell.dataset.step
      const midiStr = cell.dataset.midi
      if (stepStr === undefined || midiStr === undefined) return
      const step = Number(stepStr)
      const midi = Number(midiStr)
      if (midi !== s.startMidi) return

      // 開始セルより手前は何もしない（戻りすぎ無視）。
      const clampedStep = Math.max(step, s.startStep)
      if (clampedStep === s.lastStep) return

      if (clampedStep > s.lastStep) {
        // 前進：lastStep+1 から clampedStep まで 1 つずつタイで結ぶ。
        // ここで初めて履歴 push（前進が「実際に塗りが発生する」唯一の経路）。
        if (!s.painted) {
          onEditStart()
          s.painted = true
        }
        for (let st = s.lastStep + 1; st <= clampedStep; st++) {
          onPaintTie(
            { step: st - 1, midi: s.startMidi },
            { step: st, midi: s.startMidi },
          )
          // 「もともと OFF だった」セルだけ paintedSteps に積む。
          // 元から ON だったセルや、開始セル（手前は erase しない）は触らない。
          const k = cellKey(st, s.startMidi)
          if (!s.initialOn.has(k)) s.paintedSteps.add(st)
        }
      } else {
        // 後退：lastStep から clampedStep+1 までを順に erase。
        // ただし「このジェスチャで塗った」step だけ消す（initial ON は残す）。
        for (let st = s.lastStep; st > clampedStep; st--) {
          if (s.paintedSteps.has(st)) {
            onEraseSeqCell(st, s.startMidi)
            s.paintedSteps.delete(st)
          }
        }
      }
      s.lastStep = clampedStep
    }
  }

  const handleCellPointerUp = (_step: number, _midi: number, e: React.PointerEvent<HTMLButtonElement>) => {
    cancelLongPressTimer()
    const s = slideRef.current
    slideRef.current = null
    setTieActiveMidi(null)
    if (!s) return
    if (s.el.hasPointerCapture(e.pointerId)) {
      try { s.el.releasePointerCapture(e.pointerId) } catch { /* noop */ }
    }
    if (s.mode === 'pending') {
      onToggleCell(s.startStep, s.startMidi)
    }
    // pan / tie：終わり。tie で painted=false なら何も起きない（履歴も増えない）。
  }

  const handleCellPointerCancel = () => {
    cancelLongPressTimer()
    slideRef.current = null
    setTieActiveMidi(null)
  }

  // ▲ / ▼ ボタン：1 タップで「クライアント高さの半分」だけ縦スクロール。スライド誤爆の代替手段。
  const scrollGridBy = (dir: 1 | -1) => {
    const g = gridScrollRef.current
    if (!g) return
    g.scrollBy({ top: dir * (g.clientHeight * 0.5), behavior: 'smooth' })
  }

  // 虫眼鏡 3 ボタン：×1.15 / リセット / ÷1.15。下限 0.6、上限 2.0 でクランプ。
  const zoomIn = () => onZoomChange(Math.min(2.0, zoom * 1.15))
  const zoomOut = () => onZoomChange(Math.max(0.6, zoom / 1.15))
  const zoomReset = () => onZoomChange(1.0)

  // 横スクロールバー（kbd-bar 風）。cellsAreaRef の scrollLeft / scrollWidth から
  // ウィンドウ位置・幅を計算してティールのつまみで可視化。タップ／ドラッグで scrollLeft 制御。
  const hscrollBarRef = useRef<HTMLDivElement>(null)
  const hscrollDraggingRef = useRef(false)
  const [hScroll, setHScroll] = useState({ left: 0, width: 1 })

  const syncHScroll = useCallback(() => {
    const el = cellsAreaRef.current
    if (!el) return
    const sw = el.scrollWidth || 1
    setHScroll({
      left: el.scrollLeft / sw,
      width: Math.min(1, el.clientWidth / sw),
    })
  }, [])

  useEffect(() => {
    const el = cellsAreaRef.current
    if (!el) return
    syncHScroll()
    el.addEventListener('scroll', syncHScroll)
    const ro = new ResizeObserver(syncHScroll)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', syncHScroll)
      ro.disconnect()
    }
  }, [syncHScroll])

  // バー本体のタップ／ドラッグで scrollLeft を直接コントロール。
  // ポインタ位置をバー幅の比率 → scrollWidth に変換し、ウィンドウの中心がそこへ来るように当てる。
  const updateHScrollFromPointer = (clientX: number) => {
    const bar = hscrollBarRef.current
    const el = cellsAreaRef.current
    if (!bar || !el) return
    const rect = bar.getBoundingClientRect()
    const frac = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    el.scrollTo({ left: frac * el.scrollWidth - el.clientWidth / 2, behavior: 'auto' })
  }

  // gridScrollRef は縦スクロールの "stage"（外側）。横スクロールは cellsAreaRef（後段で宣言）。
  const gridScrollRef = useRef<HTMLDivElement>(null)
  const laneScrollRef = useRef<HTMLDivElement>(null)
  // cellsAreaRef を先に宣言（下のスクロールバー用ロジックと共有）。
  const cellsAreaRef = useRef<HTMLDivElement>(null)
  // セルの横スクロールとオートメーションレーンの横スクロールを双方向に同期させる。
  // syncing フラグで「片方書き換え→相手の onScroll → 自分を書き換え返す」ループ防止。
  useEffect(() => {
    const c = cellsAreaRef.current
    const l = laneScrollRef.current
    if (!c || !l) return
    let syncing = false
    const onC = () => {
      if (syncing) return
      syncing = true
      l.scrollLeft = c.scrollLeft
      syncing = false
    }
    const onL = () => {
      if (syncing) return
      syncing = true
      c.scrollLeft = l.scrollLeft
      syncing = false
    }
    c.addEventListener('scroll', onC)
    l.addEventListener('scroll', onL)
    return () => {
      c.removeEventListener('scroll', onC)
      l.removeEventListener('scroll', onL)
    }
  }, [])

  return (
    <div className="seq-panel" style={{ ['--seq-zoom' as string]: zoom } as React.CSSProperties}>
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

      {/* 編集エリア：
          - 縦スクロール = .seq-grid-stage（外側）
          - 横スクロール = .seq-cells-area（内側、ラベル列の右側のみ）
          - ラベル列（.seq-labels-col）は左に物理的に独立。横スクロール対象から外れて常に見える。
          - ▲ / ▼ ボタンはラベル列の上下端にオーバーレイ。 */}
      <div className="seq-grid-area">
        <div className="seq-grid-stage" ref={gridScrollRef}>
          <div className="seq-labels-col">
            {SEQ_PITCHES.map((midi) => (
              <div
                className={'seq-label' + (tieActiveMidi === midi ? ' tie-active' : '')}
                key={midi}
              >{SEQ_NOTE_LABEL[midi]}</div>
            ))}
          </div>
          <div className="seq-cells-area" ref={cellsAreaRef}>
            <div className="seq-cells-grid">
              {SEQ_PITCHES.map((midi) => (
                <div
                  className={'seq-cells-row' + (tieActiveMidi === midi ? ' tie-active' : '')}
                  key={midi}
                >
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
                        onPointerDown={(e) => handleCellPointerDown(step, midi, e)}
                        onPointerMove={handleCellPointerMove}
                        onPointerUp={(e) => handleCellPointerUp(step, midi, e)}
                        onPointerCancel={handleCellPointerCancel}
                      />
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* ▲ / ▼ ボタン：ラベル列の最上段／最下段にオーバーレイ。 */}
        <button
          className="seq-grid-scroll seq-grid-scroll-up"
          onClick={() => scrollGridBy(-1)}
          aria-label="グリッドを上へスクロール"
        >▲</button>
        <button
          className="seq-grid-scroll seq-grid-scroll-down"
          onClick={() => scrollGridBy(1)}
          aria-label="グリッドを下へスクロール"
        >▼</button>
      </div>

      {/* 横スクロールバー：編集画面の下に物理的なバー。鍵盤の kbd-bar と同じ流儀。
          ティールの「ウィンドウ」が現在見えている範囲を示す。タップ／ドラッグで scrollLeft 制御。 */}
      <div
        className="seq-grid-hscroll"
        ref={hscrollBarRef}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          hscrollDraggingRef.current = true
          updateHScrollFromPointer(e.clientX)
        }}
        onPointerMove={(e) => {
          if (hscrollDraggingRef.current) updateHScrollFromPointer(e.clientX)
        }}
        onPointerUp={(e) => {
          hscrollDraggingRef.current = false
          if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId)
          }
        }}
        onPointerCancel={() => { hscrollDraggingRef.current = false }}
      >
        <div
          className="seq-grid-hscroll-thumb"
          style={{ left: `${hScroll.left * 100}%`, width: `${hScroll.width * 100}%` }}
        />
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
          <button
            className="seq-automation-fold"
            onClick={onToggleCutoffLane}
            aria-pressed={!cutoffLaneOpen}
            aria-label={cutoffLaneOpen ? 'CUTOFF レーンを閉じる' : 'CUTOFF レーンを開く'}
            title={cutoffLaneOpen ? '折りたたむ' : '開く'}
          >
            {cutoffLaneOpen ? '▲' : '▼'}
          </button>
          {/* 伸び縮みするスペーサ：fold と zoom/undo/redo を左右に押し分ける。 */}
          <span className="seq-automation-spacer" />
          {/* 虫眼鏡 3 ボタン：縮小 / リセット / 拡大。二本指ピンチの代わり。
              真ん中（記号なし）は「デフォルト倍率に戻す」の意。 */}
          <button
            className="seq-zoom-btn"
            onClick={zoomOut}
            disabled={zoom <= 0.6 + 1e-6}
            aria-label="ズームアウト"
            title="ズームアウト"
          >
            <ZoomIcon kind="out" />
          </button>
          <button
            className="seq-zoom-btn"
            onClick={zoomReset}
            disabled={Math.abs(zoom - 1.0) < 1e-3}
            aria-label="ズームをデフォルトに戻す"
            title="デフォルトサイズ"
          >
            <ZoomIcon kind="reset" />
          </button>
          <button
            className="seq-zoom-btn"
            onClick={zoomIn}
            disabled={zoom >= 2.0 - 1e-6}
            aria-label="ズームイン"
            title="ズームイン"
          >
            <ZoomIcon kind="in" />
          </button>
          {/* Undo / Redo：CUTOFF 行の右端に 1×1 サイズの 2 ボタン。
              パターン編集とオートメーション編集の履歴のみが対象。 */}
          <button
            className="seq-history-btn"
            onClick={onUndo}
            disabled={!canUndo}
            aria-label="元に戻す"
            title="元に戻す"
          >↶</button>
          <button
            className="seq-history-btn"
            onClick={onRedo}
            disabled={!canRedo}
            aria-label="やり直す"
            title="やり直す"
          >↷</button>
        </div>
        {cutoffLaneOpen && (
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
                  // ドラッグ 1 回 = 1 履歴。最初の down で push。
                  onEditStart()
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
        )}
      </div>
    </div>
  )
}

// 虫眼鏡アイコン。レンズの中に + / 何もなし / − を入れた 3 種類。
// kind="reset" だけはレンズの中身が空（＝デフォルト倍率に戻す）。
function ZoomIcon({ kind }: { kind: 'in' | 'out' | 'reset' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {/* レンズ */}
      <circle cx="10" cy="10" r="6" />
      {/* グリップ */}
      <line x1="14.5" y1="14.5" x2="20" y2="20" />
      {/* レンズの中の記号 */}
      {kind === 'in' && (
        <>
          <line x1="10" y1="7" x2="10" y2="13" />
          <line x1="7" y1="10" x2="13" y2="10" />
        </>
      )}
      {kind === 'out' && <line x1="7" y1="10" x2="13" y2="10" />}
    </svg>
  )
}
