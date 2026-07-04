// 杏永醫院住院動態網頁 — 伺服器 (Node 內建 http；資料存於 Supabase 雲端)
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getWards, getNotes, getMeta, replaceAll, getPresentations, getPresentationById, createPresentation, updatePresentation, deletePresentation } from './supabase.js';

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

// 安全 HTTP Headers
function setSecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
}

// Input validation utilities
function validateString(str, fieldName, maxLen = 500) {
  const s = String(str ?? '').trim();
  if (s.length === 0) return '';
  if (s.length > maxLen) throw new Error(`${fieldName}長度不能超過${maxLen}字`);
  return s;
}

function validateInt(val, fieldName, min = 0, max = 10000) {
  const n = Math.trunc(Number(val));
  if (!Number.isFinite(n) || n < min || n > max) {
    throw new Error(`${fieldName}必須在${min}到${max}之間的整數`);
  }
  return n;
}

// 驗證並整理後台送來的資料，再寫入 Supabase
async function saveAll(payload) {
  // Type checking
  if (typeof payload !== 'object' || payload === null) {
    throw new Error('無效的請求格式');
  }

  const catsIn = Array.isArray(payload.categories) ? payload.categories : [];
  const notesIn = Array.isArray(payload.notes) ? payload.notes : [];

  if (catsIn.length === 0) throw new Error('至少需要一筆病房類別');
  if (catsIn.length > 100) throw new Error('病房類別不能超過100筆');

  const clampInt = (v) => {
    const n = Math.trunc(Number(v));
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };

  const cats = catsIn.map((c, i) => {
    if (typeof c !== 'object' || c === null) {
      throw new Error(`病房${i + 1}：無效的資料格式`);
    }
    const name = validateString(c.name, `病房${i + 1}名稱`, 100) || `病房${i + 1}`;
    const total = validateInt(c.total, `病房${i + 1}總床數`, 0, 10000);
    let occupied = validateInt(c.occupied, `病房${i + 1}佔床數`, 0, 10000);
    if (occupied > total) occupied = total; // 佔床數不可超過病床數
    return { name, total, occupied, is_insurance: !!c.is_insurance };
  });

  const notes = notesIn.map((n, i) => {
    const note = validateString(n, `備註${i + 1}`, 500);
    return note;
  }).filter(Boolean);

  if (notes.length > 50) throw new Error('備註不能超過50筆');

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
    const ext = extname(filePath);
    const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream' };

    // Add CSP header for HTML files
    if (ext === '.html') {
      headers['Content-Security-Policy'] = "default-src 'self'; script-src 'self' 'module'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self';";
    }

    res.writeHead(200, headers);
    res.end(buf);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;

  // Apply security headers to all responses
  setSecurityHeaders(res);

  try {
    if (path === '/api/report' && req.method === 'GET') {
      return sendJSON(res, 200, await buildReport());
    }
    if (path === '/api/save' && req.method === 'POST') {
      const payload = JSON.parse((await readBody(req)) || '{}');
      await saveAll(payload);
      return sendJSON(res, 200, { ok: true, report: await buildReport() });
    }

    // 簡報 API
    if (path === '/api/presentations' && req.method === 'GET') {
      const presentations = await getPresentations();
      return sendJSON(res, 200, presentations);
    }
    if (path.match(/^\/api\/presentations\/\d+$/) && req.method === 'GET') {
      const id = parseInt(path.split('/')[3]);
      const presentation = await getPresentationById(id);
      if (!presentation) return sendJSON(res, 404, { ok: false, error: 'not found' });
      return sendJSON(res, 200, presentation);
    }
    if (path === '/api/presentations' && req.method === 'POST') {
      const payload = JSON.parse((await readBody(req)) || '{}');
      const result = await createPresentation(payload.title, payload.content, payload.style_version);
      return sendJSON(res, 201, { ok: true, data: result });
    }
    if (path.match(/^\/api\/presentations\/\d+$/) && req.method === 'PATCH') {
      const id = parseInt(path.split('/')[3]);
      const payload = JSON.parse((await readBody(req)) || '{}');
      await updatePresentation(id, payload);
      return sendJSON(res, 200, { ok: true });
    }
    if (path.match(/^\/api\/presentations\/\d+$/) && req.method === 'DELETE') {
      const id = parseInt(path.split('/')[3]);
      await deletePresentation(id);
      return sendJSON(res, 200, { ok: true });
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
