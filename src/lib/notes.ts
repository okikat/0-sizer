const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

/** MIDI ノート番号 → 周波数(Hz)。A4(69)=440Hz を基準に半音=2^(1/12)。 */
export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

/** 周波数(Hz) → 最も近い音名（例: 440 → "A4"）。 */
export function noteName(freq: number): string {
  const n = Math.round(12 * Math.log2(freq / 440)) + 69
  return NAMES[((n % 12) + 12) % 12] + (Math.floor(n / 12) - 1)
}
