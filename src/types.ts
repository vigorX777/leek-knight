export interface Candle {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
  amount: number
}

export interface StockMetadata {
  code: string
  name: string
  exchange: 'SH' | 'SZ'
  sector: string
  difficulty: 'EASY' | 'MEDIUM' | 'HARD'
  dataStart: string
  dataEnd: string
  tradingDays: number
  oneYearReturn: number
  volatility: number
  maxDrawdown: number
}

export interface StockDataset {
  metadata: StockMetadata
  source: string
  generatedAt: string
  adjustment: 'qfq'
  candles: Candle[]
}

export interface TrackPoint {
  x: number
  y: number
  date: string
  close: number
  candleIndex: number
}

export interface SettlementPoint {
  id: string
  x: number
  y: number
  terrainY: number
  pickupRadius: number
  requiresJump: boolean
  startIndex: number
  endIndex: number
  startDate: string
  endDate: string
  returnRate: number
  settled: boolean
}

export interface GeneratedTrack {
  points: TrackPoint[]
  settlements: SettlementPoint[]
  worldWidth: number
  minY: number
  maxY: number
}

export interface RunResult {
  reason: 'crashed' | 'finished'
  stock: StockMetadata
  initialAmount: number
  finalAmount: number
  progress: number
  date: string
}

export interface ComboSlot {
  count: number
  multiplier: number
  windowUntil: number
}

export interface DualComboState {
  gain: ComboSlot
  loss: ComboSlot
}

export interface HudState {
  balance: number
  returnRate: number
  date: string
  progress: number
  speed: number
  throttle: number
  grounded: boolean
  rearGrounded: boolean
  driveMode: 'drive' | 'coast' | 'brake' | 'reverse'
  leanAxis: -1 | 0 | 1
  chassisAngle: number
  nextSettlementDate: string | null
  settlementProgress: number
  combo: DualComboState
  frozenUntil: number
}
