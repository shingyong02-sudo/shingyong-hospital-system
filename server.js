// 杏永醫院住院動態網頁 — 伺服器 (Node 內建 http；資料存於 Supabase 雲端)
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getWards, getNotes, getMeta, replaceAll } from './supabase.js';

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

// 依 Supabase 資料計算完整日報表（含空床數、佔床率、總計、保險病床、比率）
async function buildReport() {
  const [rawWards, notes, title, updatedAt] = await Promise.all([
    getWards(),
    getNotes(),
    getMeta('report_title'),
    getMeta('updated_at'),
  ]);

  const cats = rawWards.map((c) => ({
    id: c.id,
    name: c.name,
    total: c.total_beds,
    occupied: c.occupied_beds,
    empty: c.total_beds - c.occupied_beds,
    rate: pct(c.occupied_beds, c.total_beds),
    is_insurance: !!c.is_insurance,
  }));

  const sum = (arr, k) => arr.reduce((a, x) => a + x[k], 0);
  const total = { name: '總病床', total: sum(cats, 'total'), occupied: sum(cats, 'occupied') };
  total.empty = total.total - total.occupied;
  total.rate = pct(total.occupied, total.total);

  const insCats = cats.filter((c) => c.is_insurance);
  const insurance = { name: '保險病床數', total: sum(insCats, 'total'), occupied: sum(insCats, 'occupied') };
  insurance.empty = insurance.total - insurance.occupied;
  insurance.rate = pct(insurance.occupied, insurance.total);

  // 急性保險病床比率 = 保險病床數 ÷ 總病床數
  const acuteInsuranceRatio = pct(insurance.total, total.total);

  return {
    title: title || '杏永醫院病床利用情形統計日報表',
    categories: cats,
    total,
    insurance,
    acuteInsuranceRatio,
    notes,
    updated_at: updatedAt,
  };
}

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
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

// 驗證並整理後台送來的資料，再寫入 Supabase
async function saveAll(payload) {
  const catsIn = Array.isArray(payload.categories) ? payload.categories : [];
  const notesIn = Array.isArray(payload.notes) ? payload.notes : [];
  if (catsIn.length === 0) throw new Error('至少需要一筆病房類別');

  const clampInt = (v) => {
    const n = Math.trunc(Number(v));
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };

  const cats = catsIn.map((c, i) => {
    const name = String(c.name ?? '').trim() || `病房${i + 1}`;
    const total = clampInt(c.total);
    let occupied = clampInt(c.occupied);
    if (occupied > total) occupied = total; // 佔床數不可超過病床數
    return { name, total, occupied, is_insurance: !!c.is_insurance };
  });
  const notes = notesIn.map((n) => String(n ?? '').trim()).filter(Boolean);

  await replaceAll(cats, notes);
}

async function serveStatic(req, res, urlPath) {
  let rel = urlPath === '/' ? '/index.html' : urlPath;
  if (rel === '/admin' || rel === '/admin/') rel = '/admin.html';
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
      return sendJSON(res, 200, await buildReport());
    }
    if (path === '/api/save' && req.method === 'POST') {
      const payload = JSON.parse((await readBody(req)) || '{}');
      await saveAll(payload);
      return sendJSON(res, 200, { ok: true, report: await buildReport() });
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
  console.log('杏永醫院住院動態網頁已啟動（資料來源：Supabase 雲端）：');
  console.log(`  前台顯示： http://localhost:${PORT}/`);
  console.log(`  後台更新： http://localhost:${PORT}/admin`);
});
