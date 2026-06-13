const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

const STOCK_NAMES = {
  '600519': '贵州茅台',
  '300750': '宁德时代',
  '002594': '比亚迪',
  '601318': '中国平安',
  '600036': '招商银行',
  '601899': '紫金矿业',
  '600900': '长江电力',
  '000333': '美的集团',
  '600276': '恒瑞医药',
  '300059': '东方财富',
  '300502': '新易盛',
  '300308': '中际旭创',
  '000725': '京东方A',
  '603986': '兆易创新',
  '688256': '寒武纪',
  '688041': '海光信息',
  '601138': '工业富联',
  '002475': '立讯精密',
  '002371': '北方华创',
  '300274': '阳光电源',
}

export async function onRequest(context) {
  const { request, env } = context

  if (request.method === 'OPTIONS') {
    return onRequestOptions()
  }

  try {
    if (request.method === 'POST') {
      return await handlePost(request, env)
    }

    if (request.method === 'GET') {
      return await handleGet(new URL(request.url), env)
    }

    return jsonResponse({ error: 'Method not allowed' }, 405, { Allow: 'GET, POST, OPTIONS' })
  } catch (error) {
    console.error('Leaderboard API error', error)
    return jsonResponse({ error: 'Internal server error' }, 500)
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  })
}

async function handlePost(request, env) {
  let input

  try {
    input = await request.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400)
  }

  const body = validateSubmission(input)
  if (!body) {
    return jsonResponse({ error: 'Validation failed' }, 400)
  }

  const updated = await env.DB.prepare(
    `INSERT INTO leaderboard (
       id, stock_code, stock_name, player_name, player_id,
       initial, final, return_rate, progress, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(player_id, stock_code) DO UPDATE SET
       stock_name = excluded.stock_name,
       player_name = excluded.player_name,
       initial = excluded.initial,
       final = excluded.final,
       return_rate = excluded.return_rate,
       progress = excluded.progress,
       created_at = excluded.created_at
     WHERE excluded.return_rate > leaderboard.return_rate
     RETURNING return_rate`,
  ).bind(
    crypto.randomUUID(),
    body.stock_code,
    body.stock_name,
    body.player_name,
    body.player_id,
    body.initial,
    body.final,
    body.return_rate,
    body.progress,
    new Date().toISOString(),
  ).first()

  const personalBest = await env.DB.prepare(
    `SELECT return_rate
     FROM leaderboard
     WHERE player_id = ? AND stock_code = ?
     LIMIT 1`,
  ).bind(body.player_id, body.stock_code).first()

  let rank = null
  let personalBestResponse = null
  let totalPlayers = 0
  let percentile = 0

  if (personalBest) {
    const stats = await env.DB.prepare(
      `SELECT
         COUNT(*) AS total,
         COALESCE(SUM(CASE WHEN return_rate > ? THEN 1 ELSE 0 END), 0) AS higher_count,
         COALESCE(SUM(CASE WHEN return_rate < ? THEN 1 ELSE 0 END), 0) AS lower_count
       FROM leaderboard
       WHERE stock_code = ?`,
    ).bind(personalBest.return_rate, personalBest.return_rate, body.stock_code).first()

    totalPlayers = Number(stats?.total ?? 0)
    rank = Number(stats?.higher_count ?? 0) + 1
    percentile = totalPlayers === 0
      ? 0
      : Math.round((Number(stats?.lower_count ?? 0) / totalPlayers) * 1000) / 10
    personalBestResponse = {
      return_rate: personalBest.return_rate,
      rank,
    }
  }

  const top3Result = await env.DB.prepare(
    `WITH player_rows AS (
       SELECT
         id, player_name, player_id, return_rate, stock_name, stock_code,
         final, created_at,
         ROW_NUMBER() OVER (
           PARTITION BY player_id
           ORDER BY return_rate DESC, created_at ASC, id ASC
         ) AS player_row
       FROM leaderboard
     ),
     global_entries AS (
       SELECT * FROM player_rows WHERE player_row = 1
     )
     SELECT
       entry.player_name, entry.return_rate, entry.stock_name, entry.stock_code,
       entry.final, entry.created_at, entry.player_id,
       1 + (
         SELECT COUNT(*)
         FROM global_entries higher
         WHERE higher.return_rate > entry.return_rate
       ) AS rank
     FROM global_entries entry
     ORDER BY entry.return_rate DESC, entry.created_at ASC, entry.player_id ASC
     LIMIT 3`,
  ).all()

  const top3 = (top3Result.results ?? []).map((entry) => ({
    player_name: entry.player_name,
    return_rate: entry.return_rate,
    stock_name: entry.stock_name,
    stock_code: entry.stock_code,
    final: entry.final,
    rank: Number(entry.rank),
  }))

  return jsonResponse({
    rank,
    total_players: totalPlayers,
    percentile,
    is_personal_best: updated !== null,
    personal_best: personalBestResponse,
    top3,
  })
}

async function handleGet(url, env) {
  const hasStock = url.searchParams.has('stock')
  const stock = hasStock ? url.searchParams.get('stock') : null
  const currentPlayerId = url.searchParams.get('player_id')

  if (hasStock && (typeof stock !== 'string' || !isKnownStockCode(stock))) {
    return jsonResponse({ error: 'Invalid stock code' }, 400)
  }
  if (currentPlayerId !== null && !isValidPlayerId(currentPlayerId)) {
    return jsonResponse({ error: 'Invalid player id' }, 400)
  }

  const limit = normalizeLimit(url.searchParams.get('limit'))
  const result = stock
    ? await env.DB.prepare(
      `WITH stock_entries AS (
         SELECT player_name, player_id, return_rate, final, stock_name, stock_code, created_at
         FROM leaderboard
         WHERE stock_code = ?
       )
       SELECT
         entry.player_name, entry.return_rate, entry.final, entry.stock_name,
         entry.stock_code, entry.created_at, entry.player_id,
         1 + (
           SELECT COUNT(*)
           FROM stock_entries higher
           WHERE higher.return_rate > entry.return_rate
         ) AS rank
       FROM stock_entries entry
       ORDER BY entry.return_rate DESC, entry.created_at ASC, entry.player_id ASC
       LIMIT ?`,
    ).bind(stock, limit).all()
    : await env.DB.prepare(
      `WITH player_rows AS (
         SELECT
           id, player_name, player_id, return_rate, final, stock_name, stock_code,
           created_at,
           ROW_NUMBER() OVER (
             PARTITION BY player_id
             ORDER BY return_rate DESC, created_at ASC, id ASC
           ) AS player_row
         FROM leaderboard
       ),
       global_entries AS (
         SELECT * FROM player_rows WHERE player_row = 1
       )
       SELECT
         entry.player_name, entry.return_rate, entry.final, entry.stock_name,
         entry.stock_code, entry.created_at, entry.player_id,
         1 + (
           SELECT COUNT(*)
           FROM global_entries higher
           WHERE higher.return_rate > entry.return_rate
         ) AS rank
       FROM global_entries entry
       ORDER BY entry.return_rate DESC, entry.created_at ASC, entry.player_id ASC
       LIMIT ?`,
    ).bind(limit).all()

  const totalResult = stock
    ? await env.DB.prepare(
      `SELECT COUNT(DISTINCT player_id) AS count
       FROM leaderboard
       WHERE stock_code = ?`,
    ).bind(stock).first()
    : await env.DB.prepare(
      `WITH player_rows AS (
         SELECT
           player_id,
           ROW_NUMBER() OVER (
             PARTITION BY player_id
             ORDER BY return_rate DESC, created_at ASC, id ASC
           ) AS player_row
         FROM leaderboard
       )
       SELECT COUNT(*) AS count
       FROM player_rows
       WHERE player_row = 1`,
    ).first()

  const entries = (result.results ?? []).map((entry) => ({
    player_name: entry.player_name,
    return_rate: entry.return_rate,
    final: entry.final,
    stock_name: entry.stock_name,
    stock_code: entry.stock_code,
    rank: Number(entry.rank),
    created_at: entry.created_at,
    is_current_player: currentPlayerId !== null && entry.player_id === currentPlayerId,
  }))

  return jsonResponse({
    stock_code: stock,
    stock_name: stock ? entries[0]?.stock_name ?? null : null,
    total_players: Number(totalResult?.count ?? 0),
    entries,
  })
}

function validateSubmission(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return null
  }

  const stockName = typeof input.stock_name === 'string' ? input.stock_name.trim() : ''
  const playerName = typeof input.player_name === 'string' ? input.player_name.trim() : ''

  if (typeof input.stock_code !== 'string' || !isKnownStockCode(input.stock_code)) return null
  const canonicalStockName = STOCK_NAMES[input.stock_code]
  if (stockName !== canonicalStockName) return null
  if (characterLength(playerName) < 2 || characterLength(playerName) > 12) return null
  if (!/^[\p{Script=Han}A-Za-z0-9_]+$/u.test(playerName)) return null
  if (typeof input.player_id !== 'string') return null
  if (!isValidPlayerId(input.player_id)) return null
  if (!isFiniteNumber(input.initial) || input.initial < 1_000 || input.initial > 10_000_000) return null
  if (!isFiniteNumber(input.final)) return null
  if (!isFiniteNumber(input.return_rate) || input.return_rate < -1 || input.return_rate > 100) return null
  if (input.progress !== 1) return null

  const expectedFinal = input.initial * (1 + input.return_rate)
  const finalTolerance = Math.max(1, Math.abs(expectedFinal) * 1e-6)
  if (Math.abs(input.final - expectedFinal) > finalTolerance) return null

  return {
    stock_code: input.stock_code,
    stock_name: canonicalStockName,
    player_name: playerName,
    player_id: input.player_id,
    initial: input.initial,
    final: input.final,
    return_rate: input.return_rate,
    progress: input.progress,
  }
}

function isKnownStockCode(value) {
  return /^\d{6}$/.test(value) && Object.prototype.hasOwnProperty.call(STOCK_NAMES, value)
}

function isValidPlayerId(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function normalizeLimit(value) {
  const parsed = Number.parseInt(value ?? '', 10)
  if (!Number.isFinite(parsed)) return 10
  return Math.min(50, Math.max(1, parsed))
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

function characterLength(value) {
  return Array.from(value).length
}

function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...JSON_HEADERS,
      ...extraHeaders,
    },
  })
}
