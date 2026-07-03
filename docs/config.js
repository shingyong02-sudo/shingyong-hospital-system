// Supabase 前台連線設定（唯讀）。
// 這裡放的是 publishable（anon）金鑰 —— 設計上就是可公開的：
// 資料表已開啟 RLS，anon 只能「讀取」，無法寫入或竄改。
window.SUPABASE_CONFIG = {
  url: 'https://xhtnaxwcqqdsdkxjbhvk.supabase.co',
  anonKey: 'sb_publishable_XlxygQIYFnGf3ZcxaaYCdw_Fm84tZ6_',
};
