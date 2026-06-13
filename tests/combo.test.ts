import { describe, expect, it } from 'vitest'
import { getComboMultiplier, settleBalance } from '../src/game/balance'
import { getJumpForce } from '../src/game/bikeControl'

type ComboState = {
  gain: number
  loss: number
}

function collectCombo(state: ComboState, kind: keyof ComboState): ComboState {
  if (kind === 'gain') return { gain: state.gain + 1, loss: 0 }
  return { gain: 0, loss: state.loss + 1 }
}

describe('combo multiplier', () => {
  it('returns 1.0 for combo 0 or 1 (no bonus)', () => {
    expect(getComboMultiplier(0)).toBe(1.0)
    expect(getComboMultiplier(1)).toBe(1.0)
  })

  it('returns correct multipliers for each combo tier', () => {
    expect(getComboMultiplier(2)).toBe(1.1)
    expect(getComboMultiplier(3)).toBe(1.2)
    expect(getComboMultiplier(4)).toBe(1.4)
    expect(getComboMultiplier(5)).toBe(1.6)
    expect(getComboMultiplier(6)).toBe(1.8)
    expect(getComboMultiplier(7)).toBe(2.0)
  })

  it('caps at 2.5 for combo 8 and above', () => {
    expect(getComboMultiplier(8)).toBe(2.5)
    expect(getComboMultiplier(15)).toBe(2.5)
    expect(getComboMultiplier(100)).toBe(2.5)
  })

  it('throws for invalid combo values', () => {
    expect(() => getComboMultiplier(-1)).toThrow('Invalid combo')
    expect(() => getComboMultiplier(1.5)).toThrow('Invalid combo')
    expect(() => getComboMultiplier(Number.NaN)).toThrow('Invalid combo')
    expect(() => getComboMultiplier(Number.POSITIVE_INFINITY)).toThrow('Invalid combo')
  })
})

describe('settleBalance with combo', () => {
  it('applies combo multiplier to return rate', () => {
    const result = settleBalance(100_000, 0.05, 2.0)
    expect(result).toBeCloseTo(110_000)
  })

  it('composes getComboMultiplier with settlement', () => {
    const result = settleBalance(100_000, 0.05, getComboMultiplier(4))
    expect(result).toBeCloseTo(107_000)
  })

  it('defaults to multiplier 1.0 when not provided', () => {
    expect(settleBalance(100_000, 0.1)).toBeCloseTo(110_000)
  })

  it('amplifies losses with combo multiplier', () => {
    const result = settleBalance(100_000, -0.05, 2.0)
    expect(result).toBeCloseTo(90_000)
  })

  it('rejects extreme losses below -1', () => {
    expect(() => settleBalance(10_000, -2, 1.0)).toThrow('Invalid return rate')
  })

  it('rejects negative combo multiplier', () => {
    expect(() => settleBalance(100, 0.1, -1)).toThrow()
  })

  it('floors balance at 0 even with extreme combo loss', () => {
    const result = settleBalance(10_000, -0.9, 2.5)
    expect(result).toBe(0)
  })
})

describe('combo window logic (pure)', () => {
  it('resets multiplier to 1.0 when combo expires', () => {
    expect(getComboMultiplier(0)).toBe(1.0)
  })

  it('multiplier grows with consecutive collections within window', () => {
    const m1 = getComboMultiplier(1)
    const m2 = getComboMultiplier(2)
    const m3 = getComboMultiplier(3)
    expect(m1).toBe(1.0)
    expect(m2).toBeGreaterThan(m1)
    expect(m3).toBeGreaterThan(m2)
  })

  it('multiplier caps at 2.5 regardless of combo count', () => {
    expect(getComboMultiplier(50)).toBe(2.5)
  })
})

describe('dual combo mutual exclusion', () => {
  it('gain collection resets loss combo to 0', () => {
    const afterLossRun = { gain: 0, loss: 3 }
    const next = collectCombo(afterLossRun, 'gain')

    expect(next).toEqual({ gain: 1, loss: 0 })
    expect(getComboMultiplier(next.gain)).toBe(1.0)
    expect(getComboMultiplier(next.loss)).toBe(1.0)
  })

  it('loss collection resets gain combo to 0', () => {
    const afterGainRun = { gain: 4, loss: 0 }
    const next = collectCombo(afterGainRun, 'loss')

    expect(next).toEqual({ gain: 0, loss: 1 })
    expect(getComboMultiplier(next.gain)).toBe(1.0)
    expect(getComboMultiplier(next.loss)).toBe(1.0)
  })
})

describe('getJumpForce', () => {
  it('returns base velocity at zero speed', () => {
    expect(getJumpForce(0)).toBe(8)
  })

  it('increases with speed', () => {
    expect(getJumpForce(14)).toBeGreaterThan(getJumpForce(2))
  })

  it('caps at base plus maximum speed bonus', () => {
    expect(getJumpForce(18)).toBeCloseTo(13)
    expect(getJumpForce(180)).toBeCloseTo(13)
  })
})
