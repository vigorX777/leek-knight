import type { Candle, GeneratedTrack, SettlementPoint, TrackPoint } from '../types'

const X_STEP = 68
const START_X = 260
const START_Y = 520
const RETURN_SCALE = 2800
const MAX_DAILY_DELTA = 160
const LAUNCH_BLEND_POINTS = 4
const DEFAULT_SETTLEMENT_INTERVAL = 8
const TRACK_COIN_OFFSET = 42
const JUMP_COIN_OFFSET = 132

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function addLaunchBlend(values: number[]): number[] {
  const blended = [...values]
  const endIndex = Math.min(LAUNCH_BLEND_POINTS, blended.length - 1)
  const launchY = blended[0]

  for (let index = 0; index <= endIndex; index += 1) {
    const progress = index / endIndex
    const easedProgress = progress * progress * (3 - 2 * progress)
    blended[index] = launchY + (blended[index] - launchY) * easedProgress
  }

  return blended
}

export function interpolateTrackY(points: TrackPoint[], x: number): number {
  if (x <= points[0].x) return points[0].y
  if (x >= points[points.length - 1].x) return points[points.length - 1].y
  const rawIndex = (x - START_X) / X_STEP
  const index = clamp(Math.floor(rawIndex), 0, points.length - 2)
  const left = points[index]
  const right = points[index + 1]
  const ratio = (x - left.x) / (right.x - left.x)
  return left.y + (right.y - left.y) * ratio
}

export function generateTrack(candles: Candle[], settlementInterval = DEFAULT_SETTLEMENT_INTERVAL): GeneratedTrack {
  if (candles.length < 2) throw new Error('At least two candles are required')

  const rawY = [START_Y]
  for (let index = 1; index < candles.length; index += 1) {
    const previous = candles[index - 1].close
    const current = candles[index].close
    const logReturn = Math.log(current / previous)
    const delta = clamp(-logReturn * RETURN_SCALE, -MAX_DAILY_DELTA, MAX_DAILY_DELTA)
    rawY.push(rawY[index - 1] + delta)
  }

  const terrainY = addLaunchBlend(rawY)
  const points: TrackPoint[] = candles.map((candle, index) => ({
    x: START_X + index * X_STEP,
    y: terrainY[index],
    date: candle.date,
    close: candle.close,
    candleIndex: index,
  }))

  const settlements: SettlementPoint[] = []
  const addSettlement = (startIndex: number, endIndex: number): void => {
    const returnRate = candles[endIndex].close / candles[startIndex].close - 1
    const order = settlements.length
    const requiresJump = order > 0 && order % 3 === 2
    const terrainY = points[endIndex].y
    settlements.push({
      id: `${startIndex}-${endIndex}`,
      x: points[endIndex].x,
      y: terrainY - (requiresJump ? JUMP_COIN_OFFSET : TRACK_COIN_OFFSET),
      terrainY,
      pickupRadius: requiresJump ? 15 : 17,
      requiresJump,
      startIndex,
      endIndex,
      startDate: candles[startIndex].date,
      endDate: candles[endIndex].date,
      returnRate,
      settled: false,
    })
  }
  for (let endIndex = settlementInterval; endIndex < candles.length; endIndex += settlementInterval) {
    addSettlement(endIndex - settlementInterval, endIndex)
  }
  const finalIndex = candles.length - 1
  const lastSettledIndex = settlements.at(-1)?.endIndex ?? 0
  if (lastSettledIndex < finalIndex) addSettlement(lastSettledIndex, finalIndex)

  const ys = [...points.map((point) => point.y), ...settlements.map((point) => point.y)]
  return {
    points,
    settlements,
    worldWidth: points[points.length - 1].x + 700,
    minY: Math.min(...ys) - 500,
    maxY: Math.max(...ys) + 900,
  }
}
