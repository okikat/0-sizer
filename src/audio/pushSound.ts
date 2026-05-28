// SoundState（永続化形式の音色つまみ）→ useSynth() engine への一括反映。
// トラック切替時とプリセット適用時に呼ぶ。SEQ 再生中でも安全。
//
// engine と SoundState を結ぶ唯一の「翻訳機」なので、変換ロジックを足したら
// ここを唯一の入口にする（=App.tsx に変換を散らかさない）。

import {
  cutoffNormToHz,
  resAmtToQ,
  lfoRateToHz,
  detuneAmtToCents,
  mixAmtToBalance,
  noiseAmtToLevel,
  delayTimeAmtToSec,
  delayMixAmtToLevel,
  reverbMixAmtToLevel,
  glideAmtToTau,
  fenvAmtToOctaves,
  fenvDecayAmtToSec,
  volAmtToGain,
  panAmtToPos,
} from './params'
import type { useSynth } from './useSynth'
import type { SoundState } from '../lib/seqStorage'

export function pushSoundToEngine(engine: ReturnType<typeof useSynth>, s: SoundState) {
  engine.setWaveform(s.type)
  engine.setWaveform2(s.osc2Type)
  engine.setFilterType(s.filterType)
  engine.setEnv(s.env)
  engine.setCutoff(cutoffNormToHz(s.cutoff))
  engine.setResonance(resAmtToQ(s.res))
  engine.setLfoRate(lfoRateToHz(s.lfoRate))
  engine.setLfoDepth(s.lfoDepth)
  engine.setLfoDest(s.lfoDest)
  engine.setDetune(detuneAmtToCents(s.detune))
  engine.setOsc2Oct(s.osc2Oct)
  engine.setMix(mixAmtToBalance(s.mix))
  engine.setNoise(noiseAmtToLevel(s.noise))
  engine.setDelayTime(delayTimeAmtToSec(s.delayTime))
  engine.setDelayMix(delayMixAmtToLevel(s.delayMix))
  engine.setGlideTime(glideAmtToTau(s.glide))
  engine.setFilterEnv(fenvAmtToOctaves(s.fenvAmt), fenvDecayAmtToSec(s.fenvDecay))
  engine.setReverbMix(reverbMixAmtToLevel(s.reverb))
  engine.setMasterVol(volAmtToGain(s.vol))
  engine.setPan(panAmtToPos(s.pan))
}
