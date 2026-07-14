# 🔧 EMAIL 重複問題 - 完整解決方案

**問題**：EMAIL `kctu@tapmc.com.tw` 已被註冊，但帳號未建立  
**狀態**：🟥 需要立即修復  
**預期時間**：10 分鐘

---

## ⚡ 快速修復（5 分鐘）

### 步驟 1：登入 Supabase

打開 https://supabase.com/dashboard/project/qztffronusdhgxhjjubt/sql

### 步驟 2：執行診斷查詢

複製並執行：

```sql
-- 查詢問題 EMAIL 的所有記錄
SELECT id, email, name, created_at, updated_at, status 
FROM public.users 
WHERE email = 'kctu@tapmc.com.tw'
ORDER BY created_at DESC;
```

**記下結果**（會看到多少筆記錄，name 是什麼）

### 步驟 3：清理孤立記錄

根據查詢結果，執行對應的清理 SQL：

#### 情況 A：只有 1 筆記錄且 name 為空

```sql
DELETE FROM public.users 
WHERE email = 'kctu@tapmc.com.tw' 
AND (name IS NULL OR name = '');

-- 驗證
SELECT COUNT(*) FROM public.users WHERE email = 'kctu@tapmc.com.tw';
-- 應該返回 0
```

#### 情況 B：多筆記錄（需要保留完整的）

```sql
-- 先查看所有記錄的詳情
SELECT id, email, name, created_at FROM public.users 
WHERE email = 'kctu@tapmc.com.tw';

-- 刪除所有孤立記錄（name 為空的）
DELETE FROM public.users 
WHERE email = 'kctu@tapmc.com.tw' 
AND (name IS NULL OR name = '');

-- 如果還有剩餘記錄且需要刪除，指定 ID：
-- DELETE FROM public.users WHERE id = '具體的-id';

-- 驗證
SELECT * FROM public.users WHERE email = 'kctu@tapmc.com.tw';
```

#### 情況 C：強制清理所有（最激進）

```sql
-- 刪除該 EMAIL 的所有記錄
DELETE FROM public.users 
WHERE email = 'kctu@tapmc.com.tw';

-- 驗證已清理
SELECT COUNT(*) FROM public.users WHERE email = 'kctu@tapmc.com.tw';
-- 應該返回 0
```

### 步驟 4：驗證修復成功

```sql
-- 檢查是否還有問題
SELECT COUNT(*) as orphaned_count 
FROM public.users 
WHERE (name IS NULL OR name = '')
AND email = 'kctu@tapmc.com.tw';
-- 應該返回 0

-- 查看所有孤立帳號
SELECT email, COUNT(*) as count
FROM public.users
WHERE name IS NULL OR name = ''
GROUP BY email;
-- 不應該有任何結果，或者非常少
```

### 步驟 5：測試新建帳號

現在嘗試在系統中新建 "涂昆祺" 帳號，使用 `kctu@tapmc.com.tw`  
✅ 應該能成功建立了

---

## 🛡️ 防止未來問題（3 分鐘）

完成上述清理後，立即執行以下 SQL 設置觸發器：

```sql
-- ============================================
-- 觸發器：防止不完整帳號建立
-- ============================================

-- 1. 驗證帳號完整性函數
CREATE OR REPLACE FUNCTION public.validate_user_completeness()
RETURNS TRIGGER AS $$
BEGIN
  -- 檢查 name 是否為空
  IF NEW.name IS NULL OR TRIM(NEW.name) = '' THEN
    RAISE EXCEPTION '帳號名稱不能為空 (name cannot be empty)';
  END IF;

  -- 檢查 email 是否為空
  IF NEW.email IS NULL OR TRIM(NEW.email) = '' THEN
    RAISE EXCEPTION 'Email 不能為空 (email cannot be empty)';
  END IF;

  -- 檢查 email 格式
  IF NEW.email NOT LIKE '%@%.%' THEN
    RAISE EXCEPTION 'Email 格式不正確 (invalid email format)';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. 刪除舊觸發器（如果存在）
DROP TRIGGER IF EXISTS trigger_validate_user_completeness ON public.users;

-- 3. 建立新觸發器
CREATE TRIGGER trigger_validate_user_completeness
BEFORE INSERT OR UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION validate_user_completeness();

-- 4. 驗證觸發器已建立
SELECT * FROM pg_triggers WHERE tgname = 'trigger_validate_user_completeness';
-- 應該返回一筆記錄
```

**測試觸發器**：

```sql
-- 這應該會失敗（name 為空）
INSERT INTO public.users (email, name) 
VALUES ('test@example.com', '');
-- 預期錯誤：帳號名稱不能為空

-- 這應該成功
INSERT INTO public.users (email, name) 
VALUES ('test@example.com', '測試帳號');
```

---

## 📋 完整操作步驟列表

```
☐ 1. 打開 Supabase SQL Editor
☐ 2. 執行診斷查詢（SELECT ... WHERE email = 'kctu@tapmc.com.tw'）
☐ 3. 根據結果選擇情況 A/B/C 執行清理 SQL
☐ 4. 執行驗證查詢確認已清理
☐ 5. 執行觸發器 SQL 防止未來問題
☐ 6. 測試：在系統中新建帳號（應該能成功）
☐ 7. 監控：運行檢查腳本確認無孤立帳號

npm run fix:accounts:check
```

---

## 🎯 如果還是不行

### 檢查清單

```bash
# 1. 驗證 users 表存在
SELECT * FROM information_schema.tables 
WHERE table_name = 'users' AND table_schema = 'public';

# 2. 查看 users 表的所有欄位
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'users';

# 3. 查看有多少用戶
SELECT COUNT(*) FROM public.users;

# 4. 查看有多少孤立帳號
SELECT COUNT(*) FROM public.users 
WHERE name IS NULL OR name = '';

# 5. 查看所有孤立帳號
SELECT id, email, created_at FROM public.users 
WHERE name IS NULL OR name = '';
```

### 常見問題

| 問題 | 解決方案 |
|------|--------|
| 執行 DELETE 後沒有效果 | 檢查是否按了 "Run" 按鈕 |
| 錯誤：permission denied | 確保用戶有足夠權限（應該有） |
| 找不到該 EMAIL 的記錄 | 可能已經被刪除，或者在不同的表 |
| 觸發器沒生效 | 檢查 `pg_triggers` 確認觸發器存在 |

---

## ✅ 成功標誌

完成後應該看到：

```
✓ SELECT 查詢返回 0 筆記錄（該 EMAIL 已清理）
✓ 觸發器已建立（pg_triggers 能查到）
✓ 新帳號能夠正確建立
✓ 孤立帳號檢查返回空結果
```

---

## 📞 我能幫什麼

如果您完成後截圖，我可以：
- ✅ 驗證修復是否成功
- ✅ 幫您設置自動監控
- ✅ 配置定期清理任務
- ✅ 整合 Slack 告警通知

---

**準備好了嗎？** 

先執行 **步驟 1-2** 的診斷查詢，把結果截圖給我，我再告訴您具體執行哪個清理方案！

