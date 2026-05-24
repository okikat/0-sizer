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
export function useSynth() {
  const ctxRef = useRef<AudioContext | null>(null)
  const oscRef = useRef<OscillatorNode | null>(null)
  const gainRef = useRef<GainNode | null>(null)
  const typeRef = useRef<OscillatorType>('sine')
  const tuneRef = useRef(0)
  const midiRef = useRef<number | null>(null)

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
    if (ctxRef.current.state === 'suspended') void ctxRef.current.resume()
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
      gain.gain.setTargetAtTime(0.18, ctx.currentTime, 0.008)
    },
    [ensure, applyFreq],
  )

  const noteOff = useCallback(() => {
    const ctx = ctxRef.current
    const gain = gainRef.current
    if (ctx && gain) gain.gain.setTargetAtTime(0, ctx.currentTime, 0.05)
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

  return { noteOn, noteOff, setWaveform, setTune }
}
