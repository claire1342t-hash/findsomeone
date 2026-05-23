# 上線前檢查 16–19 執行紀錄

## 16. 環境變數未 commit

**已做：**

- `.gitignore` 忽略 `.env`、`.env.*`（保留 `.env.example`）
- 新增 `.env.example` 列出變數名稱（無真實密鑰）
- 腳本 `scripts/check-no-secrets-in-git.sh` 可於 CI／本機執行

**請你手動確認：**

```bash
cd findsomeone
./scripts/check-no-secrets-in-git.sh
git log --all --full-history -- .env   # 應無輸出；若有曾 commit 需 rotate 金鑰
```

**Vercel Production** 應設定：`REACT_APP_FIREBASE_*`、`RESEND_*`、`FIREBASE_WEB_API_KEY`、`FIREBASE_SERVICE_ACCOUNT_JSON`（或同等）、`CONTACT_EMAIL`、`REPORT_NOTIFY_EMAIL`（可選）。

---

## 17. 管理員 `isAdmin` 與 `/admin`

**已實作：**

- Firestore：`isAdmin` / `isBanned` 客戶端不可改（`privilegedUserFieldsUnchanged`）
- `Admin.jsx`：進頁前 `getDoc(users/{uid})`，非 `isAdmin === true` 導回首頁
- `SiteHeader`：僅 `isAdmin` 顯示 Admin 連結
- 一般使用者即使知道 `/admin` URL 也無法載入資料（規則 + 前端導回）

**請你手動確認：**

1. Firebase Console → Firestore → `users/{你的UID}` → `isAdmin: true`
2. 一般帳號開 `https://www.findsomeone.co/admin` → 應被導走

---

## 18. 檢舉

**已實作：**

- `Map.jsx` / `Chat.jsx`：`addDoc(reports)`，欄位符合 rules
- `Admin.jsx`：即時列表、`status: resolved`、`reviewedAt`、`reviewedBy`
- Rules：登入者可 `create`；僅本人讀自己的檢舉；`update`/`delete` 僅 `isAdmin`

**請你手動確認：**

1. 登入 → 地圖或聊天提交檢舉 → Firestore 出現 `reports` 文件、`status: pending`
2. 管理員 `/admin` → 檢舉區 → 點「已處理」→ `status` 變 `resolved`

---

## 19. 停權 `isBanned`

**已實作：**

- `Login.jsx`：密碼登入後若 `isBanned` → `signOut` + 錯誤訊息
- `AuthContext`：session 還原時若已停權 → 自動登出
- `Post.jsx`、`Map.jsx`（送出驗證）、`Chat.jsx`（送訊息）呼叫 `ensureUserNotBanned`
- Firestore：`isNotBanned()` 套用在發文、回覆、聊天、訊息、檢舉等寫入

**請你手動確認：**

1. Console 將測試帳號 `users/{uid}.isBanned` 設為 `true`
2. 該帳號登入應失敗或立刻被登出
3. 已登入後被停權 → 重新整理應被登出；發文／回覆／聊天應被 rules 拒絕
