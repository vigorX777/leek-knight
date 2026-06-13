import { describe, expect, it } from 'vitest'
import { calculateReturn, settleBalance } from '../src/game/balance'

describe('balance settlement', () => {
  it('compounds positive and negative market returns', () => {
    const afterGain = settleBalance(100_000, 0.1)
    expect(afterGain).toBeCloseTo(110_000)
    expect(settleBalance(afterGain, -0.1)).toBeCloseTo(99_000)
  })

  it('calculates total return against the starting amount', () => {
    expect(calculateReturn(100_000, 125_000)).toBeCloseTo(0.25)
  })

  it('rejects invalid values', () => {
    expect(() => settleBalance(-1, 0.1)).toThrow()
    expect(() => settleBalance(100, -1)).toThrow()
    expect(() => settleBalance(100, -2)).toThrow()
  })
})
