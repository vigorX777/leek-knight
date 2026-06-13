import { describe, expect, it } from 'vitest'
import { generateTrack, interpolateTrackY } from '../src/game/track'
import type { Candle } from '../src/types'

function candles(closes: number[]): Candle[] {
  return closes.map((close, index) => ({
    date: `2026-01-${String(index + 1).padStart(2, '0')}`,
    open: index === 0 ? close : closes[index - 1],
    high: close * 1.02,
    low: close * 0.98,
    close,
    volume: 1000,
    amount: 10000,
  }))
}

describe('track generation', () => {
  it('turns rising prices into an uphill screen direction', () => {
    const track = generateTrack(candles([100, 102, 104, 106, 108, 110]))
    expect(track.points.at(-1)!.y).toBeLessThan(track.points[0].y)
  })

  it('creates deterministic custom-interval settlements from raw closes', () => {
    const data = candles([100, 101, 102, 103, 104, 110, 108, 107, 109, 112, 121])
    const track = generateTrack(data, 5)
    expect(track.settlements).toHaveLength(2)
    expect(track.settlements[0].returnRate).toBeCloseTo(0.1)
    expect(track.settlements[1].returnRate).toBeCloseTo(0.1)
    expect(generateTrack(data, 5)).toEqual(track)
  })

  it('settles a trailing partial interval through the final trading day', () => {
    const data = candles([100, 101, 102, 103, 104, 105, 106, 107])
    const track = generateTrack(data, 5)
    expect(track.settlements).toHaveLength(2)
    expect(track.settlements[1].startIndex).toBe(5)
    expect(track.settlements[1].endIndex).toBe(7)
  })

  it('uses a wider default settlement interval and marks jump coins', () => {
    const data = candles(Array.from({ length: 28 }, (_, index) => 100 + index))
    const track = generateTrack(data)

    expect(track.settlements).toHaveLength(4)
    expect(track.settlements[0].endIndex).toBe(8)
    expect(track.settlements[1].endIndex).toBe(16)
    expect(track.settlements[2].requiresJump).toBe(true)
    expect(track.settlements[2].y).toBeLessThan(track.settlements[2].terrainY - 100)
    expect(track.settlements[0].pickupRadius).toBeGreaterThan(track.settlements[2].pickupRadius)
  })

  it('limits extreme daily terrain changes', () => {
    const track = generateTrack(candles([100, 200, 20, 100, 10, 90]))
    for (let index = 1; index < track.points.length; index += 1) {
      expect(Math.abs(track.points[index].y - track.points[index - 1].y)).toBeLessThanOrEqual(160)
    }
  })

  it('creates a gentle launch section before volatile terrain', () => {
    const track = generateTrack(candles([100, 200, 20, 100, 10, 90, 9, 80, 8, 70, 7, 60]))
    const launchDeltas = track.points.slice(1, 5).map((point, index) => (
      Math.abs(point.y - track.points[index].y)
    ))

    expect(Math.max(...launchDeltas)).toBeLessThan(150)
    expect(track.points).toHaveLength(12)
  })

  it('preserves every local close-price turning point after the launch section', () => {
    const data = candles([100, 102, 105, 103, 108, 104, 110, 107, 112, 109, 115, 111])
    const track = generateTrack(data)

    for (let index = 7; index < data.length - 1; index += 1) {
      const priceDirectionBefore = Math.sign(data[index].close - data[index - 1].close)
      const priceDirectionAfter = Math.sign(data[index + 1].close - data[index].close)
      const terrainDirectionBefore = Math.sign(track.points[index].y - track.points[index - 1].y)
      const terrainDirectionAfter = Math.sign(track.points[index + 1].y - track.points[index].y)
      expect(terrainDirectionBefore).toBe(-priceDirectionBefore)
      expect(terrainDirectionAfter).toBe(-priceDirectionAfter)
    }
  })

  it('interpolates between terrain points', () => {
    const track = generateTrack(candles([100, 102, 104]))
    const left = track.points[0]
    const right = track.points[1]
    expect(interpolateTrackY(track.points, (left.x + right.x) / 2)).toBeCloseTo((left.y + right.y) / 2)
  })
})
