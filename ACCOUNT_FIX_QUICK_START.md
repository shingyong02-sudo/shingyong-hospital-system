# 🚀 孤立帳號修復 - 快速開始指南

## 📌 5 分鐘快速開始

### 步驟 1：配置認證 (1 分鐘)

```bash
# 複製環境配置
cp .env.example .env

# 編輯 .env，填入 Service Role Key
# SUPABASE_SERVICE_ROLE_KEY=你的-service-role-key
```

**💡 在哪裡找 Service Role Key？**
1. 登入 [Supabase Dashboard](https://supabase.com/dashboard)
2. 進入專案 → Settings → API → Service Role Key
3. 複製 (不要用 Anon Key！)

### 步驟 2：檢查問題 (1 分鐘)

```bash
npm run fix:accounts:check
```

**會顯示：**
- 總帳號數
- 孤立帳號列表
- EMAIL 重複情況

### 步驟 3：預覽修復 (1 分鐘)

```bash
npm run fix:accounts:preview
```

**安全預覽，不會真正刪除**

### 步驟 4：執行修復 (1 分鐘)

```bash
npm run fix:accounts:fix
```

**實際刪除孤立帳號**

### 步驟 5：驗證結果 (1 分鐘)

```bash
npm run fix:accounts:report
```

**確認問題已解決** ✓

---

## 🎯 針對您的具體問題

您遇到的問題：
```
帳號 "涂昆祺" 尚未建立
但 EMAIL (kctu@tapmc.com.tw) 已被註冊
```

**快速修復：**

```bash
# 1. 檢查
npm run fix:accounts:check
# 應該會看到 kctu@tapmc.com.tw 在孤立帳號列表中

# 2. 預覽
npm run fix:accounts:preview
# 確認會刪除正確的記錄

# 3. 修復
npm run fix:accounts:fix
# 刪除孤立的 EMAIL 記錄

# 4. 驗證
npm run fix:accounts:check
# 確認已清理
```

完成後，"涂昆祺" 就可以重新建立帳號了。

---

## 📋 命令速查表

| 目的 | 命令 | 風險 |
|------|------|------|
| 檢查孤立帳號 | `npm run fix:accounts:check` | ✅ 安全 |
| 預覽刪除操作 | `npm run fix:accounts:preview` | ✅ 安全 |
| 清理孤立帳號 | `npm run fix:accounts:fix` | ⚠️ 會刪除 |
| 生成報告 | `npm run fix:accounts:report` | ✅ 安全 |
| 持續監控 | `npm run fix:accounts:watch` | ✅ 安全 |

---

## 🛡️ 防止未來發生

### 方案 A：Supabase 觸發器（推薦）

在 Supabase SQL Editor 執行：

```bash
# 1. 開啟 Supabase Dashboard
https://supabase.com/dashboard/project/qztffronusdhgxhjjubt/sql

# 2. 複製所有 SQL 代碼
cat scripts/supabase-trigger-setup.sql

# 3. 貼入並執行

# 4. 完成！之後新帳號必須完整
```

**效果**：
- ✅ 防止 name 為空的帳號創建
- ✅ 防止 EMAIL 重複註冊
- ✅ 驗證 EMAIL 格式

### 方案 B：自動定期清理（備選）

```bash
npm run fix:accounts:watch
```

在背景持續監控，每 5 分鐘檢查一次。

---

## 📁 文件位置

```
C:\claude-code\shingyong\
├── scripts/
│   ├── fix-orphaned-accounts.js     ← 主修復腳本
│   ├── watch-account-health.js      ← 監控腳本
│   ├── supabase-trigger-setup.sql   ← Supabase 觸發器
│   └── ACCOUNT_FIX_README.md        ← 詳細文檔
├── .env                             ← 配置檔案 (需要編輯)
├── package.json                     ← npm scripts
└── logs/                            ← 自動生成的日誌
    └── account-fix-YYYY-MM-DD.log
```

---

## ❓ FAQ

### Q1：Service Role Key 在哪裡找？
**A**：
1. Supabase Dashboard → Settings → API
2. 複製 "Service Role Key" (不是 "anon key"！)
3. 貼入 `.env` 的 `SUPABASE_SERVICE_ROLE_KEY=`

### Q2：刪除後能恢復嗎？
**A**：
- ❌ 不能。刪除是永久的
- ✅ 但用戶可以重新註冊
- ✅ 建議先做 `--dry-run` 預覽

### Q3：多久執行一次？
**A**：
- 建議每週檢查一次：`npm run fix:accounts:check`
- 或啟用持續監控：`npm run fix:accounts:watch`
- Supabase 觸發器 24/7 防止新問題

### Q4：會不會影響正常用戶？
**A**：
- ✅ 不會。只刪除孤立帳號（name 為空）
- ✅ 完整帳號完全不受影響

### Q5：執行中能中止嗎？
**A**：
- ✅ 可以按 Ctrl+C 中止
- ✅ 已刪除的帳號無法恢復
- ✅ 建議先做預覽

---

## 🔧 故障排除

### 錯誤：認證失敗
```
❌ 環境變數未設置: SUPABASE_SERVICE_ROLE_KEY
```
✅ 解決：編輯 `.env` 檔案，填入正確的 Service Role Key

### 錯誤：無權限
```
❌ permission denied
```
✅ 解決：確保使用 Service Role Key (不是 Anon Key)

### 查不到孤立帳號？
```
✓ 無孤立帳號
```
✅ 表示系統已經很健康！

---

## 📞 需要幫助？

檢查日誌：
```bash
tail -f logs/account-fix-*.log
```

查看詳細文檔：
```bash
cat scripts/ACCOUNT_FIX_README.md
```

---

## ✅ 完整流程檢查清單

- [ ] 複製 .env.example → .env
- [ ] 填入 SUPABASE_SERVICE_ROLE_KEY
- [ ] 執行 `npm run fix:accounts:check`
- [ ] 執行 `npm run fix:accounts:preview`
- [ ] 執行 `npm run fix:accounts:fix`
- [ ] 執行 `npm run fix:accounts:report` 驗證
- [ ] (可選) 在 Supabase 設置觸發器防止未來問題
- [ ] (可選) 啟用定期監控 `npm run fix:accounts:watch`

---

**成功！您的帳號系統已修復並受到保護。** 🎉

---

## 下一步

1. **防止未來問題**：執行 Supabase 觸發器 SQL
2. **持續監控**：設置定期檢查任務
3. **告警通知**：配置 Slack 整合（可選）

---

**最後更新**：2026-01-14  
**版本**：1.0
