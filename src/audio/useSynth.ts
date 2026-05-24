import { useCallback, useEffect, useRef } from 'react'
import { midiToFreq } from '../lib/notes'

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
      // Bluetooth のコーデックは静止した純音を苦手とし、サイン波がザラつく。音程を
      // ごく僅か(約4セント/5Hz)揺らして信号を“動かす”とザラつきが消える。耳にはほぼ純音のまま。
      const lfo = ctx.createOscillator()
      lfo.frequency.value = 5
      const lfoDepth = ctx.createGain()
      lfoDepth.gain.value = 4
      lfo.connect(lfoDepth)
      lfoDepth.connect(osc.detune)
      lfo.start()
      // プツプツ(コーデックのザラつき)対策に、高域を削った“暗いノイズ”をごく僅か混ぜる。
      // 白いノイズより耳につきにくい。gain 経由なので無音時は一緒に消える。値は耳で微調整。
      const noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 2), ctx.sampleRate)
      const data = noiseBuf.getChannelData(0)
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
      const noise = ctx.createBufferSource()
      noise.buffer = noiseBuf
      noise.loop = true
      const noiseLP = ctx.createBiquadFilter()
      noiseLP.type = 'lowpass'
      noiseLP.frequency.value = 2500 // 高域を削って“暗く”する(下げるほど大人しい音)
      const noiseLevel = ctx.createGain()
      noiseLevel.gain.value = 0.01 // ノイズの量(耳につくなら下げる)
      noise.connect(noiseLP)
      noiseLP.connect(noiseLevel)
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
