import { useCallback, useEffect, useRef } from 'react'
import { midiToFreq } from '../lib/notes'

// AudioParam をなめらかな指数カーブで target へ寄せ、十分に到達したら値を固定する。
// setTargetAtTime は目標へ「永久に近づき続ける」自動化なので、固定しないとロングトーン中も
// 極小値(denormal)の計算が走り続け、不定期な“ブツッ”ノイズの原因になる。tau*10 後にはほぼ
// 到達済み(誤差 ~0.005%)なので、そこで setValueAtTime して自動化を止め一定値に張り付かせる。
function glide(p: AudioParam, target: number, tau: number, now: number) {
  p.cancelScheduledValues(now)
  p.setTargetAtTime(target, now, tau)
  p.setValueAtTime(target, now + tau * 10)
}

// Bluetooth コーデックは“純音(静止した単一周波数)”を苦手とし、サイン波だとザラつく。
// 対策として「信号を少しだけ動かす/濁す」ことで、コーデックが正常に働きザラつきが目立たなくなる。
// いずれも耳で微調整する前提の控えめな値。
const VIBRATO_HZ = 5 // ピッチ揺れの速さ(Hz)
const VIBRATO_CENTS = 4 // ピッチ揺れの深さ(セント)。半音=100セント。小さいほど純音寄り
const NOISE_LEVEL = 0.006 // 混ぜるホワイトノイズの量。音に対して十分小さいヒス

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

      // (1) ピッチをごく小さく揺らす LFO → 信号が静止しなくなりコーデックが安定する。
      const lfo = ctx.createOscillator()
      lfo.frequency.value = VIBRATO_HZ
      const lfoDepth = ctx.createGain()
      lfoDepth.gain.value = VIBRATO_CENTS
      lfo.connect(lfoDepth)
      lfoDepth.connect(osc.detune)
      lfo.start()

      // (2) 微量ホワイトノイズ(ディザ)を同じエンベロープ経由で混ぜる → 量子化のジャリつきを
      //     やさしいヒスに置き換える。gain 経由なので無音時はノイズも消える。
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
    // モバイル(特に iOS)は suspended だけでなく interrupted になることがあるので、
    // running 以外なら必ず再開する。resume はユーザー操作(noteOn)の中で呼ぶ必要がある。
    if (ctxRef.current.state !== 'running') void ctxRef.current.resume()
  }, [])

  const applyFreq = useCallback(() => {
    const ctx = ctxRef.current
    const osc = oscRef.current
    if (ctx && osc && midiRef.current != null) {
      const f = midiToFreq(midiRef.current) * Math.pow(2, tuneRef.current / 12)
      glide(osc.frequency, f, 0.006, ctx.currentTime)
    }
  }, [])

  const noteOn = useCallback(
    (midi: number) => {
      ensure()
      midiRef.current = midi
      applyFreq()
      const ctx = ctxRef.current!
      glide(gainRef.current!.gain, 0.18, 0.012, ctx.currentTime)
    },
    [ensure, applyFreq],
  )

  const noteOff = useCallback(() => {
    const ctx = ctxRef.current
    const gain = gainRef.current
    if (ctx && gain) glide(gain.gain, 0, 0.09, ctx.currentTime)
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
