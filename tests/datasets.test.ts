import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { settleBalance } from '../src/game/balance'
import { generateTrack } from '../src/game/track'
import type { StockDataset, StockMetadata } from '../src/types'

const dataRoot = path.resolve('public/data/stocks')
const index = JSON.parse(fs.readFileSync(path.join(dataRoot, 'index.json'), 'utf8')) as StockMetadata[]

describe('frozen A-share datasets', () => {
  it('contains 20 complete and playable tracks', () => {
    expect(index).toHaveLength(20)
    for (const metadata of index) {
      const dataset = JSON.parse(fs.readFileSync(path.join(dataRoot, `${metadata.code}.json`), 'utf8')) as StockDataset
      expect(dataset.candles).toHaveLength(250)
      const track = generateTrack(dataset.candles)
      expect(track.points).toHaveLength(250)
      expect(track.settlements.at(-1)?.endIndex).toBe(249)
      expect(track.worldWidth).toBeGreaterThan(10_000)
      expect(track.points.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y))).toBe(true)
    }
  })

  it('compounds every settlement to the raw first-to-last close return', () => {
    for (const metadata of index) {
      const dataset = JSON.parse(fs.readFileSync(path.join(dataRoot, `${metadata.code}.json`), 'utf8')) as StockDataset
      const track = generateTrack(dataset.candles)
      const finalBalance = track.settlements.reduce((balance, point) => settleBalance(balance, point.returnRate), 100_000)
      const expected = 100_000 * dataset.candles.at(-1)!.close / dataset.candles[0].close
      expect(finalBalance).toBeCloseTo(expected, 6)
    }
  })

  it('does not contain duplicated normalized yearly close series', () => {
    const series = index.map((metadata) => {
      const dataset = JSON.parse(fs.readFileSync(path.join(dataRoot, `${metadata.code}.json`), 'utf8')) as StockDataset
      const first = dataset.candles[0].close
      return dataset.candles.map((candle) => (candle.close / first).toFixed(6)).join(',')
    })
    expect(new Set(series).size).toBe(index.length)
  })
})
