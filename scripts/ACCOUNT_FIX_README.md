# 孤立帳號修復工具使用指南

## 📋 概述

這個工具用來：
- 🔍 **檢測孤立帳號** - EMAIL已註冊但name為空
- 🧹 **自動清理** - 刪除不完整的帳號記錄
- 📊 **生成報告** - 每日帳號健康狀態報告
- 🔔 **告警通知** - 異常情況自動通知管理員

---

## 🚀 快速開始

### 1. 安裝依賴

```bash
npm install @supabase/supabase-js dotenv
```

### 2. 配置環境變數

複製 `.env.example` 為 `.env`，填入 Supabase 認證信息：

```bash
cp .env.example .env
```

編輯 `.env`：
```
SUPABASE_URL=https://qztffronusdhgxhjjubt.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  # 💡 用 Service Role Key，不是 Anon Key
```

**⚠️ 重要**：Service Role Key 是敏感信息，不要提交到 Git！

### 3. 執行命令

#### 模式 A：檢查（預覽，不修改）
```bash
npm run fix:accounts:check
```
✅ 安全、無風險，顯示將要做什麼

#### 模式 B：模擬執行（預覽清理過程）
```bash
npm run fix:accounts:preview
```
✅ 預覽將刪除的記錄，但不實際刪除

#### 模式 C：實際修復（執行清理）
```bash
npm run fix:accounts:fix
```
⚠️ **會實際刪除孤立帳號**，請先確認

#### 模式 D：生成報告
```bash
npm run fix:accounts:report
```
✅ 生成詳細的帳號統計報告

---

## 📊 命令詳解

### 檢查模式（推薦首先執行）

```bash
$ npm run fix:accounts:check

[2026-01-14T10:30:45.123Z] [INFO] 開始掃描孤立帳號...
[2026-01-14T10:30:46.456Z] [WARN] ✓ 發現 3 個孤立帳號
  - ID: uuid-1 | Email: test1@example.com | 建立: 2026-01-14
  - ID: uuid-2 | Email: test2@example.com | 建立: 2026-01-14
  - ID: uuid-3 | Email: kctu@tapmc.com.tw | 建立: 2026-01-10
```

### 預覽模式（建議在 fix 前執行）

```bash
$ npm run fix:accounts:preview

[2026-01-14T10:31:00.000Z] [INFO] 【模擬】準備刪除 3 個孤立帳號...
[2026-01-14T10:31:00.100Z] [INFO] 模擬模式：顯示將被刪除的記錄
  ◌ test1@example.com (建立: 2026-01-14T10:20:00.000Z)
  ◌ test2@example.com (建立: 2026-01-14T10:21:00.000Z)
  ◌ kctu@tapmc.com.tw (建立: 2026-01-10T08:15:00.000Z)
```

### 實際修復（會真正刪除）

```bash
$ npm run fix:accounts:fix

[2026-01-14T10:32:00.000Z] [INFO] ========== 開始修復異常 EMAIL ==========
[2026-01-14T10:32:01.000Z] [INFO] 開始掃描孤立帳號...
[2026-01-14T10:32:02.000Z] [WARN] ✓ 發現 3 個孤立帳號
[2026-01-14T10:32:02.100Z] [INFO] ✓ 已刪除 [test1@example.com]
[2026-01-14T10:32:02.200Z] [INFO] ✓ 已刪除 [test2@example.com]
[2026-01-14T10:32:02.300Z] [INFO] ✓ 已刪除 [kctu@tapmc.com.tw]
[2026-01-14T10:32:03.000Z] [INFO] 刪除完成: 3 成功, 0 失敗
[2026-01-14T10:32:03.100Z] [INFO] ========== 修復完成 ==========

結果: {
  status: 'success',
  deleted: 3,
  failed: 0,
  remaining: 0,
  message: '成功刪除 3 個孤立帳號'
}
```

### 生成報告

```bash
$ npm run fix:accounts:report

╔════════════════════════════════════════╗
║        帳號系統修復報告                 ║
║   2026/1/14 10:33:45                   ║
╚════════════════════════════════════════╝

📊 帳號統計
  └─ 總帳號數: 150
     ├─ ✓ 完整帳號: 147
     └─ ⚠️  孤立帳號: 3

📈 孤立帳號詳情
  • Email: kctu@tapmc.com.tw
    └─ 建立時間: 2026-01-10T08:15:00.000Z
  • Email: test1@example.com
    └─ 建立時間: 2026-01-14T10:20:00.000Z

📁 報告已保存: reports/account-report-2026-01-14.txt
```

---

## ⏰ 自動定期清理（推薦）

### 方案 1：Node-cron（簡單）

創建 `scripts/schedule-account-fix.js`：

```javascript
const cron = require('node-cron');
const { exec } = require('child_process');

// 每日凌晨 2 點執行
cron.schedule('0 2 * * *', () => {
  console.log('🔧 開始每日帳號檢查...');
  exec('npm run fix:accounts:fix', (err, stdout, stderr) => {
    if (err) {
      console.error('❌ 執行失敗:', err);
      return;
    }
    console.log('✓ 每日檢查完成');
  });
});

console.log('⏰ 帳號修復排程已啟動 (凌晨 2 點)');
```

安裝 node-cron：
```bash
npm install node-cron
```

啟動排程：
```bash
node scripts/schedule-account-fix.js
```

### 方案 2：Systemd 服務（生產環境）

創建 `/etc/systemd/system/account-fix.timer`：

```ini
[Unit]
Description=Daily Account Fix
Requires=account-fix.service

[Timer]
OnCalendar=daily
OnCalendar=02:00
Persistent=true

[Install]
WantedBy=timers.target
```

創建 `/etc/systemd/system/account-fix.service`：

```ini
[Unit]
Description=Account Orphan Fix Service
After=network.target

[Service]
Type=oneshot
WorkingDirectory=/path/to/shingyong
ExecStart=/usr/bin/npm run fix:accounts:fix
User=www-data
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

啟動：
```bash
sudo systemctl enable account-fix.timer
sudo systemctl start account-fix.timer
```

檢查狀態：
```bash
sudo systemctl status account-fix.timer
sudo journalctl -u account-fix.service -f
```

---

## 🔔 告警通知（可選）

### 整合 Slack

編輯 `.env`：
```
NOTIFY_SLACK_WEBHOOK=https://hooks.slack.com/services/YOUR/WEBHOOK/HERE
```

修改 `fix-orphaned-accounts.js` 中的 `generateReport()` 函數，添加：

```javascript
async function notifySlack(message) {
  if (!process.env.NOTIFY_SLACK_WEBHOOK) return;
  
  try {
    await fetch(process.env.NOTIFY_SLACK_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `🔧 帳號修復報告`,
        blocks: [{
          type: 'section',
          text: { type: 'mrkdwn', text: message }
        }]
      })
    });
  } catch (err) {
    console.error('Slack 通知失敗:', err);
  }
}
```

---

## 📁 日誌和報告

自動生成的文件：

```
logs/
  └─ account-fix-2026-01-14.log    # 詳細執行日誌
  └─ account-fix-2026-01-15.log

reports/
  └─ account-report-2026-01-14.txt  # 帳號統計報告
  └─ account-report-2026-01-15.txt
```

查看日誌：
```bash
# 查看最新日誌
tail -f logs/account-fix-*.log

# 搜索錯誤
grep ERROR logs/account-fix-*.log
```

---

## ❌ 故障排除

### 問題 1：認證失敗
```
❌ 環境變數未設置: SUPABASE_SERVICE_ROLE_KEY
```

**解決方案**：
1. 確認 `.env` 檔案存在
2. 檢查 SUPABASE_SERVICE_ROLE_KEY 是否正確
3. 不要使用 ANON_KEY，必須用 SERVICE_ROLE_KEY

### 問題 2：無刪除權限
```
❌ 刪除失敗 [email@example.com]: permission denied
```

**解決方案**：
1. 確保使用的是 SERVICE_ROLE_KEY（有完整權限）
2. 檢查 Supabase 的 RLS (Row Level Security) 規則

### 問題 3：表不存在
```
ERROR: 42703: column "id" does not exist
```

**解決方案**：
1. 確認是在查詢 `public.users` 表
2. 檢查表結構是否正確

---

## ✅ 最佳實踐

1. **先測試**
   ```bash
   npm run fix:accounts:check       # 檢查
   npm run fix:accounts:preview     # 預覽
   npm run fix:accounts:fix         # 執行
   ```

2. **備份數據**
   ```bash
   # 執行前匯出用戶表
   npm run export:users
   ```

3. **監控日誌**
   ```bash
   tail -f logs/account-fix-*.log
   ```

4. **定期檢查**
   - 每週執行一次 `npm run fix:accounts:report`
   - 監控孤立帳號數量趨勢

5. **防止問題根源**
   - 在帳號創建時添加前端驗證
   - 在 Supabase 添加 NOT NULL 觸發器
   - 要求 name 必填

---

## 🔐 安全性

- ✅ 使用 SERVICE_ROLE_KEY（讀寫權限）
- ✅ 所有操作都有日誌記錄
- ✅ 支持預覽模式（--dry-run）
- ❌ 不要把 .env 提交到 Git
- ❌ 不要在公共場合共享 SERVICE_ROLE_KEY

---

## 📞 支持

有問題？檢查：
1. 日誌文件 `logs/account-fix-*.log`
2. Supabase 控制台的 SQL Editor
3. 執行 `npm run fix:accounts:report` 查看詳細報告

---

**最後更新**：2026-01-14  
**作者**：Claude Code  
**版本**：1.0
