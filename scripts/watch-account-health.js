#!/usr/bin/env node
/**
 * 帳號系統健康監控腳本
 * 實時監控孤立帳號和 EMAIL 重複情況
 * 使用：npm run fix:accounts:watch
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CHECK_INTERVAL = parseInt(process.env.CHECK_INTERVAL || '300000'); // 預設 5 分鐘

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ 環境變數未設置');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// 狀態追蹤
let lastOrphanedCount = 0;
let lastDuplicateCount = 0;
let alerts = [];

/**
 * 美化輸出
 */
function printHeader(title) {
  console.log(`\n╔${'═'.repeat(title.length + 2)}╗`);
  console.log(`║ ${title} ║`);
  console.log(`╚${'═'.repeat(title.length + 2)}╝`);
}

function printStatus(label, value, status = 'info') {
  const icons = { ok: '✓', warn: '⚠️', error: '❌' };
  const icon = icons[status] || '•';
  const time = new Date().toLocaleTimeString('zh-TW');
  console.log(`[${time}] ${icon} ${label}: ${value}`);
}

/**
 * 檢查孤立帳號
 */
async function checkOrphanedAccounts() {
  const { data, error } = await supabase
    .from('users')
    .select('id, email, created_at')
    .or('name.is.null,name.eq.');

  if (error) {
    printStatus('孤立帳號檢查', `失敗 - ${error.message}`, 'error');
    return 0;
  }

  const count = data ? data.length : 0;

  if (count > lastOrphanedCount) {
    printStatus('孤立帳號', `${count} 個 (↑ +${count - lastOrphanedCount})`, 'warn');
    alerts.push({
      time: new Date(),
      type: 'orphaned_increase',
      message: `孤立帳號增加: ${lastOrphanedCount} → ${count}`,
      emails: data.slice(-3).map(u => u.email)
    });
  } else if (count < lastOrphanedCount) {
    printStatus('孤立帳號', `${count} 個 (↓ -${lastOrphanedCount - count})`, 'ok');
  } else if (count > 0) {
    printStatus('孤立帳號', `${count} 個`, 'warn');
  } else {
    printStatus('孤立帳號', '無', 'ok');
  }

  lastOrphanedCount = count;
  return count;
}

/**
 * 檢查 EMAIL 重複
 */
async function checkDuplicateEmails() {
  const { data, error } = await supabase
    .from('users')
    .select('email');

  if (error) {
    printStatus('EMAIL 檢查', `失敗 - ${error.message}`, 'error');
    return 0;
  }

  if (!data) return 0;

  const emailGroups = {};
  data.forEach(user => {
    if (!emailGroups[user.email]) {
      emailGroups[user.email] = [];
    }
    emailGroups[user.email].push(user);
  });

  const duplicates = Object.entries(emailGroups)
    .filter(([_, users]) => users.length > 1)
    .length;

  if (duplicates > lastDuplicateCount) {
    printStatus('重複 EMAIL', `${duplicates} 個 (↑ +${duplicates - lastDuplicateCount})`, 'error');
    alerts.push({
      time: new Date(),
      type: 'duplicate_increase',
      message: `重複 EMAIL 增加: ${lastDuplicateCount} → ${duplicates}`
    });
  } else if (duplicates < lastDuplicateCount) {
    printStatus('重複 EMAIL', `${duplicates} 個 (↓ -${lastDuplicateCount - duplicates})`, 'ok');
  } else if (duplicates > 0) {
    printStatus('重複 EMAIL', `${duplicates} 個`, 'warn');
  } else {
    printStatus('重複 EMAIL', '無', 'ok');
  }

  lastDuplicateCount = duplicates;
  return duplicates;
}

/**
 * 獲取總帳號數
 */
async function getTotalUsers() {
  const { count, error } = await supabase
    .from('users')
    .select('*', { count: 'exact' });

  if (error) return 0;
  return count || 0;
}

/**
 * 顯示告警列表
 */
function displayAlerts() {
  if (alerts.length === 0) {
    console.log('\n📭 無告警');
    return;
  }

  console.log(`\n📢 最近告警 (${alerts.length})`);
  alerts.slice(-5).forEach((alert, i) => {
    const time = alert.time.toLocaleTimeString('zh-TW');
    console.log(`  ${i + 1}. [${time}] ${alert.message}`);
    if (alert.emails) {
      alert.emails.forEach(email => console.log(`     • ${email}`));
    }
  });

  if (alerts.length > 5) {
    console.log(`  ... 以及 ${alerts.length - 5} 個更早的告警`);
  }
}

/**
 * 詳細報告
 */
function printDetailedReport() {
  console.log('\n\n');
  printHeader('詳細健康檢查');

  const healthScore = calculateHealthScore();
  const scoreBar = '█'.repeat(Math.floor(healthScore / 10)) +
                   '░'.repeat(10 - Math.floor(healthScore / 10));

  console.log(`\n健康指數: [${scoreBar}] ${healthScore}%`);

  if (healthScore >= 90) {
    console.log('狀態: ✓ 優秀');
  } else if (healthScore >= 70) {
    console.log('狀態: ⚠️  良好');
  } else if (healthScore >= 50) {
    console.log('狀態: ⚠️  需要關注');
  } else {
    console.log('狀態: ❌ 需要立即修復');
  }

  console.log(`\n建議行動:`);
  if (lastOrphanedCount > 0) {
    console.log(`  1. 執行清理: npm run fix:accounts:fix`);
  }
  if (lastDuplicateCount > 0) {
    console.log(`  2. 查看重複: npm run fix:accounts:report`);
  }
  console.log(`  3. 監控日誌: tail -f logs/account-*.log`);
}

/**
 * 計算健康指數
 */
function calculateHealthScore() {
  let score = 100;

  // 孤立帳號扣分
  if (lastOrphanedCount > 0) score -= Math.min(20, lastOrphanedCount * 5);

  // EMAIL 重複扣分
  if (lastDuplicateCount > 0) score -= Math.min(30, lastDuplicateCount * 10);

  // 告警扣分
  if (alerts.length > 10) score -= 10;

  return Math.max(0, score);
}

/**
 * 主監控循環
 */
async function monitor() {
  printHeader('帳號系統健康監控');
  console.log(`⏰ 監控間隔: 每 ${CHECK_INTERVAL / 1000} 秒`);
  console.log(`📍 數據源: ${SUPABASE_URL}`);
  console.log(`📅 啟動時間: ${new Date().toLocaleString('zh-TW')}`);
  console.log('\n按 Ctrl+C 停止監控\n');

  let checkCount = 0;

  const runCheck = async () => {
    checkCount++;
    console.log(`\n${'─'.repeat(50)}`);
    console.log(`檢查 #${checkCount} - ${new Date().toLocaleString('zh-TW')}`);
    console.log('─'.repeat(50));

    const total = await getTotalUsers();
    printStatus('總帳號數', total);

    await checkOrphanedAccounts();
    await checkDuplicateEmails();

    displayAlerts();

    // 每 6 次檢查（30 分鐘）顯示詳細報告
    if (checkCount % 6 === 0) {
      printDetailedReport();
    }
  };

  // 立即執行一次
  await runCheck();

  // 定期檢查
  setInterval(runCheck, CHECK_INTERVAL);
}

// 優雅退出
process.on('SIGINT', () => {
  console.log('\n\n👋 監控已停止');
  console.log(`共執行 ${lastOrphanedCount} 次檢查`);
  process.exit(0);
});

// 啟動監控
monitor().catch(err => {
  console.error('❌ 監控失敗:', err);
  process.exit(1);
});
