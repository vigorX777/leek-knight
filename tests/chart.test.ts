import { describe, expect, it } from 'vitest'
import { buildChartGeometry, buildLinePath } from '../src/ui/chart'
import type { Candle } from '../src/types'

const candles: Candle[] = [10, 12, 9, 15].map((close, index) => ({
  date: `2026-01-0${index + 1}`,
  open: index === 0 ? close : [10, 12, 9, 15][index - 1],
  high: close + 1,
  low: close - 1,
  close,
  volume: 100,
  amount: 1000,
}))

describe('market chart geometry', () => {
  it('uses every close when creating a yearly sparkline', () => {
    const path = buildLinePath(candles.map((candle) => candle.close), 180, 44)
    expect(path.match(/[ML]/g)).toHaveLength(candles.length)
    expect(path).toMatch(/^M/)
  })

  it('creates candle bars and aligned progress points', () => {
    const chart = buildChartGeometry(candles, 300, 104, 80)
    expect(chart.points).toHaveLength(candles.length)
    expect(chart.bars).toHaveLength(candles.length)
    expect(chart.points[0].x).toBeLessThan(chart.points.at(-1)!.x)
    expect(chart.bars.some((bar) => bar.rising)).toBe(true)
    expect(chart.bars.some((bar) => !bar.rising)).toBe(true)
  })
})
