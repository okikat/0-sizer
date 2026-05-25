import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { WaveFrame, PitchFrame, FineFrame, EnvModule, FilterFrame, KeyboardModule, type SoundCtl } from './modules'
import type { FrameId } from './lessons'

export type Rect = { left: number; top: number; width: number; height: number }
export interface Flyer {
  id: FrameId
  start: Rect
  dest: Rect
}
/** hover=定位置の少し上で浮く / glide=ゆっくり定位置へ / seat=ぴったり着座して消える */
export type FlightPhase = 'hover' | 'glide' | 'seat'

/** 飛翔ピースの中身。盤面と同じコンパクト形で描画する（盤面のスロット用CSSを流用）。 */
function FrameCompact({ id, sound }: { id: FrameId; sound: SoundCtl }) {
  switch (id) {
    case 'keys':
      return <KeyboardModule onNoteOn={sound.onNoteOn} onNoteOff={sound.onNoteOff} showLabels={false} />
    case 'wave':
      return <WaveFrame compact type={sound.type} onType={sound.onType} playing={sound.playing} />
    case 'pitch':
      return <PitchFrame compact showText={false} onTune={sound.onTune} fine={sound.fine} />
    case 'fine':
      return <FineFrame fine={sound.fine} onToggleFine={sound.onToggleFine} />
    case 'env':
      return <EnvModule compact env={sound.env} onEnvChange={sound.onEnvChange} fine={sound.fine} />
    case 'filter':
      return <FilterFrame compact showText={false} onCutoff={sound.onCutoff} onRes={sound.onRes} fine={sound.fine} />
    default:
      return null
  }
}

function FlyerView({ f, phase, sound }: { f: Flyer; phase: FlightPhase; sound: SoundCtl }) {
  // マウント直後にひと呼吸おいて「浮き上がり」を見せる。
  const [entered, setEntered] = useState(false)
  useEffect(() => {
    const r = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(r)
  }, [])

  const dx = f.dest.left - f.start.left
  const dy = f.dest.top - f.start.top
  const sc = f.start.width ? f.dest.width / f.start.width : 1

  let transform: string
  if (phase === 'hover') transform = entered ? 'translateY(-10px)' : 'translateY(0)'
  else transform = `translate(${dx}px, ${dy}px) scale(${sc})` // glide & seat は定位置へ
  const opacity = phase === 'hover' ? (entered ? 1 : 0) : phase === 'seat' ? 0 : 1

  const style: CSSProperties = {
    left: f.start.left,
    top: f.start.top,
    width: f.start.width,
    height: f.start.height,
    transform,
    opacity,
  }
  return (
    <div className={'flyer flyer-' + phase} style={style}>
      <div className={'slot slot-' + f.id + ' filled flyer-slot'}>
        <FrameCompact id={f.id} sound={sound} />
      </div>
    </div>
  )
}

/** チュートリアル完了後、各モジュールが定位置へ取り付いていく様子を描く層。 */
export function FlightLayer({ flyers, phase, sound }: { flyers: Flyer[]; phase: FlightPhase; sound: SoundCtl }) {
  return (
    <div className="flight-layer">
      {flyers.map((f) => (
        <FlyerView key={f.id} f={f} phase={phase} sound={sound} />
      ))}
    </div>
  )
}
