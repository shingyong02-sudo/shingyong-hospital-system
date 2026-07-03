// Supabase 資料層 — 透過 PostgREST 存取，後端使用 service_role 金鑰（會略過 RLS）
// 金鑰與網址由環境變數提供（見 .env，切勿提交到版控）。
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// 載入本機 .env（Node 22.5+ 內建）
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '.env');
if (existsSync(envPath)) {
  try { process.loadEnvFile(envPath); } catch { /* 忽略解析錯誤 */ }
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Supabase ${res.status}: ${body}`);
  }
  return res.status === 204 ? null : res.json();
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
