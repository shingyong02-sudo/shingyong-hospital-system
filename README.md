# 杏永醫院住院動態網頁

病床利用情形統計日報表的**前台顯示**與**後台更新**系統。

- 技術：Node.js（v22.5+）內建 `node:http`，**免 npm install**。
- 資料庫：**Supabase 雲端**（PostgreSQL），專案 `shingyong-hospital`（`xhtnaxwcqqdsdkxjbhvk`），
  與巡檢系統分屬**不同的 Supabase 帳號 / 專案，完全隔離**。
- 後台不設密碼，供內網直接使用；寫入一律經由後端以 service_role 金鑰處理，anon 不可寫。

## 設定（第一次使用）

1. 複製 `.env.example` 為 `.env`
2. 在 `.env` 填入 `SUPABASE_SERVICE_ROLE_KEY`
   - 取得位置：Supabase Dashboard → **Project Settings → API Keys → `service_role` → Reveal**
   - ⚠️ service_role 金鑰有完整資料庫權限，**只放本機 `.env`（已被 gitignore），切勿提交或分享**。

## 啟動

```bash
cd C:\claude-code\shingyong
node server.js
```

- 前台顯示：<http://localhost:3100/>　（每 30 秒自動更新，適合大廳／護理站螢幕）
- 後台更新：<http://localhost:3100/admin>

自訂埠號：`$env:PORT=8080; node server.js`（PowerShell）

## 功能

**前台** 依 PDF 日報表版面呈現：病房類別、病床數、佔床數、空床數、佔床率，以及
總病床、保險病床數、急性保險病床比率、備註與更新時間（民國格式）。

**後台** 可編輯每個病房的病床數／佔床數／是否計入保險病床，並可新增／刪除病房與備註。
以下欄位由系統自動計算：

| 欄位 | 計算方式 |
| --- | --- |
| 空床數 | 病床數 − 佔床數 |
| 佔床率 | 佔床數 ÷ 病床數 |
| 總病床 | 所有病房加總 |
| 保險病床數 | 勾選「計入保險病床」之病房加總（差額床不計） |
| 急性保險病床比率 | 保險病床數 ÷ 總病床數 |

## 資料表（Supabase / PostgreSQL）

- `hospital_wards`：病房類別（name, total_beds, occupied_beds, is_insurance, sort_order）
- `hospital_notes`：備註
- `hospital_meta`：報表標題、更新時間

RLS：三張表皆開啟。anon 僅可 `SELECT`（前台唯讀）；寫入由後端 service_role 執行（略過 RLS）。
初始資料取自 `bed-1150703.pdf`（115.7.3）。

## API

| 方法 | 路徑 | 說明 |
| --- | --- | --- |
| GET | `/api/report` | 取得完整報表（含自動計算） |
| POST | `/api/save` | 整批儲存 `{categories, notes}`，並更新時間 |
