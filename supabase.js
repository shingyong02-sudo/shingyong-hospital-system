// Supabase 資料層 — 透過 PostgREST 存取，後端使用 service_role 金鑰（會略過 RLS）
// 金鑰與網址由環境變數提供（見 .env，切勿提交到版控）。
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '.env');

// 自行解析本機 .env。重點：本檔的值「優先」於系統環境變數。
// （這台電腦的使用者環境變數已被巡檢系統設了 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY，
//   若沿用 Node 內建 loadEnvFile，系統變數會蓋過 .env，導致誤連巡檢資料庫。）
function parseEnvFile(p) {
  const out = {};
  if (!existsSync(p)) return out;
  for (const raw of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

const fileEnv = parseEnvFile(envPath);
const SUPABASE_URL = fileEnv.SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = fileEnv.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('\n[設定錯誤] 找不到 SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY。');
  console.error('請在 C:\\claude-code\\shingyong\\.env 填入這兩個值（可參考 .env.example）。\n');
  process.exit(1);
}

const REST = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1`;
const baseHeaders = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

async function sb(path, options = {}) {
  const res = await fetch(`${REST}/${path}`, {
    ...options,
    headers: { ...baseHeaders, ...(options.headers || {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${text}`);
  // 寫入（POST/DELETE）常回傳空 body（201/204），需容許空回應
  return text ? JSON.parse(text) : null;
}

export async function getWards() {
  return sb('hospital_wards?select=id,name,total_beds,occupied_beds,is_insurance&order=sort_order.asc,id.asc');
}

export async function getNotes() {
  const rows = await sb('hospital_notes?select=content&order=sort_order.asc,id.asc');
  return rows.map((r) => r.content);
}

export async function getMeta(key) {
  const rows = await sb(`hospital_meta?select=value&key=eq.${encodeURIComponent(key)}`);
  return rows[0]?.value ?? '';
}

// 整批取代病房與備註，並更新時間
export async function replaceAll(cats, notes) {
  // 1) 清空（PostgREST 的 DELETE 需要過濾條件，用 id>=0 涵蓋全部）
  await sb('hospital_wards?id=gte.0', { method: 'DELETE' });
  await sb('hospital_notes?id=gte.0', { method: 'DELETE' });

  // 2) 寫入新病房
  if (cats.length) {
    const rows = cats.map((c, i) => ({
      sort_order: i,
      name: c.name,
      total_beds: c.total,
      occupied_beds: c.occupied,
      is_insurance: c.is_insurance,
    }));
    await sb('hospital_wards', { method: 'POST', body: JSON.stringify(rows) });
  }

  // 3) 寫入新備註
  if (notes.length) {
    const rows = notes.map((content, i) => ({ sort_order: i, content }));
    await sb('hospital_notes', { method: 'POST', body: JSON.stringify(rows) });
  }

  // 4) 更新時間（upsert）
  await sb('hospital_meta', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify([{ key: 'updated_at', value: new Date().toISOString() }]),
  });
}
