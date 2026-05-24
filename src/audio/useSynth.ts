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

  // 音量をなめらかな指数カーブで目標へ近づける。直線と違い「角(傾きの急変)」が
  // 出ないので、純粋なサイン波でも“ブツッ”が出にくい。開始前に今の値で固定し、
  // 連打/再発音でも値が飛ばないようにする。tau は時定数(大きいほどゆっくり)。
  const rampGain = useCallback((target: number, tau: number) => {
    const ctx = ctxRef.current
    const gain = gainRef.current
    if (!ctx || !gain) return
    const now = ctx.currentTime
    const p = gain.gain
    p.cancelScheduledValues(now)
    p.setValueAtTime(p.value, now)
    p.setTargetAtTime(target, now, tau)
  }, [])

  const noteOn = useCallback(
    (midi: number) => {
      ensure()
      midiRef.current = midi
      applyFreq()
      rampGain(0.18, 0.012)
    },
    [ensure, applyFreq, rampGain],
  )

  const noteOff = useCallback(() => {
    rampGain(0, 0.09)
  }, [rampGain])

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
