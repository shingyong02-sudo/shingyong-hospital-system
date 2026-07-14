-- ============================================================
-- Supabase 觸發器：防止不完整帳號建立
-- 功能：確保 name 欄位必填，防止孤立記錄產生
-- ============================================================

-- 1. 創建函數：驗證帳號完整性
CREATE OR REPLACE FUNCTION public.validate_user_completeness()
RETURNS TRIGGER AS $$
BEGIN
  -- 驗證 name 欄位非空
  IF NEW.name IS NULL OR NEW.name = '' THEN
    RAISE EXCEPTION 'User name is required (不能為空)';
  END IF;

  -- 驗證 email 唯一性
  IF EXISTS (
    SELECT 1 FROM public.users
    WHERE email = NEW.email AND id != NEW.id
  ) THEN
    RAISE EXCEPTION 'Email already registered (EMAIL已被註冊)';
  END IF;

  -- 驗證 email 格式
  IF NEW.email NOT LIKE '%@%.%' THEN
    RAISE EXCEPTION 'Invalid email format (EMAIL格式不正確)';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. 建立觸發器：在插入或更新時執行驗證
DROP TRIGGER IF EXISTS trigger_validate_user_completeness ON public.users;

CREATE TRIGGER trigger_validate_user_completeness
BEFORE INSERT OR UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION validate_user_completeness();

-- 3. 創建函數：自動清理孤立記錄（備用）
CREATE OR REPLACE FUNCTION public.cleanup_orphaned_users()
RETURNS TABLE(deleted_count INT) AS $$
DECLARE
  v_deleted_count INT;
BEGIN
  DELETE FROM public.users
  WHERE (name IS NULL OR name = '')
  AND created_at < NOW() - INTERVAL '1 day';

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN QUERY SELECT v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 4. 檢查重複 EMAIL 的函數
CREATE OR REPLACE FUNCTION public.get_duplicate_emails()
RETURNS TABLE(email TEXT, count INT, user_ids TEXT[]) AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.email,
    COUNT(*)::INT as count,
    ARRAY_AGG(u.id) as user_ids
  FROM public.users u
  GROUP BY u.email
  HAVING COUNT(*) > 1;
END;
$$ LANGUAGE plpgsql;

-- 5. 檢查孤立帳號的函數
CREATE OR REPLACE FUNCTION public.get_orphaned_users()
RETURNS TABLE(id TEXT, email TEXT, created_at TIMESTAMP) AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id,
    u.email,
    u.created_at
  FROM public.users u
  WHERE u.name IS NULL OR u.name = '';
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 部署指南
-- ============================================================
/*

在 Supabase SQL Editor 中執行上述 SQL：

1. 開啟 https://supabase.com/dashboard
2. 選擇專案 → SQL Editor
3. 點擊 "New query"
4. 複製並執行上述整個 SQL 塊
5. 查看執行結果 (should see "Query successful")

驗證部署：

-- 查看觸發器是否存在
SELECT * FROM pg_triggers WHERE tgname = 'trigger_validate_user_completeness';

-- 查看函數是否存在
SELECT * FROM pg_proc WHERE proname IN (
  'validate_user_completeness',
  'cleanup_orphaned_users',
  'get_duplicate_emails',
  'get_orphaned_users'
);

-- 測試觸發器（應該失敗，因為 name 為空）
INSERT INTO public.users (email, name) VALUES ('test@example.com', '');
-- 預期錯誤: "User name is required"

-- 測試成功插入
INSERT INTO public.users (email, name) VALUES ('valid@example.com', '張三');

*/

-- ============================================================
-- 定期清理任務（可選）
-- ============================================================

-- 如果 Supabase 支持 pg_cron 擴展，可以設置定期任務：
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 每日凌晨 2 點自動清理孤立帳號
-- SELECT cron.schedule('cleanup-orphaned-users', '0 2 * * *',
--   'SELECT public.cleanup_orphaned_users();'
-- );

-- ============================================================
-- 清理腳本（如需恢復原狀）
-- ============================================================

/*

-- 刪除觸發器
DROP TRIGGER IF EXISTS trigger_validate_user_completeness ON public.users;

-- 刪除函數
DROP FUNCTION IF EXISTS public.validate_user_completeness();
DROP FUNCTION IF EXISTS public.cleanup_orphaned_users();
DROP FUNCTION IF EXISTS public.get_duplicate_emails();
DROP FUNCTION IF EXISTS public.get_orphaned_users();

*/
