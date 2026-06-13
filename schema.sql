CREATE TABLE IF NOT EXISTS leaderboard (
  id TEXT PRIMARY KEY NOT NULL,
  stock_code TEXT NOT NULL,
  stock_name TEXT NOT NULL,
  player_name TEXT NOT NULL,
  player_id TEXT NOT NULL,
  initial REAL NOT NULL,
  final REAL NOT NULL,
  return_rate REAL NOT NULL,
  progress REAL NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_leaderboard_return ON leaderboard(stock_code, return_rate DESC);
CREATE INDEX IF NOT EXISTS idx_leaderboard_global_return ON leaderboard(return_rate DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_leaderboard_player ON leaderboard(player_id, stock_code);
