import { useCallback, useEffect, useRef } from 'react'
import { midiToFreq } from '../lib/notes'

/**
 * ポリフォニックなシンセエンジン（最大 MAX_VOICES 同時発音）。
 * 各 noteOn で 1 ボイス（osc1+osc2+noise → filter → envGain）を新規生成し、
 * 共有チェーン（tremolo → limiter → master → panner → 出力 + reverb + delay）に流す。
 * 上限を超えたら最古ボイスを奪い、解放後はリリースタイム経過でノードを破棄する。
 * AudioContext はブラウザの autoplay 制限のため、最初の noteOn(ユーザー操作)で生成する。
 */
// 音量エンベロープのピーク。複数ボイスが重なってもクリップしないよう、
// 出力直前の DynamicsCompressor（リミッター）で頭打ちにする。
const PEAK = 0.18
const MAX_VOICES = 8

export interface EnvParams {
  attack: number
  decay: number
  sustain: number
  release: number
}

/** LFO の行き先：音程(ビブラート) / 明るさ(オートワウ) / 音量(トレモロ) */
export type LfoDest = 'pitch' | 'cutoff' | 'amp'

// 1 ノート分の音作りに必要なノード一式。
interface Voice {
  midi: number
  osc1: OscillatorNode
  osc2: OscillatorNode
  osc1Gain: GainNode
  osc2Gain: GainNode
  noise: AudioBufferSourceNode
  noiseGain: GainNode
  filter: BiquadFilterNode
  envGain: GainNode
  startedAt: number
  cleanupTimer: ReturnType<typeof setTimeout> | null
}

export function useSynth() {
  const ctxRef = useRef<AudioContext | null>(null)

  // ボイスは midi 番号で索引する。同じ鍵盤を二度押した場合は再アタックする。
  const voicesRef = useRef<Map<number, Voice>>(new Map())
  // GLIDE 開始ピッチ（直前ボイスの目標周波数）。1 音目は使わず、2 音目以降に滑り始点として使う。
  const lastFreqRef = useRef(440)
  // suspended な ctx に noteOn を投げると trigger が非同期予約になる。
  // その間に来た noteOff を保留しておき、trigger 後に確実にリリースを実行するためのキュー。
  // これが無いと「1 回目のタップ：voice 作成前に noteOff が来て無視 → voice 作成後に release なしで
  // 永久に鳴り続ける」というバグになる。
  const pendingOffRef = useRef<Set<number>>(new Set())

  // ---- 共有ノード（context あたり 1 つ） ----
  const masterRef = useRef<GainNode | null>(null)
  const pannerRef = useRef<StereoPannerNode | null>(null)
  const tremoloRef = useRef<GainNode | null>(null)
  const lfoRef = useRef<OscillatorNode | null>(null)
  const lfoPitchGainRef = useRef<GainNode | null>(null)
  const lfoCutoffGainRef = useRef<GainNode | null>(null)
  const lfoAmpGainRef = useRef<GainNode | null>(null)
  const delayRef = useRef<DelayNode | null>(null)
  const delaySendRef = useRef<GainNode | null>(null)
  const delayFbRef = useRef<GainNode | null>(null)
  const reverbWetRef = useRef<GainNode | null>(null)
  // 全ボイス共有のノイズ波形（ボイスごとに BufferSource を作って同じバッファを使う）
  const noiseBufRef = useRef<AudioBuffer | null>(null)

  // ---- 設定値（refs） ----
  const typeRef = useRef<OscillatorType>('sine')
  const tuneRef = useRef(0)
  const glideTauRef = useRef(0.005) // ピッチが新しい音へ滑る時定数（秒）。小さいほど即時。
  const cutoffRef = useRef(16000) // 既定は全開（実質フィルターなし）
  const resRef = useRef(0.7) // クセ無し（フラット）
  const detuneRef = useRef(0) // 2本目のオシレーターの定常デチューン量（セント）
  const mixBalanceRef = useRef(0.5) // OSC1↔OSC2 のミックス（0=OSC1のみ, 1=OSC2のみ, 0.5=等量）
  const noiseLevelRef = useRef(0) // NOISE 音源の音量（0=オフ、1で結構うるさい）
  const filterEnvAmtRef = useRef(0) // 弾いた瞬間のフィルター持ち上げ量（オクターブ）
  const filterEnvDecayRef = useRef(0.3) // フィルターが基準値へ戻る時間（秒）
  const masterVolRef = useRef(1) // マスター音量（0〜1、既定=全開）
  const panRef = useRef(0) // 定位（-1=左 〜 1=右、既定=中央）
  const delayTimeRef = useRef(0.32) // 秒（既定 320ms ≒ 4分音符@80bpm 相当）
  const delayMixRef = useRef(0) // 0..0.5（送り量）
  const reverbMixRef = useRef(0.15) // 0..0.5（wet 送り量。既定はかすかな部屋鳴り）
  const lfoRateRef = useRef(3.8) // Hz（RATEツマミ既定=3 に対応）
  const lfoDepthRef = useRef(0) // つまみ量 0〜10
  const lfoDestRef = useRef<LfoDest>('pitch')
  const envRef = useRef<EnvParams>({ attack: 0.01, decay: 0.2, sustain: 0.7, release: 0.3 })

  // 現在の depth(amt 0〜10) と 行き先 から、3 つのゲインを設定する。
  const applyLfo = useCallback(() => {
    const ctx = ctxRef.current
    const p = lfoPitchGainRef.current
    const c = lfoCutoffGainRef.current
    const a = lfoAmpGainRef.current
    if (!ctx || !p || !c || !a) return
    const amt = lfoDepthRef.current
    const dest = lfoDestRef.current
    // 行き先ごとの感度。聴感が揃うようにチューニング。
    const pitchCents = dest === 'pitch' ? amt * 20 : 0 // 0〜200 cents（±2半音）
    const cutoffCents = dest === 'cutoff' ? amt * 100 : 0 // 0〜1000 cents（≒±10半音/オクターブ弱）
    const ampMod = dest === 'amp' ? amt * 0.07 : 0 // 0〜0.7（音量を 0.3〜1.7 で揺らす）
    const t = ctx.currentTime
    p.gain.setTargetAtTime(pitchCents, t, 0.02)
    c.gain.setTargetAtTime(cutoffCents, t, 0.02)
    a.gain.setTargetAtTime(ampMod, t, 0.02)
  }, [])

  const ensure = useCallback(() => {
    // 'closed' になった AudioContext は復活できない（resume が必ず失敗する）。
    // 端末がオーディオセッションを破棄した（バックグラウンド長期化／ブラウザ復帰）後など。
    // この場合は ref を捨てて、下のブロックで新規に作り直す。
    if (ctxRef.current && ctxRef.current.state === 'closed') {
      voicesRef.current.forEach((v) => { if (v.cleanupTimer) clearTimeout(v.cleanupTimer) })
      voicesRef.current.clear()
      ctxRef.current = null
    }
    if (!ctxRef.current) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const ctx = new Ctor()
      // 共有出力チェーン：voice.envGain → tremolo → limiter → master → panner → 出力
      // tremolo は LFO(AMP) で揺らす共有ゲイン。
      const tremolo = ctx.createGain()
      tremolo.gain.value = 1
      // リミッター：和音で総音量が上がっても出力をクリップさせない安全網。
      // 通常の演奏ではほとんど触れず、強い和音や NOISE 最大時に頭を抑える。
      const limiter = ctx.createDynamicsCompressor()
      limiter.threshold.value = -6
      limiter.knee.value = 8
      limiter.ratio.value = 8
      limiter.attack.value = 0.003
      limiter.release.value = 0.1
      const master = ctx.createGain()
      master.gain.value = masterVolRef.current
      const panner = ctx.createStereoPanner()
      panner.pan.value = panRef.current
      tremolo.connect(limiter)
      limiter.connect(master)
      master.connect(panner)
      panner.connect(ctx.destination)
      // 薄いリバーブ：パン後の出力を並列でコンボルバへ送り、wet で混ぜる（dry はそのまま出力）。
      // IR は減衰ノイズを合成して生成（音源ファイルなし）。
      const reverb = ctx.createConvolver()
      const sr = ctx.sampleRate
      const irLen = Math.floor(sr * 1.6)
      const ir = ctx.createBuffer(2, irLen, sr)
      for (let ch = 0; ch < 2; ch++) {
        const d = ir.getChannelData(ch)
        for (let i = 0; i < irLen; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / irLen, 2.4)
      }
      reverb.buffer = ir
      const wet = ctx.createGain()
      wet.gain.value = reverbMixRef.current
      panner.connect(wet)
      wet.connect(reverb)
      reverb.connect(ctx.destination)
      // ディレイ：panner からの送り → DelayNode → 出力。フィードバックループで山びこに。
      // 送り量(=MIX) は 0 既定でオフ。フィードバックは固定（暴れすぎず聴感のよい値）。
      const delay = ctx.createDelay(2.0)
      delay.delayTime.value = delayTimeRef.current
      const delaySend = ctx.createGain()
      delaySend.gain.value = delayMixRef.current
      const delayFb = ctx.createGain()
      delayFb.gain.value = 0.45
      panner.connect(delaySend)
      delaySend.connect(delay)
      delay.connect(ctx.destination)
      delay.connect(delayFb)
      delayFb.connect(delay)
      // LFO：低速オシレーターで「ピッチ／カットオフ／音量」のいずれかを揺らす。
      // pitch/cutoff のゲインはボイス生成時に各ボイスの osc/filter に追加で接続する。
      // amp はトレモロに直接（共有）。
      const lfo = ctx.createOscillator()
      lfo.type = 'sine'
      lfo.frequency.value = lfoRateRef.current
      const lfoPitchGain = ctx.createGain()
      lfoPitchGain.gain.value = 0
      const lfoCutoffGain = ctx.createGain()
      lfoCutoffGain.gain.value = 0
      const lfoAmpGain = ctx.createGain()
      lfoAmpGain.gain.value = 0
      lfo.connect(lfoPitchGain)
      lfo.connect(lfoCutoffGain)
      lfo.connect(lfoAmpGain)
      lfoAmpGain.connect(tremolo.gain)
      lfo.start()
      // 共有ノイズバッファ：ボイス毎に BufferSource を作り、このバッファを参照させる。
      const noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 2), ctx.sampleRate)
      const data = noiseBuf.getChannelData(0)
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1

      ctxRef.current = ctx
      masterRef.current = master
      pannerRef.current = panner
      tremoloRef.current = tremolo
      lfoRef.current = lfo
      lfoPitchGainRef.current = lfoPitchGain
      lfoCutoffGainRef.current = lfoCutoffGain
      lfoAmpGainRef.current = lfoAmpGain
      delayRef.current = delay
      delaySendRef.current = delaySend
      delayFbRef.current = delayFb
      reverbWetRef.current = wet
      noiseBufRef.current = noiseBuf
      // 既定の depth=0 なので 3 つとも 0 のまま。OK。
      applyLfo()
    }
    if (ctxRef.current.state !== 'running') void ctxRef.current.resume()
  }, [applyLfo])

  // 1 ボイスを生成して共有ノードに接続する。
  const createVoice = useCallback((midi: number): Voice | null => {
    const ctx = ctxRef.current
    const tremolo = tremoloRef.current
    const lfoPitchGain = lfoPitchGainRef.current
    const lfoCutoffGain = lfoCutoffGainRef.current
    const noiseBuf = noiseBufRef.current
    if (!ctx || !tremolo || !lfoPitchGain || !lfoCutoffGain || !noiseBuf) return null

    const envGain = ctx.createGain()
    envGain.gain.value = 0
    envGain.connect(tremolo)

    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = cutoffRef.current
    filter.Q.value = resRef.current
    filter.connect(envGain)
    lfoCutoffGain.connect(filter.detune)

    const osc1 = ctx.createOscillator()
    osc1.type = typeRef.current
    const osc1Gain = ctx.createGain()
    osc1Gain.gain.value = 1 - mixBalanceRef.current
    osc1.connect(osc1Gain)
    osc1Gain.connect(filter)
    lfoPitchGain.connect(osc1.detune)

    const osc2 = ctx.createOscillator()
    osc2.type = typeRef.current
    osc2.detune.value = detuneRef.current
    const osc2Gain = ctx.createGain()
    osc2Gain.gain.value = mixBalanceRef.current
    osc2.connect(osc2Gain)
    osc2Gain.connect(filter)
    lfoPitchGain.connect(osc2.detune)

    const noise = ctx.createBufferSource()
    noise.buffer = noiseBuf
    noise.loop = true
    const noiseGain = ctx.createGain()
    noiseGain.gain.value = noiseLevelRef.current
    noise.connect(noiseGain)
    noiseGain.connect(filter)

    // ピッチ初期値：他のボイスが鳴っていれば lastFreq から滑り、なければ即座に目標へ。
    const target = midiToFreq(midi) * Math.pow(2, tuneRef.current / 12)
    const now = ctx.currentTime
    if (voicesRef.current.size > 0) {
      const tau = glideTauRef.current
      osc1.frequency.setValueAtTime(lastFreqRef.current, now)
      osc2.frequency.setValueAtTime(lastFreqRef.current, now)
      osc1.frequency.setTargetAtTime(target, now, tau)
      osc2.frequency.setTargetAtTime(target, now, tau)
    } else {
      osc1.frequency.setValueAtTime(target, now)
      osc2.frequency.setValueAtTime(target, now)
    }
    lastFreqRef.current = target

    osc1.start()
    osc2.start()
    noise.start()

    return {
      midi,
      osc1, osc2, osc1Gain, osc2Gain,
      noise, noiseGain,
      filter, envGain,
      startedAt: now,
      cleanupTimer: null,
    }
  }, [])

  // ボイスのノードを停止・切断する。リリース完了後に呼ぶ。
  const hardStopVoice = useCallback((v: Voice) => {
    try { v.osc1.stop() } catch { /* already stopped */ }
    try { v.osc2.stop() } catch { /* already stopped */ }
    try { v.noise.stop() } catch { /* already stopped */ }
    try { v.envGain.disconnect() } catch { /* already disconnected */ }
    try { v.filter.disconnect() } catch { /* already disconnected */ }
    try { v.osc1.disconnect() } catch { /* */ }
    try { v.osc2.disconnect() } catch { /* */ }
    try { v.noise.disconnect() } catch { /* */ }
    try { v.osc1Gain.disconnect() } catch { /* */ }
    try { v.osc2Gain.disconnect() } catch { /* */ }
    try { v.noiseGain.disconnect() } catch { /* */ }
    if (v.cleanupTimer) {
      clearTimeout(v.cleanupTimer)
      v.cleanupTimer = null
    }
  }, [])

  const noteOn = useCallback(
    (midi: number) => {
      ensure()
      const trigger = () => {
        const ctx = ctxRef.current
        if (!ctx) return
        let voice = voicesRef.current.get(midi)
        if (voice) {
          // 同じノートの再トリガ：解放タイマーをキャンセルし、エンベロープを再アタック。
          if (voice.cleanupTimer) {
            clearTimeout(voice.cleanupTimer)
            voice.cleanupTimer = null
          }
        } else {
          // 上限超なら最古ボイスを奪う。
          if (voicesRef.current.size >= MAX_VOICES) {
            const sorted = Array.from(voicesRef.current.values()).sort((a, b) => a.startedAt - b.startedAt)
            const oldest = sorted[0]
            if (oldest) {
              hardStopVoice(oldest)
              voicesRef.current.delete(oldest.midi)
            }
          }
          const created = createVoice(midi)
          if (!created) return
          voice = created
          voicesRef.current.set(midi, voice)
        }
        // 音量エンベロープ。
        const now = ctx.currentTime
        const { attack, decay, sustain } = envRef.current
        const a = Math.max(0.005, attack)
        const d = Math.max(0.005, decay)
        const cur = Math.max(voice.envGain.gain.value, 0.0001)
        voice.envGain.gain.cancelScheduledValues(now)
        voice.envGain.gain.setValueAtTime(cur, now)
        voice.envGain.gain.linearRampToValueAtTime(PEAK, now + a)
        voice.envGain.gain.linearRampToValueAtTime(PEAK * sustain, now + a + d)
        // フィルターエンベロープ：弾いた瞬間に cutoff を envAmt オクターブ上げ、decay 秒で基準へ。
        const envAmt = filterEnvAmtRef.current
        const base = cutoffRef.current
        const peak = envAmt > 0 ? Math.min(20000, base * Math.pow(2, envAmt)) : base
        voice.filter.frequency.cancelScheduledValues(now)
        voice.filter.frequency.setValueAtTime(peak, now)
        const tau = Math.max(0.02, filterEnvDecayRef.current) * 0.33
        voice.filter.frequency.setTargetAtTime(base, now + 0.005, tau)
        // suspended 中に noteOff を取りこぼしていたら、ここでリリースを入れる。
        // アタック頂点（now + a）以降だけキャンセルしてリリース ramp を追加 → アタックは聴かせる。
        if (pendingOffRef.current.has(midi)) {
          pendingOffRef.current.delete(midi)
          const r = Math.max(0.01, envRef.current.release)
          voice.envGain.gain.cancelScheduledValues(now + a + 0.001)
          voice.envGain.gain.linearRampToValueAtTime(0.0001, now + a + r)
          if (voice.cleanupTimer) clearTimeout(voice.cleanupTimer)
          const captured = voice
          voice.cleanupTimer = setTimeout(() => {
            hardStopVoice(captured)
            voicesRef.current.delete(midi)
          }, (a + r + 0.05) * 1000)
        }
      }
      const ctx = ctxRef.current
      if (!ctx) return
      if (ctx.state === 'running') {
        trigger()
        return
      }
      ctx
        .resume()
        .then(trigger)
        .catch(() => {
          // resume が失敗するのは context が closed のとき。捨てて新規生成して再試行。
          ctxRef.current = null
          ensure()
          const ctx2 = ctxRef.current!
          if (ctx2.state === 'running') trigger()
          else ctx2.resume().then(trigger).catch(() => {})
        })
    },
    [ensure, createVoice, hardStopVoice],
  )

  const noteOff = useCallback(
    (midi: number) => {
      const ctx = ctxRef.current
      if (!ctx) return
      const voice = voicesRef.current.get(midi)
      if (!voice) {
        // voice 未作成（noteOn の trigger が ctx resume 待ちで非同期予約中）。
        // ここで諦めると永久に鳴り続けてしまうので、キューに積んで trigger 側で消化する。
        pendingOffRef.current.add(midi)
        return
      }
      const now = ctx.currentTime
      const r = Math.max(0.01, envRef.current.release)
      const cur = voice.envGain.gain.value
      voice.envGain.gain.cancelScheduledValues(now)
      voice.envGain.gain.setValueAtTime(cur, now)
      voice.envGain.gain.linearRampToValueAtTime(0.0001, now + r)
      // クリーンアップ：リリースが終わったらノードを停止・解放。
      if (voice.cleanupTimer) clearTimeout(voice.cleanupTimer)
      voice.cleanupTimer = setTimeout(() => {
        hardStopVoice(voice)
        voicesRef.current.delete(midi)
      }, (r + 0.05) * 1000)
    },
    [hardStopVoice],
  )

  // ---- セッター ----
  // 設定変更は ref に保存しつつ、現在鳴っている全ボイスにも反映する。
  // 反映の必要がないもの（envelope/filterEnv）は ref のみ更新（次の noteOn から効く）。

  const setEnv = useCallback((e: EnvParams) => {
    envRef.current = e
  }, [])

  const setWaveform = useCallback((t: OscillatorType) => {
    typeRef.current = t
    voicesRef.current.forEach((v) => {
      v.osc1.type = t
      v.osc2.type = t
    })
  }, [])

  const setTune = useCallback((semitones: number) => {
    tuneRef.current = semitones
    const ctx = ctxRef.current
    if (!ctx) return
    const tau = glideTauRef.current
    voicesRef.current.forEach((v) => {
      const target = midiToFreq(v.midi) * Math.pow(2, semitones / 12)
      v.osc1.frequency.setTargetAtTime(target, ctx.currentTime, tau)
      v.osc2.frequency.setTargetAtTime(target, ctx.currentTime, tau)
    })
  }, [])

  const setCutoff = useCallback((hz: number) => {
    cutoffRef.current = hz
    const ctx = ctxRef.current
    if (!ctx) return
    voicesRef.current.forEach((v) => {
      v.filter.frequency.setTargetAtTime(hz, ctx.currentTime, 0.01)
    })
  }, [])

  const setResonance = useCallback((q: number) => {
    resRef.current = q
    const ctx = ctxRef.current
    if (!ctx) return
    voicesRef.current.forEach((v) => {
      v.filter.Q.setTargetAtTime(q, ctx.currentTime, 0.01)
    })
  }, [])

  const setDetune = useCallback((cents: number) => {
    detuneRef.current = cents
    const ctx = ctxRef.current
    if (!ctx) return
    voicesRef.current.forEach((v) => {
      v.osc2.detune.setTargetAtTime(cents, ctx.currentTime, 0.02)
    })
  }, [])

  const setNoise = useCallback((level: number) => {
    const l = Math.max(0, level)
    noiseLevelRef.current = l
    const ctx = ctxRef.current
    if (!ctx) return
    voicesRef.current.forEach((v) => {
      v.noiseGain.gain.setTargetAtTime(l, ctx.currentTime, 0.02)
    })
  }, [])

  const setMix = useCallback((balance: number) => {
    const b = Math.max(0, Math.min(1, balance))
    mixBalanceRef.current = b
    const ctx = ctxRef.current
    if (!ctx) return
    voicesRef.current.forEach((v) => {
      v.osc1Gain.gain.setTargetAtTime(1 - b, ctx.currentTime, 0.02)
      v.osc2Gain.gain.setTargetAtTime(b, ctx.currentTime, 0.02)
    })
  }, [])

  const setFilterEnv = useCallback((amtOctaves: number, decaySec: number) => {
    filterEnvAmtRef.current = amtOctaves
    filterEnvDecayRef.current = decaySec
  }, [])

  const setLfoRate = useCallback((hz: number) => {
    lfoRateRef.current = hz
    const ctx = ctxRef.current
    const lfo = lfoRef.current
    if (ctx && lfo) lfo.frequency.setTargetAtTime(hz, ctx.currentTime, 0.02)
  }, [])

  const setLfoDepth = useCallback((amt: number) => {
    lfoDepthRef.current = amt
    applyLfo()
  }, [applyLfo])

  const setLfoDest = useCallback((d: LfoDest) => {
    lfoDestRef.current = d
    applyLfo()
  }, [applyLfo])

  const setMasterVol = useCallback((v: number) => {
    masterVolRef.current = v
    const ctx = ctxRef.current
    const m = masterRef.current
    if (ctx && m) m.gain.setTargetAtTime(v, ctx.currentTime, 0.01)
  }, [])

  const setDelayTime = useCallback((sec: number) => {
    const s = Math.max(0.005, Math.min(2, sec))
    delayTimeRef.current = s
    const ctx = ctxRef.current
    const d = delayRef.current
    // 急に変えると「ピロロ」とピッチが変わるので、ゆっくりランプ。
    if (ctx && d) d.delayTime.setTargetAtTime(s, ctx.currentTime, 0.05)
  }, [])

  const setDelayMix = useCallback((level: number) => {
    const l = Math.max(0, level)
    delayMixRef.current = l
    const ctx = ctxRef.current
    const g = delaySendRef.current
    if (ctx && g) g.gain.setTargetAtTime(l, ctx.currentTime, 0.02)
  }, [])

  const setReverbMix = useCallback((level: number) => {
    const l = Math.max(0, level)
    reverbMixRef.current = l
    const ctx = ctxRef.current
    const g = reverbWetRef.current
    if (ctx && g) g.gain.setTargetAtTime(l, ctx.currentTime, 0.02)
  }, [])

  const setGlideTime = useCallback((tauSec: number) => {
    glideTauRef.current = Math.max(0.001, tauSec)
  }, [])

  const setPan = useCallback((p: number) => {
    panRef.current = p
    const ctx = ctxRef.current
    const pn = pannerRef.current
    if (ctx && pn) pn.pan.setTargetAtTime(p, ctx.currentTime, 0.01)
  }, [])

  useEffect(() => {
    const resume = () => {
      const ctx = ctxRef.current
      if (ctx && ctx.state !== 'running') void ctx.resume()
    }
    document.addEventListener('visibilitychange', resume)
    window.addEventListener('focus', resume)
    window.addEventListener('pointerdown', resume, true)
    return () => {
      document.removeEventListener('visibilitychange', resume)
      window.removeEventListener('focus', resume)
      window.removeEventListener('pointerdown', resume, true)
    }
  }, [])

  useEffect(() => {
    // クリーンアップ時点での Map（unmount 時に鳴っているボイス）を解放する。
    // ref を直接読みたいケース（lint の警告はここでは正しくない）。
    const voices = voicesRef
    return () => {
      try {
        voices.current.forEach((v) => {
          try { v.osc1.stop() } catch { /* */ }
          try { v.osc2.stop() } catch { /* */ }
          try { v.noise.stop() } catch { /* */ }
          if (v.cleanupTimer) clearTimeout(v.cleanupTimer)
        })
        voices.current.clear()
        void ctxRef.current?.close()
      } catch {
        // already closed
      }
    }
  }, [])

  const getAudioContext = useCallback(() => ctxRef.current, [])

  return {
    noteOn,
    noteOff,
    setWaveform,
    setTune,
    setEnv,
    setCutoff,
    setResonance,
    setDetune,
    setMix,
    setNoise,
    setFilterEnv,
    setLfoRate,
    setLfoDepth,
    setLfoDest,
    setMasterVol,
    setPan,
    setDelayTime,
    setDelayMix,
    setReverbMix,
    setGlideTime,
    getAudioContext,
  }
}
