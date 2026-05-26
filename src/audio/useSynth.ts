import { useCallback, useEffect, useRef } from 'react'
import { midiToFreq } from '../lib/notes'

// 純音(サイン波)は Bluetooth のコーデックが扱いを誤りプツプツする。極小レベルの
// ホワイトノイズを常に少しだけ混ぜて信号を“動かす”ことでプツプツを抑える。
// gain(エンベロープ)経由なので、音が鳴っていない間はノイズも消える。耳で微調整する値。
const NOISE_LEVEL = 0.004

/**
 * モノフォニックなシンセエンジン。
 * 2本のオシレーター(デチューンで厚み) + フィルター(エンベロープ付き) + ゲイン(エンベロープ) +
 * マスター・パン → 出力。出力には薄いリバーブ(コンボルバ)を並列で混ぜて空間感を与える。
 * AudioContext はブラウザの autoplay 制限のため、最初の noteOn(ユーザー操作)で生成する。
 */
// 音量エンベロープのピーク。OSC1+OSC2 は MIX で常にトータル ≒ 1.0 に抑えるので、
// 元の 1オシ相当（0.2 弱）に戻す。
const PEAK = 0.18

export interface EnvParams {
  attack: number
  decay: number
  sustain: number
  release: number
}

/** LFO の行き先：音程(ビブラート) / 明るさ(オートワウ) / 音量(トレモロ) */
export type LfoDest = 'pitch' | 'cutoff' | 'amp'

export function useSynth() {
  const ctxRef = useRef<AudioContext | null>(null)
  const osc1Ref = useRef<OscillatorNode | null>(null)
  const osc2Ref = useRef<OscillatorNode | null>(null)
  const osc1GainRef = useRef<GainNode | null>(null)
  const osc2GainRef = useRef<GainNode | null>(null)
  const noiseGainRef = useRef<GainNode | null>(null)
  const gainRef = useRef<GainNode | null>(null)
  const filterRef = useRef<BiquadFilterNode | null>(null)
  const masterRef = useRef<GainNode | null>(null)
  const pannerRef = useRef<StereoPannerNode | null>(null)
  const lfoRef = useRef<OscillatorNode | null>(null)
  const lfoPitchGainRef = useRef<GainNode | null>(null)
  const lfoCutoffGainRef = useRef<GainNode | null>(null)
  const lfoAmpGainRef = useRef<GainNode | null>(null)
  const tremoloRef = useRef<GainNode | null>(null)
  const delayRef = useRef<DelayNode | null>(null)
  const delaySendRef = useRef<GainNode | null>(null)
  const delayFbRef = useRef<GainNode | null>(null)
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
  const lfoRateRef = useRef(3.8) // Hz（RATEツマミ既定=3 に対応）
  const lfoDepthRef = useRef(0) // つまみ量 0〜10
  const lfoDestRef = useRef<LfoDest>('pitch')
  const midiRef = useRef<number | null>(null)
  const envRef = useRef<EnvParams>({ attack: 0.01, decay: 0.2, sustain: 0.7, release: 0.3 })

  const ensure = useCallback(() => {
    // 'closed' になった AudioContext は復活できない（resume が必ず失敗する）。
    // 端末がオーディオセッションを破棄した（バックグラウンド長期化／ブラウザ復帰）後など。
    // この場合は ref を捨てて、下のブロックで新規に作り直す。
    if (ctxRef.current && ctxRef.current.state === 'closed') {
      ctxRef.current = null
    }
    if (!ctxRef.current) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const ctx = new Ctor()
      const gain = ctx.createGain()
      gain.gain.value = 0
      // トレモロ用ゲイン：LFO が AMP に向くとここで音量を揺らす。既定 1.0。
      const tremolo = ctx.createGain()
      tremolo.gain.value = 1
      // マスター音量 → 定位(パン) → 出力。MIX モジュールがここを操作する。
      const master = ctx.createGain()
      master.gain.value = masterVolRef.current
      const panner = ctx.createStereoPanner()
      panner.pan.value = panRef.current
      gain.connect(tremolo)
      tremolo.connect(master)
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
      wet.gain.value = 0.13
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
      // ローパスフィルター：音の素(osc)とエンベロープ(gain)の間に挟む。
      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = cutoffRef.current
      filter.Q.value = resRef.current
      filter.connect(gain)
      // 主オシレーター 2本。osc2 は定常デチューン。MIX で 1↔2 のバランスを取り、
      // 合計レベルは概ね 1.0 に保つ（osc1Gain = 1-mix / osc2Gain = mix の線形クロスフェード）。
      const osc1 = ctx.createOscillator()
      osc1.type = typeRef.current
      osc1.frequency.value = 440
      const osc1Gain = ctx.createGain()
      osc1Gain.gain.value = 1 - mixBalanceRef.current
      osc1.connect(osc1Gain)
      osc1Gain.connect(filter)
      osc1.start()
      const osc2 = ctx.createOscillator()
      osc2.type = typeRef.current
      osc2.frequency.value = 440
      osc2.detune.value = detuneRef.current
      const osc2Gain = ctx.createGain()
      osc2Gain.gain.value = mixBalanceRef.current
      osc2.connect(osc2Gain)
      osc2Gain.connect(filter)
      osc2.start()
      // 極小レベルのホワイトノイズを混ぜる(エンベロープ経由なので無音時は消える)。
      const noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 2), ctx.sampleRate)
      const data = noiseBuf.getChannelData(0)
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
      const noise = ctx.createBufferSource()
      noise.buffer = noiseBuf
      noise.loop = true
      const noiseLevel = ctx.createGain()
      noiseLevel.gain.value = NOISE_LEVEL
      noise.connect(noiseLevel)
      noiseLevel.connect(gain)
      noise.start()
      // ユーザー操作の NOISE 音源（フィルター経由で envelope に乗せる＝風/吹奏感などに使える）。
      const noiseUser = ctx.createBufferSource()
      noiseUser.buffer = noiseBuf
      noiseUser.loop = true
      const noiseUserGain = ctx.createGain()
      noiseUserGain.gain.value = noiseLevelRef.current
      noiseUser.connect(noiseUserGain)
      noiseUserGain.connect(filter)
      noiseUser.start()
      // LFO：低速オシレーターで「ピッチ／カットオフ／音量」のいずれかを揺らす。
      // 3 つの行き先用ゲインを並列に置き、現在の行き先以外は 0、選んだ先だけ depth に応じた値に。
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
      lfoPitchGain.connect(osc1.detune)
      lfoPitchGain.connect(osc2.detune)
      lfo.connect(lfoCutoffGain)
      lfoCutoffGain.connect(filter.detune)
      lfo.connect(lfoAmpGain)
      lfoAmpGain.connect(tremolo.gain)
      lfo.start()
      ctxRef.current = ctx
      gainRef.current = gain
      osc1Ref.current = osc1
      osc2Ref.current = osc2
      osc1GainRef.current = osc1Gain
      osc2GainRef.current = osc2Gain
      noiseGainRef.current = noiseUserGain
      filterRef.current = filter
      masterRef.current = master
      pannerRef.current = panner
      lfoRef.current = lfo
      lfoPitchGainRef.current = lfoPitchGain
      lfoCutoffGainRef.current = lfoCutoffGain
      lfoAmpGainRef.current = lfoAmpGain
      tremoloRef.current = tremolo
      delayRef.current = delay
      delaySendRef.current = delaySend
      delayFbRef.current = delayFb
      // 既定の depth=0 なので 3 つとも 0 のまま。OK。
    }
    if (ctxRef.current.state !== 'running') void ctxRef.current.resume()
  }, [])

  const applyFreq = useCallback(() => {
    const ctx = ctxRef.current
    const o1 = osc1Ref.current
    const o2 = osc2Ref.current
    if (ctx && o1 && o2 && midiRef.current != null) {
      const f = midiToFreq(midiRef.current) * Math.pow(2, tuneRef.current / 12)
      const tau = glideTauRef.current
      o1.frequency.setTargetAtTime(f, ctx.currentTime, tau)
      o2.frequency.setTargetAtTime(f, ctx.currentTime, tau)
    }
  }, [])

  const noteOn = useCallback(
    (midi: number) => {
      ensure()
      midiRef.current = midi
      // ref から都度読む（再生成された場合に最新のノードを掴むため）。
      const trigger = () => {
        applyFreq()
        const ctx = ctxRef.current
        const gain = gainRef.current
        const filter = filterRef.current
        if (!ctx || !gain || !filter) return
        const now = ctx.currentTime
        const { attack, decay, sustain } = envRef.current
        const a = Math.max(0.005, attack)
        const d = Math.max(0.005, decay)
        const cur = Math.max(gain.gain.value, 0.0001)
        gain.gain.cancelScheduledValues(now)
        gain.gain.setValueAtTime(cur, now)
        gain.gain.linearRampToValueAtTime(PEAK, now + a)
        gain.gain.linearRampToValueAtTime(PEAK * sustain, now + a + d)
        // フィルターエンベロープ：弾いた瞬間に cutoff を envAmt オクターブ上げ、decay 秒で基準へ。
        const envAmt = filterEnvAmtRef.current
        const base = cutoffRef.current
        const peak = envAmt > 0 ? Math.min(20000, base * Math.pow(2, envAmt)) : base
        filter.frequency.cancelScheduledValues(now)
        filter.frequency.setValueAtTime(peak, now)
        const tau = Math.max(0.02, filterEnvDecayRef.current) * 0.33
        filter.frequency.setTargetAtTime(base, now + 0.005, tau)
      }
      const ctx = ctxRef.current!
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
    [ensure, applyFreq],
  )

  const noteOff = useCallback(() => {
    const ctx = ctxRef.current
    const gain = gainRef.current
    if (!ctx || !gain) return
    const now = ctx.currentTime
    const r = Math.max(0.01, envRef.current.release)
    const cur = gain.gain.value
    gain.gain.cancelScheduledValues(now)
    gain.gain.setValueAtTime(cur, now)
    gain.gain.linearRampToValueAtTime(0.0001, now + r)
  }, [])

  const setEnv = useCallback((e: EnvParams) => {
    envRef.current = e
  }, [])

  const setWaveform = useCallback((t: OscillatorType) => {
    typeRef.current = t
    if (osc1Ref.current) osc1Ref.current.type = t
    if (osc2Ref.current) osc2Ref.current.type = t
  }, [])

  const setTune = useCallback(
    (semitones: number) => {
      tuneRef.current = semitones
      applyFreq()
    },
    [applyFreq],
  )

  const setCutoff = useCallback((hz: number) => {
    cutoffRef.current = hz
    const ctx = ctxRef.current
    const f = filterRef.current
    if (ctx && f) f.frequency.setTargetAtTime(hz, ctx.currentTime, 0.01)
  }, [])

  const setResonance = useCallback((q: number) => {
    resRef.current = q
    const ctx = ctxRef.current
    const f = filterRef.current
    if (ctx && f) f.Q.setTargetAtTime(q, ctx.currentTime, 0.01)
  }, [])

  const setDetune = useCallback((cents: number) => {
    detuneRef.current = cents
    const ctx = ctxRef.current
    const o2 = osc2Ref.current
    if (ctx && o2) o2.detune.setTargetAtTime(cents, ctx.currentTime, 0.02)
  }, [])

  const setNoise = useCallback((level: number) => {
    const l = Math.max(0, level)
    noiseLevelRef.current = l
    const ctx = ctxRef.current
    const g = noiseGainRef.current
    if (ctx && g) g.gain.setTargetAtTime(l, ctx.currentTime, 0.02)
  }, [])

  const setMix = useCallback((balance: number) => {
    const b = Math.max(0, Math.min(1, balance))
    mixBalanceRef.current = b
    const ctx = ctxRef.current
    const g1 = osc1GainRef.current
    const g2 = osc2GainRef.current
    if (ctx && g1 && g2) {
      g1.gain.setTargetAtTime(1 - b, ctx.currentTime, 0.02)
      g2.gain.setTargetAtTime(b, ctx.currentTime, 0.02)
    }
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
    const pitchCents = dest === 'pitch' ? amt * 20 : 0   // 0〜200 cents（±2半音）
    const cutoffCents = dest === 'cutoff' ? amt * 100 : 0 // 0〜1000 cents（≒±10半音/オクターブ弱）
    const ampMod = dest === 'amp' ? amt * 0.07 : 0       // 0〜0.7（音量を 0.3〜1.7 で揺らす）
    const t = ctx.currentTime
    p.gain.setTargetAtTime(pitchCents, t, 0.02)
    c.gain.setTargetAtTime(cutoffCents, t, 0.02)
    a.gain.setTargetAtTime(ampMod, t, 0.02)
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
    return () => {
      try {
        osc1Ref.current?.stop()
        osc2Ref.current?.stop()
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
    setGlideTime,
    getAudioContext,
  }
}
