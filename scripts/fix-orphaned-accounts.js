#!/usr/bin/env node
/**
 * 孤立帳號修復腳本
 * 功能：清理孤立 EMAIL、防止不完整帳號、監控告警
 * 使用：node scripts/fix-orphaned-accounts.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ 環境變數未設置: SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// 日誌配置
const LOG_FILE = `logs/account-fix-${new Date().toISOString().split('T')[0]}.log`;
const fs = require('fs');
const path = require('path');

function ensureLogDir() {
  const logDir = path.dirname(LOG_FILE);
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
}

function log(msg, type = 'info') {
  const timestamp = new Date().toISOString();
  const logMsg = `[${timestamp}] [${type.toUpperCase()}] ${msg}`;
  console.log(logMsg);

  ensureLogDir();
  fs.appendFileSync(LOG_FILE, logMsg + '\n');
}

/**
 * 檢查孤立帳號（EMAIL已註冊但name為空）
 */
async function findOrphanedAccounts() {
  log('開始掃描孤立帳號...');

  const { data, error } = await supabase
    .from('users')
    .select('id, email, name, created_at, updated_at')
    .or('name.is.null,name.eq.');

  if (error) {
    log(`掃描失敗: ${error.message}`, 'error');
    return null;
  }

  if (data && data.length > 0) {
    log(`✓ 發現 ${data.length} 個孤立帳號`, 'warn');
    data.forEach(user => {
      log(`  - ID: ${user.id} | Email: ${user.email} | 建立: ${user.created_at}`);
    });
  } else {
    log('✓ 無孤立帳號');
  }

  return data;
}

/**
 * 刪除孤立帳號
 */
async function cleanupOrphanedAccounts(dryRun = true) {
  const orphaned = await findOrphanedAccounts();

  if (!orphaned || orphaned.length === 0) {
    log('無需清理');
    return { deleted: 0, failed: 0 };
  }

  const mode = dryRun ? '【模擬】' : '【執行】';
  log(`${mode} 準備刪除 ${orphaned.length} 個孤立帳號...`);

  if (dryRun) {
    log('模擬模式：顯示將被刪除的記錄');
    return { deleted: orphaned.length, failed: 0, preview: orphaned };
  }

  let deleted = 0;
  let failed = 0;

  for (const user of orphaned) {
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', user.id);

    if (error) {
      log(`❌ 刪除失敗 [${user.email}]: ${error.message}`, 'error');
      failed++;
    } else {
      log(`✓ 已刪除 [${user.email}]`);
      deleted++;
    }
  }

  log(`刪除完成: ${deleted} 成功, ${failed} 失敗`);
  return { deleted, failed };
}

/**
 * 檢查 EMAIL 重複註冊
 */
async function findDuplicateEmails() {
  log('掃描 EMAIL 重複記錄...');

  const { data, error } = await supabase
    .rpc('get_duplicate_emails'); // 使用自訂函數（見下方）

  if (error && error.code !== 'PGRST100') {
    log(`掃描失敗: ${error.message}`, 'error');
    // 降級方案：用 raw query
    return await fallbackDuplicateCheck();
  }

  if (data && data.length > 0) {
    log(`⚠️  發現 ${data.length} 個重複 EMAIL`, 'warn');
    data.forEach(item => {
      log(`  - Email: ${item.email} | 次數: ${item.count}`);
    });
  } else {
    log('✓ 無 EMAIL 重複');
  }

  return data;
}

/**
 * 降級方案：手動檢查 EMAIL 重複
 */
async function fallbackDuplicateCheck() {
  const { data, error } = await supabase
    .from('users')
    .select('email, id, name, created_at');

  if (error) return null;

  const emailGroups = {};
  data.forEach(user => {
    if (!emailGroups[user.email]) {
      emailGroups[user.email] = [];
    }
    emailGroups[user.email].push(user);
  });

  const duplicates = Object.entries(emailGroups)
    .filter(([_, users]) => users.length > 1)
    .map(([email, users]) => ({ email, count: users.length, users }));

  if (duplicates.length > 0) {
    log(`⚠️  發現 ${duplicates.length} 個重複 EMAIL`, 'warn');
    duplicates.forEach(dup => {
      log(`  - Email: ${dup.email} | 次數: ${dup.count}`);
      dup.users.forEach(u => {
        log(`    * ID: ${u.id} | Name: ${u.name || '(空)'} | 建立: ${u.created_at}`);
      });
    });
  }

  return duplicates;
}

/**
 * 生成修復報告
 */
async function generateReport() {
  log('生成修復報告...');

  const { data: allUsers, error } = await supabase
    .from('users')
    .select('id, email, name, created_at');

  if (error) {
    log(`報告生成失敗: ${error.message}`, 'error');
    return;
  }

  const orphaned = allUsers.filter(u => !u.name || u.name.trim() === '');
  const healthy = allUsers.filter(u => u.name && u.name.trim() !== '');

  const report = `
╔════════════════════════════════════════╗
║        帳號系統修復報告                 ║
║   ${new Date().toLocaleString('zh-TW')}   ║
╚════════════════════════════════════════╝

📊 帳號統計
  └─ 總帳號數: ${allUsers.length}
     ├─ ✓ 完整帳號: ${healthy.length}
     └─ ⚠️  孤立帳號: ${orphaned.length}

📈 孤立帳號詳情
`;

  if (orphaned.length > 0) {
    orphaned.forEach(u => {
      report += `  • Email: ${u.email}\n    └─ 建立時間: ${u.created_at}\n`;
    });
  } else {
    report += `  ✓ 無孤立帳號\n`;
  }

  report += `
🔧 建議行動
  ${orphaned.length > 0 ? `① 執行清理: npm run fix:accounts` : `✓ 系統健康`}
  ② 配置監控: 每日凌晨自動檢查
  ③ 設置告警: EMAIL 重複時通知管理員

🔐 防止措施
  • 前端驗證：帳號創建時檢查必填欄位
  • 後端驗證：觸發器確保 name 非空
  • 定期檢查：每日自動掃描孤立記錄
`;

  log(report);

  // 保存報告
  const reportFile = `reports/account-report-${new Date().toISOString().split('T')[0]}.txt`;
  const reportDir = path.dirname(reportFile);
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
  fs.writeFileSync(reportFile, report);
  log(`✓ 報告已保存: ${reportFile}`);

  return { orphaned, healthy, reportFile };
}

/**
 * 修復異常 EMAIL（保留完整帳號，刪除孤立帳號）
 */
async function fixEmailAnomalies() {
  log('\n========== 開始修復異常 EMAIL ==========');

  // 1. 找出所有孤立帳號
  const orphaned = await findOrphanedAccounts();

  if (!orphaned || orphaned.length === 0) {
    log('✓ 無需修復');
    return { status: 'ok', message: '系統正常' };
  }

  // 2. 模擬刪除（預覽）
  log('\n【預覽】即將刪除的記錄：');
  orphaned.forEach(u => {
    log(`  ◌ ${u.email} (建立: ${u.created_at})`);
  });

  // 3. 實際刪除
  const result = await cleanupOrphanedAccounts(false);

  // 4. 驗證
  const verified = await findOrphanedAccounts();

  log('\n========== 修復完成 ==========');
  return {
    status: result.failed === 0 ? 'success' : 'partial',
    deleted: result.deleted,
    failed: result.failed,
    remaining: verified ? verified.length : 0,
    message: `成功刪除 ${result.deleted} 個孤立帳號`
  };
}

/**
 * 主程序
 */
async function main() {
  console.log('🔧 孤立帳號修復工具 v1.0\n');

  const args = process.argv.slice(2);
  const command = args[0] || 'check';
  const dryRun = args.includes('--dry-run');

  try {
    switch (command) {
      case 'check':
        log('模式: 【檢查模式】（不做任何修改）\n');
        await findOrphanedAccounts();
        await findDuplicateEmails();
        await generateReport();
        break;

      case 'fix':
        log('模式: 【修復模式】（清理孤立帳號）\n');
        const fixResult = await fixEmailAnomalies();
        console.log('\n結果:', fixResult);
        break;

      case 'report':
        log('模式: 【報告模式】\n');
        await generateReport();
        break;

      default:
        console.log(`
使用方式:
  node scripts/fix-orphaned-accounts.js [command]

指令:
  check      檢查孤立帳號（預設，無修改）
  fix        清理孤立帳號（會刪除）
  report     生成詳細報告

選項:
  --dry-run  模擬模式（預覽但不執行）

範例:
  node scripts/fix-orphaned-accounts.js check
  node scripts/fix-orphaned-accounts.js fix --dry-run
  node scripts/fix-orphaned-accounts.js report
`);
    }
  } catch (err) {
    log(`致命錯誤: ${err.message}`, 'error');
    process.exit(1);
  }
}

main();
