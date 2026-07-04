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

// HTML escaping to prevent XSS attacks
export function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Input validation utilities
export const validateInput = {
  // Validate email format
  email: function(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  },

  // Validate date range (not more than 365 days)
  dateRange: function(from, to) {
    if (!from || !to) throw new Error('日期不能為空');
    const fromDate = new Date(from);
    const toDate = new Date(to);
    if (isNaN(fromDate) || isNaN(toDate)) throw new Error('無效的日期格式');
    if (fromDate > toDate) throw new Error('開始日期不能晚於結束日期');
    const days = (toDate - fromDate) / (1000 * 60 * 60 * 24);
    if (days > 365) throw new Error('查詢範圍不超過 365 天');
    return true;
  },

  // Validate non-empty string
  notEmpty: function(str, fieldName) {
    if (!str || !str.trim()) throw new Error((fieldName || '欄位') + '不能為空');
    return true;
  },

  // Validate number within range
  numberRange: function(num, min, max, fieldName) {
    const n = parseFloat(num);
    if (isNaN(n) || n < min || n > max) {
      throw new Error((fieldName || '數值') + '必須在 ' + min + ' 到 ' + max + ' 之間');
    }
    return true;
  }
};
