import { readFileSync } from 'node:fs'
import { DatabaseSync, type SQLInputValue, type StatementSync } from 'node:sqlite'
import { describe, expect, it } from 'vitest'
// @ts-expect-error Pages Functions are deployed as JavaScript and have no declaration file.
import { onRequest, onRequestOptions } from '../functions/api/leaderboard.js'

interface LeaderboardRow {
  id: string
  stock_code: string
  stock_name: string
  player_name: string
  player_id: string
  initial: number
  final: number
  return_rate: number
  progress: number
  created_at: string
}

interface D1Like {
  prepare(sql: string): {
    bind(...args: unknown[]): {
      first(): Promise<Record<string, unknown> | null>
      all(): Promise<{ results: Record<string, unknown>[] }>
    }
  }
}

const schema = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8')

class SqliteD1 implements D1Like {
  readonly database = new DatabaseSync(':memory:')

  constructor() {
    this.database.exec(schema)
  }

  prepare(sql: string) {
    return new SqliteD1Statement(this.database.prepare(sql))
  }

  seed(row: LeaderboardRow) {
    this.database.prepare(
      `INSERT INTO leaderboard (
         id, stock_code, stock_name, player_name, player_id,
         initial, final, return_rate, progress, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      row.id,
      row.stock_code,
      row.stock_name,
      row.player_name,
      row.player_id,
      row.initial,
      row.final,
      row.return_rate,
      row.progress,
      row.created_at,
    )
  }

  rows(): LeaderboardRow[] {
    return this.database.prepare(
      `SELECT id, stock_code, stock_name, player_name, player_id,
              initial, final, return_rate, progress, created_at
       FROM leaderboard
       ORDER BY stock_code ASC, player_id ASC`,
    ).all() as unknown as LeaderboardRow[]
  }

  close() {
    this.database.close()
  }
}

class SqliteD1Statement {
  private args: SQLInputValue[] = []
  private readonly statement: StatementSync

  constructor(statement: StatementSync) {
    this.statement = statement
  }

  bind(...args: unknown[]) {
    this.args = args as SQLInputValue[]
    return this
  }

  async first() {
    return this.statement.get(...this.args) ?? null
  }

  async all() {
    return { results: this.statement.all(...this.args) }
  }
}

const PLAYER_1 = '00000000-0000-4000-8000-000000000001'
const PLAYER_2 = '00000000-0000-4000-8000-000000000002'
const PLAYER_3 = '00000000-0000-4000-8000-000000000003'
const PLAYER_4 = '00000000-0000-4000-8000-000000000004'

function playerId(index: number): string {
  return `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`
}

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    stock_code: '600519',
    stock_name: '贵州茅台',
    player_name: '骑手01',
    player_id: PLAYER_1,
    initial: 100_000,
    final: 115_000,
    return_rate: 0.15,
    progress: 1,
    ...overrides,
  }
}

function seededRow(overrides: Partial<LeaderboardRow> = {}): LeaderboardRow {
  return {
    id: crypto.randomUUID(),
    stock_code: '600519',
    stock_name: '贵州茅台',
    player_name: '骑手01',
    player_id: PLAYER_1,
    initial: 100_000,
    final: 115_000,
    return_rate: 0.15,
    progress: 1,
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

async function callApi(
  db: D1Like,
  method: string,
  options: { body?: unknown; query?: string; rawBody?: string } = {},
) {
  const request = new Request(`https://example.com/api/leaderboard${options.query ?? ''}`, {
    method,
    headers: options.body !== undefined || options.rawBody !== undefined
      ? { 'Content-Type': 'application/json' }
      : undefined,
    body: options.rawBody ?? (options.body === undefined ? undefined : JSON.stringify(options.body)),
  })

  return onRequest({ request, env: { DB: db } })
}

async function json(response: Response) {
  return response.json() as Promise<Record<string, any>>
}

async function withDatabase(run: (db: SqliteD1) => Promise<void>) {
  const db = new SqliteD1()
  try {
    await run(db)
  } finally {
    db.close()
  }
}

describe('leaderboard Pages Function', () => {
  it('rejects a score that did not complete the full track', async () => {
    await withDatabase(async (db) => {
      const response = await callApi(db, 'POST', {
        body: validPayload({ progress: 0.99 }),
      })

      expect(response.status).toBe(400)
      expect(await json(response)).toEqual({ error: 'Validation failed' })
    })
  })

  it('rejects return rates outside the allowed range', async () => {
    await withDatabase(async (db) => {
      expect((await callApi(db, 'POST', { body: validPayload({ return_rate: -1.01, final: -1_000 }) })).status).toBe(400)
      expect((await callApi(db, 'POST', { body: validPayload({ return_rate: 100.01, final: 10_101_000 }) })).status).toBe(400)
    })
  })

  it('rejects nicknames outside the allowed character set after trimming', async () => {
    await withDatabase(async (db) => {
      const response = await callApi(db, 'POST', {
        body: validPayload({ player_name: ' 骑 手 ' }),
      })

      expect(response.status).toBe(400)
    })
  })

  it('rejects non-UUID player identifiers', async () => {
    await withDatabase(async (db) => {
      const response = await callApi(db, 'POST', {
        body: validPayload({ player_id: 'player-00001' }),
      })

      expect(response.status).toBe(400)
      expect(db.rows()).toHaveLength(0)
    })
  })

  it('rejects unsafe stock names and inconsistent final amounts', async () => {
    await withDatabase(async (db) => {
      const unsafeName = await callApi(db, 'POST', {
        body: validPayload({ stock_name: '<b>贵州茅台</b>' }),
      })
      const inconsistentAmount = await callApi(db, 'POST', {
        body: validPayload({ final: 114_000 }),
      })

      expect(unsafeName.status).toBe(400)
      expect(inconsistentAmount.status).toBe(400)
    })
  })

  it('rejects unknown stocks and mismatched stock names', async () => {
    await withDatabase(async (db) => {
      const unknownStock = await callApi(db, 'POST', {
        body: validPayload({ stock_code: '123456', stock_name: '测试股票' }),
      })
      const mismatchedName = await callApi(db, 'POST', {
        body: validPayload({ stock_code: '600519', stock_name: '虚构股票' }),
      })
      const unknownStockQuery = await callApi(db, 'GET', { query: '?stock=123456' })

      expect(unknownStock.status).toBe(400)
      expect(mismatchedName.status).toBe(400)
      expect(unknownStockQuery.status).toBe(400)
      expect(db.rows()).toHaveLength(0)
    })
  })

  it('accepts only canonical stock names for known stock codes', async () => {
    await withDatabase(async (db) => {
      const response = await callApi(db, 'POST', {
        body: validPayload({ stock_code: '300750', stock_name: '宁德时代', return_rate: 0.25, final: 125_000 }),
      })

      expect(response.status).toBe(200)
      expect(db.rows()[0]).toMatchObject({ stock_code: '300750', stock_name: '宁德时代' })
    })
  })

  it('executes the handler UPSERT against the real schema and keeps only the higher score', async () => {
    await withDatabase(async (db) => {
      const first = await callApi(db, 'POST', {
        body: validPayload({ player_name: ' 骑手01 ' }),
      })
      const lower = await callApi(db, 'POST', {
        body: validPayload({ player_name: '不应覆盖', final: 110_000, return_rate: 0.1 }),
      })
      const equal = await callApi(db, 'POST', {
        body: validPayload({ player_name: '同分不覆盖', final: 115_000, return_rate: 0.15 }),
      })
      const equalRows = db.rows()
      const higher = await callApi(db, 'POST', {
        body: validPayload({ player_name: '新骑手', final: 130_000, return_rate: 0.3 }),
      })
      const rows = db.rows()

      expect(first.status).toBe(200)
      expect((await json(lower)).is_personal_best).toBe(false)
      expect((await json(equal)).is_personal_best).toBe(false)
      expect(equalRows[0]).toMatchObject({ player_name: '骑手01', return_rate: 0.15 })
      expect((await json(higher)).is_personal_best).toBe(true)
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({ player_name: '新骑手', final: 130_000, return_rate: 0.3 })
    })
  })

  it('uses competition rank and lower-player percentile for tied best scores', async () => {
    await withDatabase(async (db) => {
      db.seed(seededRow({
        player_id: PLAYER_1,
        player_name: '先到骑手',
        return_rate: 0.3,
        final: 130_000,
      }))

      const response = await callApi(db, 'POST', {
        body: validPayload({
          player_id: PLAYER_2,
          player_name: '并列骑手',
          return_rate: 0.3,
          final: 130_000,
        }),
      })
      const body = await json(response)

      expect(body).toMatchObject({
        rank: 1,
        total_players: 2,
        percentile: 0,
        personal_best: { return_rate: 0.3, rank: 1 },
      })
      expect(body.top3.map((entry: Record<string, unknown>) => entry.rank)).toEqual([1, 1])
      expect(body.top3.map((entry: Record<string, unknown>) => entry.player_name)).toEqual(['先到骑手', '并列骑手'])
    })
  })

  it('keeps the old personal best and ranks against it after a lower submission', async () => {
    await withDatabase(async (db) => {
      await callApi(db, 'POST', { body: validPayload({ return_rate: 0.3, final: 130_000 }) })
      await callApi(db, 'POST', {
        body: validPayload({ player_id: PLAYER_2, player_name: '第二名', return_rate: 0.2, final: 120_000 }),
      })

      const response = await callApi(db, 'POST', {
        body: validPayload({ player_name: '不应覆盖', return_rate: -0.2, final: 80_000 }),
      })
      const body = await json(response)

      expect(body).toMatchObject({
        rank: 1,
        total_players: 2,
        percentile: 50,
        is_personal_best: false,
        personal_best: { return_rate: 0.3, rank: 1 },
      })
    })
  })

  it('returns stock entries with stable tie ordering and competition ranks', async () => {
    await withDatabase(async (db) => {
      db.seed(seededRow({
        id: 'id-2',
        player_id: PLAYER_2,
        player_name: 'ID靠后同分',
        return_rate: 0.5,
        created_at: '2026-01-01T00:00:00.000Z',
      }))
      db.seed(seededRow({
        id: 'id-1',
        player_id: PLAYER_1,
        player_name: 'ID靠前同分',
        return_rate: 0.5,
        created_at: '2026-01-01T00:00:00.000Z',
      }))
      db.seed(seededRow({
        id: 'id-3',
        player_id: PLAYER_3,
        player_name: '后到同分',
        return_rate: 0.5,
        created_at: '2026-01-03T00:00:00.000Z',
      }))
      db.seed(seededRow({
        id: 'id-4',
        player_id: PLAYER_4,
        player_name: '第四名',
        return_rate: 0.2,
        created_at: '2026-01-04T00:00:00.000Z',
      }))

      const response = await callApi(db, 'GET', { query: '?stock=600519&limit=10' })
      const body = await json(response)

      expect(body.entries.map((entry: Record<string, unknown>) => entry.player_name)).toEqual([
        'ID靠前同分',
        'ID靠后同分',
        '后到同分',
        '第四名',
      ])
      expect(body.entries.map((entry: Record<string, unknown>) => entry.rank)).toEqual([1, 1, 1, 4])
    })
  })

  it('deduplicates global entries and Top 3 to each player best across stocks', async () => {
    await withDatabase(async (db) => {
      db.seed(seededRow({
        id: 'p1-best',
        stock_code: '600519',
        stock_name: '贵州茅台',
        player_id: PLAYER_1,
        player_name: '跨股骑手',
        return_rate: 0.5,
        created_at: '2026-01-01T00:00:00.000Z',
      }))
      db.seed(seededRow({
        id: 'p1-low',
        stock_code: '000001',
        stock_name: '平安银行',
        player_id: PLAYER_1,
        player_name: '跨股骑手',
        return_rate: 0.2,
        created_at: '2026-01-02T00:00:00.000Z',
      }))
      db.seed(seededRow({
        id: 'p2-best',
        stock_code: '300750',
        stock_name: '宁德时代',
        player_id: PLAYER_2,
        player_name: '全球并列',
        return_rate: 0.5,
        created_at: '2026-01-03T00:00:00.000Z',
      }))

      const globalResponse = await callApi(db, 'GET')
      const globalBody = await json(globalResponse)
      const postResponse = await callApi(db, 'POST', {
        body: validPayload({
          stock_code: '601318',
          stock_name: '中国平安',
          player_id: PLAYER_3,
          player_name: '全球第三',
          return_rate: 0.3,
          final: 130_000,
        }),
      })
      const postBody = await json(postResponse)

      expect(globalBody.total_players).toBe(2)
      expect(globalBody.entries).toHaveLength(2)
      expect(globalBody.entries.map((entry: Record<string, unknown>) => entry.return_rate)).toEqual([0.5, 0.5])
      expect(globalBody.entries.map((entry: Record<string, unknown>) => entry.rank)).toEqual([1, 1])
      expect(postBody.top3.map((entry: Record<string, unknown>) => entry.player_name)).toEqual([
        '跨股骑手',
        '全球并列',
        '全球第三',
      ])
    })
  })

  it('returns a stock Top N and caps limit at 50', async () => {
    await withDatabase(async (db) => {
      for (let index = 0; index < 55; index += 1) {
        db.seed(seededRow({
          id: `id-${index}`,
          player_id: playerId(index + 1),
          player_name: `骑手${index}`,
          final: 100_000 + index,
          return_rate: index / 100,
          created_at: new Date(index * 1000).toISOString(),
        }))
      }

      const response = await callApi(db, 'GET', { query: '?stock=600519&limit=999' })
      const body = await json(response)

      expect(response.status).toBe(200)
      expect(body.stock_code).toBe('600519')
      expect(body.stock_name).toBe('贵州茅台')
      expect(body.total_players).toBe(55)
      expect(body.entries).toHaveLength(50)
      expect(body.entries[0]).toMatchObject({ return_rate: 0.54, rank: 1, stock_code: '600519' })
      expect(body.entries[49]).toMatchObject({ return_rate: 0.05, rank: 50 })
    })
  })

  it('marks the current player in queried leaderboard entries', async () => {
    await withDatabase(async (db) => {
      db.seed(seededRow({ player_id: PLAYER_1, player_name: '自己', return_rate: 0.2 }))
      db.seed(seededRow({ player_id: PLAYER_2, player_name: '别人', return_rate: 0.3 }))

      const response = await callApi(db, 'GET', { query: `?stock=600519&player_id=${PLAYER_1}` })
      const body = await json(response)

      expect(body.entries).toEqual([
        expect.objectContaining({ player_name: '别人', is_current_player: false }),
        expect.objectContaining({ player_name: '自己', is_current_player: true }),
      ])
    })
  })

  it('handles CORS preflight and rejects unsupported methods', async () => {
    await withDatabase(async (db) => {
      const preflight = await callApi(db, 'OPTIONS')
      const directPreflight = await onRequestOptions()
      const unsupported = await callApi(db, 'PUT')

      expect(preflight.status).toBe(204)
      expect(preflight.headers.get('access-control-allow-methods')).toBe('GET, POST, OPTIONS')
      expect(directPreflight.status).toBe(204)
      expect(unsupported.status).toBe(405)
      expect(await json(unsupported)).toEqual({ error: 'Method not allowed' })
    })
  })

  it('returns structured errors for malformed JSON and database failures', async () => {
    await withDatabase(async (db) => {
      const malformed = await callApi(db, 'POST', { rawBody: '{' })
      const failingDb = {
        prepare() {
          throw new Error('secret database details')
        },
      }
      const request = new Request('https://example.com/api/leaderboard', {
        method: 'GET',
      })
      const failed = await onRequest({ request, env: { DB: failingDb } })

      expect(malformed.status).toBe(400)
      expect(await json(malformed)).toEqual({ error: 'Invalid JSON' })
      expect(failed.status).toBe(500)
      expect(await json(failed)).toEqual({ error: 'Internal server error' })
    })
  })
})
