import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchLeaderboard, getPlayerId, submitScore } from '../src/ui/leaderboard'
import { randomName } from '../src/ui/names'

const storage = new Map<string, string>()

Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  },
})

afterEach(() => {
  storage.clear()
  vi.restoreAllMocks()
})

describe('randomName', () => {
  it('generates a 2-12 character Chinese nickname', () => {
    for (let index = 0; index < 20; index += 1) {
      const name = randomName()
      expect(Array.from(name).length).toBeGreaterThanOrEqual(2)
      expect(Array.from(name).length).toBeLessThanOrEqual(12)
      expect(name).toMatch(/^[\p{Script=Han}A-Za-z0-9_]+$/u)
    }
  })
})

describe('leaderboard client', () => {
  it('persists a generated player id', () => {
    const randomUUID = vi.spyOn(crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000001')

    expect(getPlayerId()).toBe('00000000-0000-4000-8000-000000000001')
    expect(getPlayerId()).toBe('00000000-0000-4000-8000-000000000001')
    expect(randomUUID).toHaveBeenCalledTimes(1)
  })

  it('submits scores to the leaderboard endpoint', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      rank: 1,
      total_players: 1,
      percentile: 0,
      is_personal_best: true,
      personal_best: { return_rate: 0.15, rank: 1 },
      top3: [],
    })))

    await expect(submitScore({
      stock_code: '600519',
      stock_name: '贵州茅台',
      player_name: '骑手01',
      player_id: '00000000-0000-4000-8000-000000000001',
      initial: 100_000,
      final: 115_000,
      return_rate: 0.15,
      progress: 1,
    })).resolves.toMatchObject({ rank: 1 })

    expect(fetchMock).toHaveBeenCalledWith('/api/leaderboard', expect.objectContaining({ method: 'POST' }))
  })

  it('queries stock leaderboard with current player marker', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      stock_code: '600519',
      stock_name: '贵州茅台',
      total_players: 0,
      entries: [],
    })))

    await fetchLeaderboard('600519', 50, '00000000-0000-4000-8000-000000000001')

    expect(fetchMock).toHaveBeenCalledWith('/api/leaderboard?stock=600519&player_id=00000000-0000-4000-8000-000000000001&limit=50')
  })

  it('throws structured errors from failed responses', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ error: 'Validation failed' }), { status: 400 }))

    await expect(fetchLeaderboard()).rejects.toThrow('Validation failed')
  })
})
