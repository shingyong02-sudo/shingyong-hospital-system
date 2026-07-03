// 共用工具：民國日期格式、數值處理
export function toROC(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d)) return '';
  const roc = d.getFullYear() - 1911;
  const M = d.getMonth() + 1;
  const D = d.getDate();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${roc}.${M}.${D}  ${hh}:${mm}`;
}

export function fmtPct(n) {
  return `${Number(n).toFixed(1)}%`;
}

export async function getReport() {
  const res = await fetch('/api/report', { cache: 'no-store' });
  if (!res.ok) throw new Error('report fetch failed');
  return res.json();
}
