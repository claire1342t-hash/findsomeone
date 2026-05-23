# 重要帳密與設定備份清單（範本）

> **勿將填寫後的本檔 commit 到 Git。** 建議放在 1Password / Bitwarden / Apple 密碼 的「Findsomeone Ops」安全筆記，或加密離線備份。

最後更新：________（填寫人：________）

---

## 1. 網域與 DNS

| 項目 | 記錄位置 | 備註 |
|------|----------|------|
| 網域註冊商 | | findsomeone.co |
| DNS 託管 | | A/CNAME → Vercel |
| www / apex | | www 為主站；apex → www |

---

## 2. Vercel

| 項目 | 記錄位置 | 備註 |
|------|----------|------|
| 登入帳號 | | |
| Team / Project 名稱 | | findsomeone |
| Production 分支 | | 通常 `main` |
| 自訂網域 | | www.findsomeone.co |
| 環境變數清單 | Vercel → Settings → Environment Variables | 見下方 §5 |

---

## 3. Firebase（`findsomeone-35c7f`）

| 項目 | 記錄位置 | 備註 |
|------|----------|------|
| Google 帳號（專案擁有者） | | |
| Console URL | | https://console.firebase.google.com/project/findsomeone-35c7f |
| Web App 設定 | Console → Project settings | `REACT_APP_FIREBASE_*` |
| Service Account | Console → IAM / 服務帳戶 JSON | 僅 Vercel `FIREBASE_SERVICE_ACCOUNT_JSON`；勿外流 |
| 管理員 UID | Firestore `users/{uid}.isAdmin` | 記錄誰是 admin，非密碼 |
| Auth 已授權網域 | Authentication → Settings | 見 `docs/OPS-32-36.md` §33 |

---

## 4. Resend（郵件 API）

| 項目 | 記錄位置 | 備註 |
|------|----------|------|
| Resend 登入 | | |
| API Key 名稱 / 建立日 | Resend Dashboard | 對應 `RESEND_API_KEY` |
| 寄件網域 / From | | `RESEND_FROM` |
| DNS（SPF/DKIM） | Resend + DNS 商 | |

---

## 5. 環境變數對照（名稱 only，值存密碼庫）

### 前端（Vercel，`REACT_APP_`）

- `REACT_APP_FIREBASE_API_KEY`
- `REACT_APP_FIREBASE_AUTH_DOMAIN`
- `REACT_APP_FIREBASE_PROJECT_ID`
- `REACT_APP_FIREBASE_STORAGE_BUCKET`
- `REACT_APP_FIREBASE_MESSAGING_SENDER_ID`
- `REACT_APP_FIREBASE_APP_ID`
- `REACT_APP_AUTH_CONTINUE_URL`（建議 `https://www.findsomeone.co/profile`）

### 伺服器（Vercel，`api/sendEmail`）

- `RESEND_API_KEY`
- `RESEND_FROM`
- `FIREBASE_WEB_API_KEY`
- `FIREBASE_SERVICE_ACCOUNT_JSON`
- `CONTACT_EMAIL`
- `REPORT_NOTIFY_EMAIL`（可選）

---

## 6. GitHub

| 項目 | 記錄位置 | 備註 |
|------|----------|------|
| Repo URL | | github.com/claire1342t-hash/findsomeone |
| 部署連線 | Vercel Git Integration | |

---

## 7. 金鑰輪替紀錄

| 日期 | 項目 | 原因 | 執行人 |
|------|------|------|--------|
| | | | |

---

## 8. 緊急聯絡

| 角色 | 聯絡方式 |
|------|----------|
| 技術負責 | |
| 對外客服信箱 | About 表單 → `CONTACT_EMAIL` |
