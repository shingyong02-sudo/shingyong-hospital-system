# 杏永醫院住院動態網頁

病床利用情形統計日報表的**前台顯示**與**後台更新**系統。

- 技術：Node.js（v22.5+）內建 `node:http` + `node:sqlite`，**零外部相依、免 npm install**。
- 資料庫：`data/hospital.db`（SQLite，**獨立檔案，與巡檢系統完全分開**）。
- 後台不設密碼，供內網直接使用。

## 啟動

```bash
cd C:\claude-code\shingyong
node server.js
```

- 前台顯示：<http://localhost:3100/>　（每 30 秒自動更新，適合大廳／護理站螢幕）
- 後台更新：<http://localhost:3100/admin>

自訂埠號：`set PORT=8080 && node server.js`（PowerShell：`$env:PORT=8080; node server.js`）

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

## 資料表（SQLite）

- `categories`：病房類別（name, total_beds, occupied_beds, is_insurance, sort_order）
- `notes`：備註
- `meta`：報表標題、更新時間

初始資料取自 `bed-1150703.pdf`（115.7.3）。刪除 `data/hospital.db` 可重置為初始值。

## API

| 方法 | 路徑 | 說明 |
| --- | --- | --- |
| GET | `/api/report` | 取得完整報表（含自動計算） |
| POST | `/api/save` | 整批儲存 `{categories, notes}`，並更新時間 |
