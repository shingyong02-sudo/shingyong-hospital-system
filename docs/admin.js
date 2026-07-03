// 公開版後台：讀取用 publishable 金鑰直讀 Supabase；儲存呼叫 Edge Function（需密碼）
const { url, anonKey } = window.SUPABASE_CONFIG;
const REST = `${url.replace(/\/$/, '')}/rest/v1`;
const FN = `${url.replace(/\/$/, '')}/functions/v1/hospital-save`;
const READ_HEADERS = { apikey: anonKey, Authorization: `Bearer ${anonKey}` };

const fmtPct = (n) => `${Number(n).toFixed(1)}%`;

const $ = (id) => document.getElementById(id);
const gate = $('gate'), app = $('app'), toastEl = $('toast');
const rowsEl = $('rows'), notesEl = $('notes'), summaryEl = $('summary');

const getPw = () => sessionStorage.getItem('sy_admin_pw') || '';

function toast(msg, isErr = false) {
  toastEl.textContent = msg;
  toastEl.className = 'toast show' + (isErr ? ' err' : '');
  setTimeout(() => (toastEl.className = 'toast'), 2400);
}

// ---- 登入閘 ----
function enterApp() {
  gate.classList.add('hidden');
  app.classList.remove('hidden');
  load();
}
function logout() {
  sessionStorage.removeItem('sy_admin_pw');
  app.classList.add('hidden');
  gate.classList.remove('hidden');
  $('pw').value = '';
}
$('loginBtn').addEventListener('click', () => {
  const pw = $('pw').value.trim();
  if (!pw) { $('gateErr').textContent = '請輸入密碼'; return; }
  sessionStorage.setItem('sy_admin_pw', pw);
  $('gateErr').textContent = '';
  enterApp();
});
$('pw').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('loginBtn').click(); });
$('logoutBtn').addEventListener('click', logout);

// ---- 資料列 ----
function catRow(c = { name: '', total: 0, occupied: 0, is_insurance: true }) {
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input type="text" class="f-name" value="${(c.name || '').replace(/"/g, '&quot;')}" placeholder="病房名稱" /></td>
    <td><input type="number" min="0" class="f-total" value="${c.total ?? 0}" /></td>
    <td><input type="number" min="0" class="f-occ" value="${c.occupied ?? 0}" /></td>
    <td class="calc f-empty">0</td>
    <td class="calc f-rate">0.0%</td>
    <td><input type="checkbox" class="f-ins" ${c.is_insurance ? 'checked' : ''} /></td>
    <td><button class="btn btn-danger btn-sm f-del">刪除</button></td>`;
  tr.querySelectorAll('input').forEach((i) => i.addEventListener('input', recalc));
  tr.querySelector('.f-del').addEventListener('click', () => { tr.remove(); recalc(); });
  return tr;
}
function noteRow(text = '') {
  const div = document.createElement('div');
  div.className = 'note-row';
  div.innerHTML = `<textarea rows="1">${text.replace(/</g, '&lt;')}</textarea><button class="btn btn-danger btn-sm">刪除</button>`;
  div.querySelector('button').addEventListener('click', () => div.remove());
  return div;
}

function collect() {
  const categories = [...rowsEl.querySelectorAll('tr')].map((tr) => ({
    name: tr.querySelector('.f-name').value,
    total: +tr.querySelector('.f-total').value || 0,
    occupied: +tr.querySelector('.f-occ').value || 0,
    is_insurance: tr.querySelector('.f-ins').checked,
  }));
  const notes = [...notesEl.querySelectorAll('textarea')].map((t) => t.value.trim()).filter(Boolean);
  return { categories, notes };
}

function recalc() {
  let tT = 0, tO = 0, iT = 0, iO = 0;
  [...rowsEl.querySelectorAll('tr')].forEach((tr) => {
    let total = +tr.querySelector('.f-total').value || 0;
    let occ = +tr.querySelector('.f-occ').value || 0;
    if (occ > total) { occ = total; tr.querySelector('.f-occ').value = total; }
    const rate = total > 0 ? (occ / total) * 100 : 0;
    tr.querySelector('.f-empty').textContent = total - occ;
    const rEl = tr.querySelector('.f-rate');
    rEl.textContent = fmtPct(rate);
    rEl.classList.toggle('hot', rate >= 90);
    tT += total; tO += occ;
    if (tr.querySelector('.f-ins').checked) { iT += total; iO += occ; }
  });
  const ratio = tT > 0 ? (iT / tT) * 100 : 0;
  summaryEl.innerHTML = `<strong>即時計算預覽</strong><br />
    總病床：${tT} 床，佔床 ${tO}，空床 ${tT - tO}，佔床率 ${fmtPct(tT > 0 ? (tO / tT) * 100 : 0)}<br />
    保險病床數：${iT} 床，佔床 ${iO}，空床 ${iT - iO}，佔床率 ${fmtPct(iT > 0 ? (iO / iT) * 100 : 0)}<br />
    急性保險病床比率：<strong>${fmtPct(ratio)}</strong>`;
}

async function load() {
  const [wards, notes] = await Promise.all([
    fetch(`${REST}/hospital_wards?select=name,total_beds,occupied_beds,is_insurance&order=sort_order.asc,id.asc`, { headers: READ_HEADERS, cache: 'no-store' }).then((r) => r.json()),
    fetch(`${REST}/hospital_notes?select=content&order=sort_order.asc,id.asc`, { headers: READ_HEADERS, cache: 'no-store' }).then((r) => r.json()),
  ]);
  rowsEl.innerHTML = '';
  wards.forEach((c) => rowsEl.appendChild(catRow({ name: c.name, total: c.total_beds, occupied: c.occupied_beds, is_insurance: c.is_insurance })));
  notesEl.innerHTML = '';
  notes.forEach((n) => notesEl.appendChild(noteRow(n.content)));
  recalc();
}

$('addBtn').addEventListener('click', () => { rowsEl.appendChild(catRow()); recalc(); });
$('addNoteBtn').addEventListener('click', () => notesEl.appendChild(noteRow()));
$('reloadBtn').addEventListener('click', () => load().then(() => toast('已重新載入')));

$('saveBtn').addEventListener('click', async () => {
  const payload = collect();
  if (payload.categories.length === 0) return toast('至少需要一筆病房類別', true);
  payload.password = getPw();
  try {
    const res = await fetch(FN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: anonKey },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (res.status === 401) { toast('密碼錯誤，請重新登入', true); return logout(); }
    if (!res.ok || !data.ok) throw new Error(data.error || '儲存失敗');
    toast('✓ 已儲存，前台已更新');
    await load();
  } catch (e) {
    toast(String(e.message || e), true);
  }
});

// 若本次瀏覽階段已輸入過密碼，直接進入
if (getPw()) enterApp();
