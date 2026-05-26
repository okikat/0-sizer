import type { CSSProperties } from 'react'
import { Popup } from './Popup'
import { WaveFrame, PitchFrame, FineFrame, SnapFrame, EnvModule, FilterFrame, LfoFrame, MixFrame, Osc2Frame, NoiseFrame, DelayFrame, GlideFrame, FilterEnvFrame, KeyboardModule, type SoundCtl } from './modules'
import type { Lesson, FrameId } from './lessons'

export interface FrameFlight {
  s: number
  tx: number
  ty: number
}
export type ExitPhase = 'morph' | 'hover' | 'glide' | 'seat'

interface Props {
  lesson: Lesson
  /** null = 通常表示。OK後 morph→hover→glide→seat の順でその場で進む（要素は同じまま）。 */
  exitPhase: ExitPhase | null
  /** フレームごとの飛翔データ（縮小率と定位置への移動量）。 */
  flights: Record<string, FrameFlight>
  popupOpen: boolean
  onClosePopup: () => void
  onHelp: () => void
  onOK: () => void
  sound: SoundCtl
}

/**
 * スポットライト面。OK を押すと、その場で「パネル収まり後の形」へモーフ（WAVEは計器が畳まれる）。
 * モーフ完了後、同じ要素のまま少し浮いて、ゆっくり定位置へ移動し、適正サイズで着座する。
 * 飛ぶのはステージ上のフレーム自身なので、別レイヤーへの受け渡しによる段差が出ない。
 */
export function LessonStage({ lesson, exitPhase, flights, popupOpen, onClosePopup, onHelp, onOK, sound }: Props) {
  const exiting = exitPhase !== null

  // フレームごとの transform（morph=その場で縮小／hover=少し浮く／glide・seat=定位置へ）。
  const frameProps = (id: FrameId): { className: string; style?: CSSProperties } => {
    const fl = flights[id]
    if (!exiting || !fl) return { className: 'stage-frame' }
    let transform: string
    if (exitPhase === 'morph') transform = `scale(${fl.s})`
    else if (exitPhase === 'hover') transform = `translate(0px, -10px) scale(${fl.s})`
    else transform = `translate(${fl.tx}px, ${fl.ty}px) scale(${fl.s})`
    return { className: 'stage-frame f-' + exitPhase, style: { transform, opacity: exitPhase === 'seat' ? 0 : 1 } }
  }

  const content = () => {
    if (lesson.id === 'keys')
      return (
        <div data-stage-frame="keys" {...frameProps('keys')}>
          <KeyboardModule onNoteOn={sound.onNoteOn} onNoteOff={sound.onNoteOff} showLabels={!exiting} />
        </div>
      )
    if (lesson.id === 'wave')
      return (
        <div data-stage-frame="wave" {...frameProps('wave')}>
          <WaveFrame morphing={exiting} type={sound.type} onType={sound.onType} playing={sound.playing} />
        </div>
      )
    if (lesson.id === 'env')
      return (
        <div data-stage-frame="env" {...frameProps('env')}>
          <EnvModule compact env={sound.env} onEnvChange={sound.onEnvChange} fine={sound.fine} snap={sound.snap} />
        </div>
      )
    if (lesson.id === 'filter')
      return (
        <div data-stage-frame="filter" {...frameProps('filter')}>
          <FilterFrame cutoff={sound.cutoff} onCutoff={sound.onCutoff} res={sound.res} onRes={sound.onRes} fine={sound.fine} snap={sound.snap} morphing={exiting} />
        </div>
      )
    if (lesson.id === 'lfo')
      return (
        <div data-stage-frame="lfo" {...frameProps('lfo')}>
          <LfoFrame lfoRate={sound.lfoRate} onLfoRate={sound.onLfoRate} lfoDepth={sound.lfoDepth} onLfoDepth={sound.onLfoDepth} lfoDest={sound.lfoDest} onLfoDest={sound.onLfoDest} fine={sound.fine} snap={sound.snap} morphing={exiting} />
        </div>
      )
    if (lesson.id === 'mix')
      return (
        <div data-stage-frame="mix" {...frameProps('mix')}>
          <MixFrame onVol={sound.onVol} onPan={sound.onPan} fine={sound.fine} snap={sound.snap} morphing={exiting} />
        </div>
      )
    if (lesson.id === 'osc2') {
      // パネル装着時の拡大版：パネルと同じ「箱（slot）」スタイルで、ただし大きく見せる。
      // OK後は値LEDが畳まれ、枠も上に縮んで、パネル装着時の比率になってから移動。
      const fp = frameProps('osc2')
      return (
        <div data-stage-frame="osc2" className={fp.className + ' slot slot-osc2 filled stage-osc2'} style={fp.style}>
          <Osc2Frame compact showText morphing={exiting} mix={sound.mix} onMix={sound.onMix} detune={sound.detune} onDetune={sound.onDetune} fine={sound.fine} snap={sound.snap} />
        </div>
      )
    }
    if (lesson.id === 'noise') {
      const fp = frameProps('noise')
      return (
        <div data-stage-frame="noise" className={fp.className + ' slot slot-noise filled stage-noise'} style={fp.style}>
          <NoiseFrame compact showText morphing={exiting} noise={sound.noise} onNoise={sound.onNoise} fine={sound.fine} snap={sound.snap} />
        </div>
      )
    }
    if (lesson.id === 'delay') {
      const fp = frameProps('delay')
      return (
        <div data-stage-frame="delay" className={fp.className + ' slot slot-delay filled stage-delay'} style={fp.style}>
          <DelayFrame compact showText morphing={exiting} delayTime={sound.delayTime} onDelayTime={sound.onDelayTime} delayMix={sound.delayMix} onDelayMix={sound.onDelayMix} fine={sound.fine} snap={sound.snap} />
        </div>
      )
    }
    if (lesson.id === 'glide') {
      const fp = frameProps('glide')
      return (
        <div data-stage-frame="glide" className={fp.className + ' slot slot-glide filled stage-glide'} style={fp.style}>
          <GlideFrame compact showText morphing={exiting} glide={sound.glide} onGlide={sound.onGlide} fine={sound.fine} snap={sound.snap} />
        </div>
      )
    }
    if (lesson.id === 'fenv') {
      const fp = frameProps('fenv')
      return (
        <div data-stage-frame="fenv" className={fp.className + ' slot slot-fenv filled stage-fenv'} style={fp.style}>
          <FilterEnvFrame compact showText morphing={exiting} fenvAmt={sound.fenvAmt} onFenvAmt={sound.onFenvAmt} fenvDecay={sound.fenvDecay} onFenvDecay={sound.onFenvDecay} fine={sound.fine} snap={sound.snap} />
        </div>
      )
    }
    return (
      <div className="pitch-cluster">
        <div data-stage-frame="pitch" {...frameProps('pitch')}>
          <PitchFrame onTune={sound.onTune} fine={sound.fine} snap={sound.snap} morphing={exiting} />
        </div>
        <div className="fine-snap-col">
          <div data-stage-frame="fine" {...frameProps('fine')}>
            <FineFrame fine={sound.fine} onToggleFine={sound.onToggleFine} />
          </div>
          <div data-stage-frame="snap" {...frameProps('snap')}>
            <SnapFrame snap={sound.snap} onToggleSnap={sound.onToggleSnap} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={'stage-layer' + (exiting ? ' leaving' : ' fade-in')}>
      <div className={'stage-module' + (exiting ? ' exiting' : ' enter')} data-stage-module>
        <button className="help-btn" onClick={onHelp} aria-label="ヒントをもう一度見る">
          ?
        </button>
        {content()}
      </div>

      {lesson.id !== 'keys' && (
        <div className="stage-keys">
          <KeyboardModule onNoteOn={sound.onNoteOn} onNoteOff={sound.onNoteOff} />
        </div>
      )}

      <button className="ok-btn" onClick={onOK}>
        OK
      </button>

      {popupOpen && !exiting && <Popup title={lesson.stageTitle} paragraphs={lesson.popup} onClose={onClosePopup} />}
    </div>
  )
}
