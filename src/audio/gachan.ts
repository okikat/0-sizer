/**
 * 「ガチャン！」衝撃音。
 * 帯域通過ノイズ(高域)＋周波数急降下オシレーター(低域)で金属打撃音を合成する。
 * 音声ファイルは使わず Web Audio API のみで生成。
 */
export function playGachanSound(ctx: AudioContext): void {
  try {
    if (ctx.state !== 'running') return
    const t = ctx.currentTime

    // 高域：「カ」のアタック成分（帯域通過ノイズ）
    const bufLen = Math.floor(ctx.sampleRate * 0.04)
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < bufLen; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufLen)
    const noiseSrc = ctx.createBufferSource()
    noiseSrc.buffer = buf
    const bpf = ctx.createBiquadFilter()
    bpf.type = 'bandpass'
    bpf.frequency.value = 4500
    bpf.Q.value = 1.2
    const noiseGain = ctx.createGain()
    noiseGain.gain.setValueAtTime(0.28, t)
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.04)
    noiseSrc.connect(bpf)
    bpf.connect(noiseGain)
    noiseGain.connect(ctx.destination)
    noiseSrc.start(t)
    noiseSrc.stop(t + 0.05)

    // 低域：「チャク」の打撃成分（周波数が急降下するオシレーター）
    const osc = ctx.createOscillator()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(220, t)
    osc.frequency.exponentialRampToValueAtTime(55, t + 0.08)
    const oscGain = ctx.createGain()
    oscGain.gain.setValueAtTime(0.32, t)
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.09)
    osc.connect(oscGain)
    oscGain.connect(ctx.destination)
    osc.start(t)
    osc.stop(t + 0.1)
  } catch {
    // 音声が利用できない環境では無視
  }
}
