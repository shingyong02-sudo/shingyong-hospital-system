// SQLite 資料庫初始化與種子資料
// 本系統的資料庫完全獨立，與「巡檢系統」分開存放。
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');
mkdirSync(DATA_DIR, { recursive: true });

// 專屬資料庫檔（與巡檢系統無關）
export const DB_PATH = join(DATA_DIR, 'hospital.db');
export const db = new DatabaseSync(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    sort_order   INTEGER NOT NULL DEFAULT 0,
    name         TEXT    NOT NULL,
    total_beds   INTEGER NOT NULL DEFAULT 0,
    occupied_beds INTEGER NOT NULL DEFAULT 0,
    is_insurance INTEGER NOT NULL DEFAULT 1   -- 1 = 計入保險病床
  );

  CREATE TABLE IF NOT EXISTS notes (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    content    TEXT    NOT NULL
  );

  CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT
  );
`);

// 首次啟動：載入 PDF 日報表的初始資料
const count = db.prepare('SELECT COUNT(*) AS n FROM categories').get().n;
if (count === 0) {
  const insCat = db.prepare(
    'INSERT INTO categories (sort_order, name, total_beds, occupied_beds, is_insurance) VALUES (?,?,?,?,?)'
  );
  // name, 病床數, 佔床數, 是否保險病床(差額床為自費，不計入)
  const seed = [
    ['急性一般健保床', 24, 3, 1],
    ['急性一般差額床', 16, 1, 0],
    ['加護病房', 8, 1, 1],
    ['慢性呼吸照護病床', 15, 14, 1],
  ];
  seed.forEach((r, i) => insCat.run(i, r[0], r[1], r[2], r[3]));

  const insNote = db.prepare('INSERT INTO notes (sort_order, content) VALUES (?,?)');
  const notes = [
    '以上空床數為即時資訊，實際床數以住院處之床位分配為主',
    '各類床位之供應順序，依住院科別、病人性別或兒童等而調度',
    '收差額之病床 (一般病房：650 元/日(自費)，雙人病房：1,800 元/日、2,500 元/日(自費))',
  ];
  notes.forEach((c, i) => insNote.run(i, c));

  const insMeta = db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?,?)');
  insMeta.run('report_title', '杏永醫院病床利用情形統計日報表');
  insMeta.run('updated_at', new Date().toISOString());
}
