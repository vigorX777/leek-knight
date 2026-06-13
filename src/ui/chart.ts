import type { Candle } from '../types'

export interface ChartPoint {
  x: number
  y: number
}

export interface CandleBar {
  x: number
  openY: number
  closeY: number
  highY: number
  lowY: number
  rising: boolean
}

export interface ChartGeometry {
  linePath: string
  points: ChartPoint[]
  bars: CandleBar[]
}

function scaleY(value: number, min: number, max: number, height: number, padding: number): number {
  if (max === min) return height / 2
  return padding + (max - value) / (max - min) * (height - padding * 2)
}

export function buildLinePath(values: number[], width: number, height: number, padding = 3): string {
  if (values.length === 0) return ''
  const min = Math.min(...values)
  const max = Math.max(...values)
  return values.map((value, index) => {
    const x = values.length === 1 ? width / 2 : padding + index / (values.length - 1) * (width - padding * 2)
    const y = scaleY(value, min, max, height, padding)
    return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`
  }).join(' ')
}

export function buildChartGeometry(candles: Candle[], width: number, height: number, maxBars = 72, padding = 8): ChartGeometry {
  if (candles.length === 0) return { linePath: '', points: [], bars: [] }
  const min = Math.min(...candles.map((candle) => candle.low))
  const max = Math.max(...candles.map((candle) => candle.high))
  const points = candles.map((candle, index) => ({
    x: candles.length === 1 ? width / 2 : padding + index / (candles.length - 1) * (width - padding * 2),
    y: scaleY(candle.close, min, max, height, padding),
  }))
  const step = Math.max(1, Math.ceil(candles.length / maxBars))
  const bars = candles.flatMap((candle, index) => {
    if (index % step !== 0 && index !== candles.length - 1) return []
    return [{
      x: points[index].x,
      openY: scaleY(candle.open, min, max, height, padding),
      closeY: scaleY(candle.close, min, max, height, padding),
      highY: scaleY(candle.high, min, max, height, padding),
      lowY: scaleY(candle.low, min, max, height, padding),
      rising: candle.close >= candle.open,
    }]
  })
  const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ')
  return { linePath, points, bars }
}
