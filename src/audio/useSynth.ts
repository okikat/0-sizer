import { useCallback, useEffect, useRef } from 'react'
import { midiToFreq } from '../lib/notes'

// 純音(サイン波)は周波数成分が1本しかなく、Bluetooth のコーデックが扱いを誤って
// プツプツとザラつくことがある。そこで「サイン」だけはごく僅かな倍音を加えた波形にして
// スペクトルに厚みを持たせ、コーデックが正常に働くようにする。耳にはほぼサイン波のまま。
// 値は imag[n] = n 倍音の量(0:DC, 1:基音, 2:2倍音, 3:3倍音)。耳で微調整できる。
const SINE_PARTIALS = [0, 1, 0.08, 0.04]

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
  const sineWaveRef = useRef<PeriodicWave | null>(null)

  // サインのときだけ倍音入りの自作波形、それ以外は標準の波形を使う。
  const applyType = useCallback((osc: OscillatorNode, t: OscillatorType) => {
    if (t === 'sine' && sineWaveRef.current) osc.setPeriodicWave(sineWaveRef.current)
    else osc.type = t
  }, [])

  const ensure = useCallback(() => {
    if (!ctxRef.current) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const ctx = new Ctor()
      sineWaveRef.current = ctx.createPeriodicWave(
        new Float32Array(SINE_PARTIALS.length),
        new Float32Array(SINE_PARTIALS),
      )
      const gain = ctx.createGain()
      gain.gain.value = 0
      gain.connect(ctx.destination)
      const osc = ctx.createOscillator()
      applyType(osc, typeRef.current)
      osc.frequency.value = 440
      osc.connect(gain)
      osc.start()
      ctxRef.current = ctx
      gainRef.current = gain
      oscRef.current = osc
    }
    if (ctxRef.current.state === 'suspended') void ctxRef.current.resume()
  }, [applyType])

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

  const setWaveform = useCallback(
    (t: OscillatorType) => {
      typeRef.current = t
      if (oscRef.current) applyType(oscRef.current, t)
    },
    [applyType],
  )

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
