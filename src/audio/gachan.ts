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

/**
 * 着座の「カチャ」。ガチャンより控えめで短い、樹脂＋金属が嵌まる小さなクリック音。
 */
export function playSeatClick(ctx: AudioContext): void {
  try {
    if (ctx.state !== 'running') return
    const t = ctx.currentTime

    // 短い帯域通過ノイズの小さなクリック（「カチ」）
    const bufLen = Math.floor(ctx.sampleRate * 0.02)
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < bufLen; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufLen)
    const noiseSrc = ctx.createBufferSource()
    noiseSrc.buffer = buf
    const bpf = ctx.createBiquadFilter()
    bpf.type = 'bandpass'
    bpf.frequency.value = 2600
    bpf.Q.value = 0.9
    const noiseGain = ctx.createGain()
    noiseGain.gain.setValueAtTime(0.12, t)
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.025)
    noiseSrc.connect(bpf)
    bpf.connect(noiseGain)
    noiseGain.connect(ctx.destination)
    noiseSrc.start(t)
    noiseSrc.stop(t + 0.03)

    // ごく軽い低域の「コッ」（嵌合のあたり）
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(180, t)
    osc.frequency.exponentialRampToValueAtTime(90, t + 0.05)
    const oscGain = ctx.createGain()
    oscGain.gain.setValueAtTime(0.12, t)
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.06)
    osc.connect(oscGain)
    oscGain.connect(ctx.destination)
    osc.start(t)
    osc.stop(t + 0.07)
  } catch {
    // 音声が利用できない環境では無視
  }
}
