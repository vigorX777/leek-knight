export function getComboMultiplier(combo: number): number {
  if (!Number.isInteger(combo) || combo < 0) throw new Error('Invalid combo')
  if (combo <= 1) return 1.0
  if (combo === 2) return 1.1
  if (combo === 3) return 1.2
  if (combo === 4) return 1.4
  if (combo === 5) return 1.6
  if (combo === 6) return 1.8
  if (combo === 7) return 2.0
  return 2.5
}

export function settleBalance(balance: number, returnRate: number, comboMultiplier = 1.0): number {
  if (!Number.isFinite(balance) || balance < 0) throw new Error('Invalid balance')
  if (!Number.isFinite(returnRate) || returnRate <= -1) throw new Error('Invalid return rate')
  if (!Number.isFinite(comboMultiplier) || comboMultiplier < 1) throw new Error('Invalid combo multiplier')
  return Math.max(0, balance * (1 + returnRate * comboMultiplier))
}

export function calculateReturn(initialAmount: number, currentAmount: number): number {
  if (initialAmount <= 0) return 0
  return currentAmount / initialAmount - 1
}

export function formatMoney(value: number): string {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatPercent(value: number): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${(value * 100).toFixed(2)}%`
}
