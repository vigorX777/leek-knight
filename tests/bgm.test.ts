import { describe, expect, it } from 'vitest'
import { BGM_PATTERN_STEPS, getBgmStep } from '../src/game/bgm'

describe('procedural BGM pattern', () => {
  it('loops over a fixed 16-step chiptune pattern', () => {
    expect(BGM_PATTERN_STEPS).toBe(16)
    expect(getBgmStep(0)).toEqual(getBgmStep(16))
  })

  it('contains melody, bass, and percussion cues', () => {
    const steps = Array.from({ length: BGM_PATTERN_STEPS }, (_, index) => getBgmStep(index))

    expect(steps.some((step) => step.melodyFrequency !== null)).toBe(true)
    expect(steps.some((step) => step.bassFrequency !== null)).toBe(true)
    expect(steps.some((step) => step.kick)).toBe(true)
    expect(steps.some((step) => step.snare)).toBe(true)
    expect(steps.some((step) => step.hat)).toBe(true)
  })

  it('adds a higher arpeggio layer when hype is active', () => {
    const base = getBgmStep(2, 0)
    const hyped = getBgmStep(2, 3)

    expect(base.arpFrequency).toBeNull()
    expect(hyped.arpFrequency).toBeGreaterThan(hyped.melodyFrequency ?? 0)
  })
})
