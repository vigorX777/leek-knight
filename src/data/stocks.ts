import type { StockDataset, StockMetadata } from '../types'

const base = `${import.meta.env.BASE_URL}data/stocks`

export async function loadStockIndex(): Promise<StockMetadata[]> {
  const response = await fetch(`${base}/index.json`)
  if (!response.ok) throw new Error('股票列表加载失败')
  return response.json() as Promise<StockMetadata[]>
}

export async function loadStock(code: string): Promise<StockDataset> {
  const response = await fetch(`${base}/${code}.json`)
  if (!response.ok) throw new Error(`${code} 行情数据加载失败`)
  const data = await response.json() as StockDataset
  if (data.candles.length < 80) throw new Error(`${code} 行情数据不足`)
  return data
}
