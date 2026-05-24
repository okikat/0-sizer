import { useCallback, useEffect, useRef } from 'react'
import { midiToFreq } from '../lib/notes'

// 純音(サイン波)は Bluetooth のコーデックが扱いを誤りプツプツする。極小レベルの
// ホワイトノイズを常に少しだけ混ぜて信号を“動かす”ことでプツプツを抑える。
// gain(エンベロープ)経由なので、音が鳴っていない間はノイズも消える。耳で微調整する値。
const NOISE_LEVEL = 0.004

/**
 * モノフォニックなシンセエンジン。
 * オシレーター1個 + ゲイン1個を常駐させ、noteOn でゲインを上げ、noteOff で下げる。
 * 周波数は「弾いた音(midi)」×「TUNE(半音)」で決まる。
 * AudioContext はブラウザの autoplay 制限のため、最初の noteOn(ユーザー操作)で生成する。
 */
// 音量エンベロープのピーク（元の 0.18 相当）。
const PEAK = 0.2

export interface EnvParams {
  attack: number
  decay: number
  sustain: number
  release: number
}

export function useSynth() {
  const ctxRef = useRef<AudioContext | null>(null)
  const oscRef = useRef<OscillatorNode | null>(null)
  const gainRef = useRef<GainNode | null>(null)
  const typeRef = useRef<OscillatorType>('sine')
  const tuneRef = useRef(0)
  const midiRef = useRef<number | null>(null)
  const envRef = useRef<EnvParams>({ attack: 0.01, decay: 0.2, sustain: 0.7, release: 0.3 })

  const ensure = useCallback(() => {
    if (!ctxRef.current) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const ctx = new Ctor()
      const gain = ctx.createGain()
      gain.gain.value = 0
      gain.connect(ctx.destination)
      const osc = ctx.createOscillator()
      osc.type = typeRef.current
      osc.frequency.value = 440
      osc.connect(gain)
      osc.start()
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
      ctxRef.current = ctx
      gainRef.current = gain
      oscRef.current = osc
    }
    // 'suspended' に加え Safari の 'interrupted'（通話・スリープ後）も再開する。
    if (ctxRef.current.state !== 'running') void ctxRef.current.resume()
  }, [])

  const applyFreq = useCallback(() => {
    const ctx = ctxRef.current
    const osc = oscRef.current
    if (ctx && osc && midiRef.current != null) {
      const f = midiToFreq(midiRef.current) * Math.pow(2, tuneRef.current / 12)
      osc.frequency.setTargetAtTime(f, ctx.currentTime, 0.006)
    }
  }, [])

  const noteOn = useCallback(
    (midi: number) => {
      ensure()
      midiRef.current = midi
      applyFreq()
      const ctx = ctxRef.current!
      const gain = gainRef.current!
      const now = ctx.currentTime
      const { attack, decay, sustain } = envRef.current
      const a = Math.max(0.005, attack)
      const d = Math.max(0.005, decay)
      // 現在値から再スケジュール（連打・リリース途中の押し直しでもクリックしない）。
      const cur = Math.max(gain.gain.value, 0.0001)
      gain.gain.cancelScheduledValues(now)
      gain.gain.setValueAtTime(cur, now)
      gain.gain.linearRampToValueAtTime(PEAK, now + a)
      gain.gain.linearRampToValueAtTime(PEAK * sustain, now + a + d)
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
    if (oscRef.current) oscRef.current.type = t
  }, [])

  const setTune = useCallback(
    (semitones: number) => {
      tuneRef.current = semitones
      applyFreq()
    },
    [applyFreq],
  )

  // スリープ復帰・タブ復帰・通話後などで AudioContext が止まる。戻ってきたら先回りで再開し、
  // 「数秒鳴らない」を防ぐ。pointerdown(capture)でも再開し、iOS のジェスチャー要件にも対応。
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
        oscRef.current?.stop()
        void ctxRef.current?.close()
      } catch {
        // already closed
      }
    }
  }, [])

  return { noteOn, noteOff, setWaveform, setTune, setEnv }
}
