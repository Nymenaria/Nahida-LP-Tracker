const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '../lptracker.sqlite'));
db.pragma('foreign_keys = OFF');

db.exec(`
  CREATE TABLE IF NOT EXISTS race_event (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    start_date TEXT NOT NULL,
    duration_weeks INTEGER NOT NULL DEFAULT 3,
    channel_id TEXT NOT NULL,
    is_active INTEGER DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS daily_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    puuid TEXT NOT NULL,
    date TEXT NOT NULL,
    absolute_lp INTEGER NOT NULL,
    total_games INTEGER NOT NULL,
    wins INTEGER NOT NULL DEFAULT 0,
    losses INTEGER NOT NULL DEFAULT 0
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_puuid_date ON daily_snapshots(puuid, date);
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

// Migration : ajout de duration_days si absent
const raceEventCols = db.prepare("PRAGMA table_info(race_event)").all();
if (!raceEventCols.some(c => c.name === 'duration_days')) {
  db.exec("ALTER TABLE race_event ADD COLUMN duration_days INTEGER DEFAULT 3");
}

// Migration participants : renommage + recreation avec 4 equipes
const participantsMeta = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='participants'").get();
if (!participantsMeta) {
  db.exec(`CREATE TABLE participants (
    discord_id TEXT PRIMARY KEY,
    puuid TEXT NOT NULL UNIQUE,
    game_name TEXT NOT NULL,
    tag_line TEXT NOT NULL,
    team TEXT NOT NULL,
    region TEXT NOT NULL
  )`);
} else if (participantsMeta.sql.includes("cameleon")) {
  console.log('Migration participants -> 4 equipes...');
  db.exec("ALTER TABLE participants RENAME TO participants_legacy");
  db.exec(`CREATE TABLE participants (
    discord_id TEXT PRIMARY KEY,
    puuid TEXT NOT NULL UNIQUE,
    game_name TEXT NOT NULL,
    tag_line TEXT NOT NULL,
    team TEXT NOT NULL,
    region TEXT NOT NULL
  )`);
}

module.exports = db;
