// 杏永醫院住院動態網頁 — 伺服器 (零外部相依，使用 Node 內建 http + node:sqlite)
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, 'public');
const PORT = process.env.PORT || 3100;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const round1 = (n) => Math.round(n * 10) / 10;
const pct = (num, den) => (den > 0 ? round1((num / den) * 100) : 0);

// 依資料庫內容計算完整日報表（含空床數、佔床率、總計、保險病床、比率）
function buildReport() {
  const cats = db
    .prepare('SELECT id, name, total_beds, occupied_beds, is_insurance FROM categories ORDER BY sort_order, id')
    .all()
    .map((c) => ({
      id: c.id,
      name: c.name,
      total: c.total_beds,
      occupied: c.occupied_beds,
      empty: c.total_beds - c.occupied_beds,
      rate: pct(c.occupied_beds, c.total_beds),
      is_insurance: !!c.is_insurance,
    }));

  const sum = (arr, k) => arr.reduce((a, x) => a + x[k], 0);
  const total = {
    name: '總病床',
    total: sum(cats, 'total'),
    occupied: sum(cats, 'occupied'),
  };
  total.empty = total.total - total.occupied;
  total.rate = pct(total.occupied, total.total);

  const insCats = cats.filter((c) => c.is_insurance);
  const insurance = {
    name: '保險病床數',
    total: sum(insCats, 'total'),
    occupied: sum(insCats, 'occupied'),
  };
  insurance.empty = insurance.total - insurance.occupied;
  insurance.rate = pct(insurance.occupied, insurance.total);

  // 急性保險病床比率 = 保險病床數 ÷ 總病床數
  const acuteInsuranceRatio = pct(insurance.total, total.total);

  const notes = db.prepare('SELECT content FROM notes ORDER BY sort_order, id').all().map((n) => n.content);
  const getMeta = (k) => db.prepare('SELECT value FROM meta WHERE key = ?').get(k)?.value ?? '';

  return {
    title: getMeta('report_title') || '杏永醫院病床利用情形統計日報表',
    categories: cats,
    total,
    insurance,
    acuteInsuranceRatio,
    notes,
    updated_at: getMeta('updated_at'),
  };
}

// 讀取 request body（限制大小）
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > 1_000_000) reject(new Error('payload too large'));
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function sendJSON(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

// 儲存後台送來的資料：整批取代 categories、notes，並更新時間
function saveAll(payload) {
  const cats = Array.isArray(payload.categories) ? payload.categories : [];
  const notes = Array.isArray(payload.notes) ? payload.notes : [];
  if (cats.length === 0) throw new Error('至少需要一筆病房類別');

  const clampInt = (v) => {
    const n = Math.trunc(Number(v));
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };

  // node:sqlite 無 .transaction() 輔助方法，改用手動 BEGIN/COMMIT/ROLLBACK
  db.exec('BEGIN');
  try {
    db.exec('DELETE FROM categories');
    db.exec('DELETE FROM notes');
    const insCat = db.prepare(
      'INSERT INTO categories (sort_order, name, total_beds, occupied_beds, is_insurance) VALUES (?,?,?,?,?)'
    );
    cats.forEach((c, i) => {
      const name = String(c.name ?? '').trim() || `病房${i + 1}`;
      const total = clampInt(c.total);
      let occ = clampInt(c.occupied);
      if (occ > total) occ = total; // 佔床數不可超過病床數
      insCat.run(i, name, total, occ, c.is_insurance ? 1 : 0);
    });
    const insNote = db.prepare('INSERT INTO notes (sort_order, content) VALUES (?,?)');
    notes.forEach((n, i) => {
      const content = String(n ?? '').trim();
      if (content) insNote.run(i, content);
    });
    db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?,?)').run(
      'updated_at',
      new Date().toISOString()
    );
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

async function serveStatic(req, res, urlPath) {
  let rel = urlPath === '/' ? '/index.html' : urlPath;
  if (rel === '/admin' || rel === '/admin/') rel = '/admin.html';
  // 防止路徑穿越
  const filePath = normalize(join(PUBLIC_DIR, rel));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  try {
    const buf = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] || 'application/octet-stream' });
    res.end(buf);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;

  try {
    if (path === '/api/report' && req.method === 'GET') {
      return sendJSON(res, 200, buildReport());
    }
    if (path === '/api/save' && req.method === 'POST') {
      const body = await readBody(req);
      const payload = JSON.parse(body || '{}');
      saveAll(payload);
      return sendJSON(res, 200, { ok: true, report: buildReport() });
    }
    if (path.startsWith('/api/')) {
      return sendJSON(res, 404, { ok: false, error: 'not found' });
    }
    return serveStatic(req, res, path);
  } catch (err) {
    return sendJSON(res, 400, { ok: false, error: String(err.message || err) });
  }
});

server.listen(PORT, () => {
  console.log(`杏永醫院住院動態網頁已啟動：`);
  console.log(`  前台顯示： http://localhost:${PORT}/`);
  console.log(`  後台更新： http://localhost:${PORT}/admin`);
});
