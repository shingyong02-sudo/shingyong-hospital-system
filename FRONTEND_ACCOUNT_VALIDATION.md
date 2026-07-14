# 前端帳號驗證方案 - 完整實現

**目標**：在帳號創建表單添加客戶端驗證，防止 EMAIL 重複註冊  
**難度**：⭐ 簡單  
**實施時間**：5-10 分鐘

---

## 📋 驗證規則

| 欄位 | 規則 | 錯誤訊息 |
|------|------|--------|
| 帳號名稱 | 必填，長度 2-50 字 | 帳號名稱不能為空（2-50 字） |
| Email | 必填，有效格式 | Email 不能為空或格式錯誤 |
| Email | 不能重複 | 此 Email 已被使用 |

---

## 🔧 方案 A：快速版（複製即用）

### HTML 表單結構

```html
<!-- 帳號建立表單 -->
<form id="accountForm" onsubmit="handleCreateAccount(event)">
  
  <!-- 帳號名稱 -->
  <div class="form-group">
    <label for="nameInput">帳號名稱 *</label>
    <input 
      type="text" 
      id="nameInput" 
      name="name"
      placeholder="例：涂昆祺"
      maxlength="50"
      required
    />
    <small id="nameError" class="error-msg"></small>
  </div>

  <!-- Email -->
  <div class="form-group">
    <label for="emailInput">Email *</label>
    <input 
      type="email" 
      id="emailInput" 
      name="email"
      placeholder="例：kctu@tapmc.com.tw"
      required
    />
    <small id="emailError" class="error-msg"></small>
  </div>

  <!-- 提交按鈕 -->
  <button type="submit" id="submitBtn" class="btn-primary">
    建立帳號
  </button>

</form>

<!-- CSS 樣式 -->
<style>
  .form-group {
    margin-bottom: 15px;
  }
  
  .form-group label {
    display: block;
    margin-bottom: 5px;
    font-weight: bold;
  }
  
  .form-group input {
    width: 100%;
    padding: 8px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 14px;
  }
  
  .form-group input:focus {
    outline: none;
    border-color: #007bff;
    box-shadow: 0 0 5px rgba(0, 123, 255, 0.3);
  }
  
  .form-group input.error {
    border-color: #dc3545;
  }
  
  .error-msg {
    color: #dc3545;
    font-size: 12px;
    display: none;
  }
  
  .error-msg.show {
    display: block;
  }
  
  .btn-primary {
    background-color: #007bff;
    color: white;
    padding: 10px 20px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
  }
  
  .btn-primary:hover {
    background-color: #0056b3;
  }
  
  .btn-primary:disabled {
    background-color: #ccc;
    cursor: not-allowed;
  }
</style>
```

### JavaScript 驗證代碼

```javascript
/**
 * 帳號表單驗證
 */

// 1. 驗證規則
const ValidationRules = {
  name: {
    required: true,
    minLength: 2,
    maxLength: 50,
    pattern: /^[一-龥a-zA-Z0-9_-]+$/,  // 中文、英文、數字、下划線、連字符
    errorMessages: {
      required: '帳號名稱不能為空',
      minLength: '帳號名稱至少 2 個字',
      maxLength: '帳號名稱最多 50 個字',
      pattern: '帳號名稱只能包含中文、英文、數字、下划線、連字符'
    }
  },
  email: {
    required: true,
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    errorMessages: {
      required: 'Email 不能為空',
      pattern: 'Email 格式不正確'
    }
  }
};

// 2. 驗證函數
class AccountValidator {
  
  // 驗證單個欄位
  static validateField(fieldName, value) {
    const rules = ValidationRules[fieldName];
    if (!rules) return { valid: true };

    // 必填檢查
    if (rules.required && (!value || value.trim() === '')) {
      return {
        valid: false,
        error: rules.errorMessages.required
      };
    }

    // 長度檢查
    if (rules.minLength && value.length < rules.minLength) {
      return {
        valid: false,
        error: rules.errorMessages.minLength
      };
    }

    if (rules.maxLength && value.length > rules.maxLength) {
      return {
        valid: false,
        error: rules.errorMessages.maxLength
      };
    }

    // 格式檢查
    if (rules.pattern && !rules.pattern.test(value)) {
      return {
        valid: false,
        error: rules.errorMessages.pattern
      };
    }

    return { valid: true };
  }

  // 驗證所有欄位
  static validateForm() {
    const nameInput = document.getElementById('nameInput');
    const emailInput = document.getElementById('emailInput');

    const nameValidation = this.validateField('name', nameInput.value);
    const emailValidation = this.validateField('email', emailInput.value);

    // 顯示錯誤訊息
    this.showError('name', nameValidation);
    this.showError('email', emailValidation);

    return nameValidation.valid && emailValidation.valid;
  }

  // 顯示/隱藏錯誤訊息
  static showError(fieldName, validation) {
    const errorEl = document.getElementById(`${fieldName}Error`);
    const inputEl = document.getElementById(`${fieldName}Input`);

    if (!validation.valid) {
      errorEl.textContent = validation.error;
      errorEl.classList.add('show');
      inputEl.classList.add('error');
    } else {
      errorEl.classList.remove('show');
      inputEl.classList.remove('error');
    }
  }

  // 實時驗證（輸入時）
  static attachRealTimeValidation() {
    ['name', 'email'].forEach(fieldName => {
      const inputEl = document.getElementById(`${fieldName}Input`);
      
      inputEl.addEventListener('blur', () => {
        const validation = this.validateField(fieldName, inputEl.value);
        this.showError(fieldName, validation);
      });

      inputEl.addEventListener('input', () => {
        if (inputEl.classList.contains('error')) {
          const validation = this.validateField(fieldName, inputEl.value);
          this.showError(fieldName, validation);
        }
      });
    });
  }
}

// 3. 表單提交處理
async function handleCreateAccount(event) {
  event.preventDefault();

  // 驗證表單
  if (!AccountValidator.validateForm()) {
    console.log('❌ 表單驗證失敗');
    return;
  }

  const name = document.getElementById('nameInput').value.trim();
  const email = document.getElementById('emailInput').value.trim();

  console.log('✓ 表單驗證通過');
  console.log('帳號名稱:', name);
  console.log('Email:', email);

  // 這裡調用您的後端 API 創建帳號
  try {
    const response = await fetch('/api/create-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email })
    });

    const data = await response.json();

    if (response.ok) {
      alert('✓ 帳號建立成功！');
      document.getElementById('accountForm').reset();
    } else {
      alert(`❌ ${data.error || '帳號建立失敗'}`);
    }
  } catch (err) {
    alert(`❌ 錯誤: ${err.message}`);
  }
}

// 4. 初始化
document.addEventListener('DOMContentLoaded', () => {
  AccountValidator.attachRealTimeValidation();
});
```

---

## 🔧 方案 B：增強版（含 EMAIL 去重）

如果需要檢查 EMAIL 是否已存在，添加這個異步驗證：

```javascript
// 擴展驗證類
class EnhancedAccountValidator extends AccountValidator {
  
  // 檢查 EMAIL 是否已存在（異步）
  static async checkEmailExists(email) {
    try {
      const response = await fetch(`/api/check-email?email=${encodeURIComponent(email)}`);
      const data = await response.json();
      return data.exists;
    } catch (err) {
      console.error('檢查 EMAIL 失敗:', err);
      return false;
    }
  }

  // 驗證表單（含異步檢查）
  static async validateFormAsync() {
    // 先做同步驗證
    if (!this.validateForm()) {
      return false;
    }

    const email = document.getElementById('emailInput').value.trim();
    const emailError = document.getElementById('emailError');
    const emailInput = document.getElementById('emailInput');

    // 檢查 EMAIL 是否已存在
    const exists = await this.checkEmailExists(email);
    if (exists) {
      emailError.textContent = '此 Email 已被使用';
      emailError.classList.add('show');
      emailInput.classList.add('error');
      return false;
    }

    return true;
  }
}

// 修改提交函數
async function handleCreateAccount(event) {
  event.preventDefault();

  // 使用異步驗證
  const isValid = await EnhancedAccountValidator.validateFormAsync();
  if (!isValid) {
    console.log('❌ 表單驗證失敗');
    return;
  }

  // ... 後續代碼同上
}
```

---

## 📱 整合步驟

### 步驟 1：識別您的表單

在您的帳號管理頁面找到表單，確認欄位名稱：

```html
<!-- 確認您的表單有這些欄位 -->
<input name="name" ... />    <!-- 帳號名稱 -->
<input name="email" ... />   <!-- Email -->
<button type="submit">建立帳號</button>
```

### 步驟 2：添加驗證代碼

**在您的 HTML 檔案的 `<head>` 或 `</body>` 前添加**：

```html
<script>
// 複製上面的 ValidationRules 和 AccountValidator 類
// 複製 handleCreateAccount 函數
</script>
```

### 步驟 3：測試驗證

1. 打開帳號管理頁面
2. 嘗試提交空表單 → 應該看到錯誤訊息
3. 嘗試輸入無效 EMAIL → 應該看到格式錯誤
4. 正確填入資料 → 應該能提交

---

## ✅ 驗證效果

用戶會看到：

```
✗ 帳號名稱為空時
  ❌ 帳號名稱不能為空

✗ 帳號名稱太短時
  ❌ 帳號名稱至少 2 個字

✗ Email 格式錯誤時
  ❌ Email 格式不正確

✗ 按提交按鈕時
  表單有效 → 發送到後端
  表單無效 → 提示錯誤，不發送
```

---

## 🎯 額外功能（可選）

### 實時驗證反饋

當用戶離開輸入框時自動驗證：

```javascript
// 已在上面的代碼中實現
inputEl.addEventListener('blur', () => {
  // 驗證並顯示錯誤
});

inputEl.addEventListener('input', () => {
  // 邊輸入邊驗證
});
```

### 提交按鈕禁用

```javascript
function updateSubmitButton() {
  const submitBtn = document.getElementById('submitBtn');
  const nameInput = document.getElementById('nameInput');
  const emailInput = document.getElementById('emailInput');

  const isValid = 
    nameInput.value.trim() !== '' &&
    emailInput.value.trim() !== '' &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.value);

  submitBtn.disabled = !isValid;
}

// 監聽輸入
['nameInput', 'emailInput'].forEach(id => {
  document.getElementById(id)?.addEventListener('input', updateSubmitButton);
});
```

---

## 📋 檢查清單

```
✅ 1. 複製 HTML 表單結構
✅ 2. 複製 CSS 樣式
✅ 3. 複製 JavaScript 驗證代碼
✅ 4. 確認表單欄位名稱正確
✅ 5. 測試各種輸入場景
✅ 6. (可選) 添加後端 EMAIL 去重 API
```

---

## 🚀 後端配合（可選）

如果使用方案 B（異步檢查），需要後端 API：

```javascript
// Node.js/Express 例子
app.get('/api/check-email', async (req, res) => {
  const email = req.query.email;
  
  // 查詢數據庫
  const user = await db.users.findOne({ email });
  
  res.json({ exists: !!user });
});
```

---

## 💡 常見問題

### Q：驗證沒有生效？
A：確認：
1. ✅ JavaScript 代碼已加載
2. ✅ 表單欄位 ID 正確（nameInput, emailInput）
3. ✅ 瀏覽器控制台無錯誤（F12 → Console）

### Q：需要後端配合嗎？
A：
- 前端驗證 ✓ 不需要後端
- EMAIL 去重檢查 ✗ 需要後端 API

### Q：如何自訂錯誤訊息？
A：修改 `ValidationRules` 中的 `errorMessages` 物件

---

## 🎉 成果

實施此方案後：
- ✅ 用戶無法提交空表單
- ✅ 用戶無法提交無效 EMAIL
- ✅ 用戶得到即時反饋
- ✅ 減少後端無效請求

**開始實施！** 複製代碼到您的頁面 👇
