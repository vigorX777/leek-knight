export interface BgmStep {
  melodyFrequency: number | null
  bassFrequency: number | null
  arpFrequency: number | null
  kick: boolean
  snare: boolean
  hat: boolean
}

export const BGM_BPM = 148
export const BGM_PATTERN_STEPS = 16
export const BGM_STEP_SECONDS = 60 / BGM_BPM / 2

const melody = [
  659, 784, 988, 784,
  880, 1175, 988, 740,
  659, null, 784, 988,
  1319, 1175, 988, 784,
] as const

const bass = [
  82, null, 82, 110,
  98, null, 98, 123,
  82, null, 82, 110,
  147, null, 123, 98,
] as const

const arp = [1568, 1760, 1976, 2349] as const

export function getBgmStep(stepIndex: number, hype = 0): BgmStep {
  const index = ((stepIndex % BGM_PATTERN_STEPS) + BGM_PATTERN_STEPS) % BGM_PATTERN_STEPS
  const melodyFrequency = melody[index]
  const bassFrequency = bass[index]
  const hasHype = hype >= 2 && index % 2 === 0

  return {
    melodyFrequency,
    bassFrequency,
    arpFrequency: hasHype ? arp[(index / 2) % arp.length] : null,
    kick: index % 4 === 0,
    snare: index === 4 || index === 12,
    hat: index % 2 === 1,
  }
}
