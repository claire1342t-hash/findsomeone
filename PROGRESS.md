# Findsomeone — 開發進度

## Day 1 (2026-04-27)
- 環境設定：agency-agents 安裝至 .cursor/rules/（UX Architect、UI Designer、Senior Developer、Senior PM）
- Senior Developer stack 從 Laravel 改為 React
- Homepage：Navbar、Hero 區塊、四個功能介紹卡片、復古插圖風格、思源字體
- Post 頁面：Leaflet 地圖選點、描述表單、動機選擇卡片、驗證問題、發布按鈕
- 部署至 Vercel，修正圖片路徑問題

### Day 2 (2026-04-28)
- Footer 版權聲明：Copyright © 2026 Findsomeone. All rights reserved.
- Navbar 語言切換（中文 / English / 日本語）
- Firebase 串接：Auth（Google 登入 + Email/Password）+ Firestore 資料庫
- 登入頁面：Google 登入、email/password、註冊模式、友善錯誤訊息
- Profile 頁面：用戶資訊、發文紀錄、訂閱地點管理、登出
- 匿名名稱生成器（generateAnonymousName.js）：三語言詞庫，搞笑隨機組合
- 安全審查：確認 uid、email、photoURL 不暴露給其他用戶
- 貼文改用 authorPublicId（random token）取代真實 uid
- Post 頁面新增「大概位置描述」欄位
- 地圖頁面：cluster 聚合、自訂 ping.png 圖釘、Bottom Sheet、左右分割細節視圖

### Day 3 (2026-04-29)
post按鈕從hero移到homepage最下面
關毅firebase用google登入的選項
修正行動版layout中地圖頁面點開時，navbar與預覽視窗重疊的錯誤
新增profile pic
Ping icon — 大小變更
「我就是那個人」後續流程 — 驗證問題頁面（/verify/:postId）
變更成配合各種載具的頁面高度
map貼文與細節地方的顯示大小改變
logo換掉
navbar大小變更

### Day 4 (2026-04-30)
- Post 按鈕從 Hero 移到首頁下方，首頁導引流程調整
- 地圖頁面行動版重疊修正（Navbar 與預覽/Bottom Sheet）
- Profile 頭貼功能完成（頭貼選單、儲存、樣式對齊）
- 地圖與貼文細節視圖尺寸/版面調整（含 Ping icon 大小）
- 驗證回覆流程擴充：回覆狀態、重試機制、封鎖狀態文案
- 新增聊天室系統（聊天室列表 / 單一聊天室 / 訊息即時同步）
- 聊天室刪除與貼文刪除串接（含聊天室已刪除狀態顯示）
- Profile 新增「我回覆過的貼文」與回覆狀態標籤
- 登入頁新增密碼顯示/隱藏切換與按鈕樣式優化
- 發文頁驗證加強（必填檢查、空值防呆、動機自訂輸入）
- 匿名名稱產生器調整（統一中文池、建立時固定名稱）
- Firestore 規則與索引補強（responses/chats/messages 權限）
- 語言切換與 i18n 文案大量更新（中/英/日同步）
- Navbar 與 Profile/Chat 多處 UI hover 與互動細節優化

### Day 5 (2026-05-01)
- 相對時間改為依**本地日曆日**計算（今天／昨天／N 天前），修正滾動 24 小時誤判；共用 `src/utils/relativeTime.js`，Map／Profile／Chat／ChatList 套用
- 地圖 Bottom Sheet：列表卡移除情境預覽、只留標題／地點／時間；左右欄可捲區底部**淡出陰影**（捲到底隱藏）
- Profile 貼文／回覆列表可捲區同樣淡出陰影
- 聊天室列表：**到期前 3 天內**顯示「還剩 X 天／不到 1 天」徽章（灰／橘／紅）；移除卡片 **hover 隨機色**
- **貼文與聊天生命週期分離**：刪文／過期刪文不再刪聊天室；刪文前若有進行中聊天室改為二次確認文案；`deletePostCascade` 只刪貼文與 responses
- **Email 通知（MVP）**：`src/utils/sendEmail.js` 以 `fetch` + Firebase ID Token 呼叫 **`api/sendEmail.js`（Vercel Edge + Resend）**；驗證身分後用 service account 讀 Firestore 取收件者；Map 送出回覆後通知貼主、Profile 接受／拒絕後通知回覆者；繁中主旨／內文
- **`vercel.json`**：`filesystem` 後再 SPA fallback，避免 `/api/sendEmail` 被改寫成 `index.html`；並補 CORS headers
- 寄信流程除錯用 **console.log**（客戶端 `[sendEmail:client]`、Edge `[sendEmail]`）；本機可透過 `.env.local` 的 `REACT_APP_SEND_EMAIL_URL` 指向已部署 API
- 移除誤加的 **Firebase Cloud Functions** `functions/` 目錄；`firebase.json` 僅保留 Firestore
- 依賴：`jose`（Edge 簽 JWT 換 Firestore token）
- Vercel 設定修正：`vercel.json` 移除不合法 `rewrites.handle`；SPA rewrite 排除 `/api`，部署恢復正常
- `api/sendEmail.js` 串接整理：`from` 改讀 `RESEND_FROM`、收件者改讀貼文作者 Firestore email，通知信主旨/內文升級為中英日三語（含分隔線）
- 發文頁新增地點關鍵字搜尋（Nominatim）：搜尋結果覆蓋在地圖浮層、可直接跳點放 pin、點選後結果自動收合
- 地圖頁優化：群組清單固定最新貼文在上；細節時間格式改為日期 + 上午/下午（依語言顯示）
- About 頁面暫時回退為「About page coming soon」佔位內容


## 📋 上線前檢查清單（建議依序執行）

### 1. 功能與流程（手動走一遍）

1. v 未登入狀態：瀏覽首頁、地圖、About；需登入的功能有正確提示
2. v 已登入狀態：發文 → 地圖可見 → 他人回覆 → 驗證問答 → 接受／拒絕 → 開啟聊天
3. v 聊天：送訊息、列表顯示、結束聊天、到期提示
4. v 刪文：一般刪除、有進行中聊天室時的二次確認
5. v 自己不能回覆自己的貼文；驗證重試一次、永久關閉等狀態正確
6. v 貼文 7 天到期、聊天室 7 天到期（含徽章提示）行為符合預期
7. [ ] 語言切換（中／英／日）：主要頁面文案與 meta 正常
8. v 手機版 + 桌面版：地圖 Bottom Sheet、詳情區、驗證區展開與捲動
9. v Email：註冊驗證、重設密碼、回覆／配對通知信
10.v About 聯絡表單（登入後送出）

### 2. 安全（優先）

11. [x] 完整審查 Firestore rules（posts / responses / chats / messages / users / notifications）— 見 `docs/FIRESTORE-SECURITY-AUDIT.md`，已強化 `firestore.rules`（需 deploy）
12. [ ] 通知：其他用戶不可 update 別人的通知（建議僅允許 create）
13. [x] ownedPosts：不可偽造 ownership；以 posts.authorUid 等欄位交叉驗證（見 `firestore.rules` `ownedPostsMatchesPost`）
14. [x] responses：responder 不可竄改 status、attemptCount 等敏感欄位（見 `responderResponseUpdateValid`）
15. [ ] `api/sendEmail`：僅登入可呼叫、必要欄位驗證、錯誤不洩漏內部資訊
16. [x] 環境變數（Firebase、Resend、CONTACT_EMAIL 等）僅在 Vercel／本機 env，未 commit 進 git — `.env.example`、`check:secrets`、見 `docs/PRE-LAUNCH-16-19.md`
17. [x] 管理員：`isAdmin` 僅少數帳號；`/admin` 一般使用者無法進入 — rules + `Admin.jsx` 閘道
18. [x] 檢舉：提交有寫入、管理後台可檢視與標記處理 — Map/Chat create、`Admin` resolve
19. [x] 停權帳號無法登入／發文 — `userBan.js`、`AuthContext`、rules `isNotBanned()`

### 3. 資料與驗證

20. [x] 發文／回覆：最小長度、禁止全空白或僅空白字元 — `textValidation.js`
21. [x] 動機與異常欄位：顯示有合理 fallback — `postMotivation.js` `getMotivationLabel`
22. [x] 註冊 displayName 寫入無時序競態問題 — `Login` setDoc + `AuthContext` 不覆寫既有名稱
23. [x] Map 驗證狀態以即時監聽同步 — `onSnapshot` + `mapVerifyResponse.js`

### 4. 效能與 SEO

24. [x] `npm run build` 無錯誤；主要 chunk 大小可接受 — 見 `docs/BUILD-PERFORMANCE.md`，leaflet 獨立拆包
25. [x] 各頁 title、description、canonical 正確（含首頁、About、地圖、發文）— `useDocumentMeta` + `meta.*` i18n
26. [x] robots.txt、sitemap（若有）路徑可開啟 — `public/robots.txt`、`public/sitemap.xml`
27. [x] 圖片 WebP、lazy load 正常；地圖頁不拖垮首頁載入 — lazy 路由 + leaflet 不預載首頁

### 5. 法律與信任

28. [x] 隱私權政策（資料保存 7 天、聊天刪除等與 About 敘述一致）— `about.privacy.lead1–6`
29. [x] 使用條款 — `about.terms.*` 區塊 + 頁尾連結
30. [x] 聯絡方式、檢舉管道在站內可找到 — 頁尾導覽 + `about.trust.*`
31. [x] Analytics（Vercel Web Analytics）— `about.privacy.lead5` + `main.jsx`

### 6. 營運與監控

32. [x] Vercel Production 指向正確 commit；`www.findsomeone.co` 可開 — 線上 200 + apex redirect；見 `docs/OPS-32-36.md`（Dashboard 對 commit）
33. [x] Firebase：Authentication 已授權網域、Email 範本、Firestore indexes — 清單與 `npm run deploy:firestore:indexes` 見 `docs/OPS-32-36.md`
34. [x] Firestore rules — `npm run deploy:firestore:rules`（`firebase-tools`）；部署後 Console 驗證見同上
35. [x] （可選）Sentry — **未啟用**（刻意略過）；日後接入步驟見 `docs/OPS-32-36.md` §35
36. [x] 帳密備份範本 — `docs/CREDENTIALS-BACKUP.md`（填寫存密碼庫，勿 commit）

### 7. 體驗、無障礙與濫用

37. [x] 可點擊元素 `cursor: pointer` — 全域 + Map/Account/Chat 修正；見 `docs/UX-A11Y-37-40.md`
38. [x] aria-label i18n、`:focus-visible`、聊天 `chat.menuAria` / `chat.sendAria` — 見同上
39. [x] 行動版字級下限與 16px 表單（防 iOS 縮放）— 見同上
40. [x] 檢舉（Map/Chat/Admin）+ 管理員停權／解除（`Admin.jsx`）— 手動驗證步驟見同上

### 8. 上線當天 Smoke Test（約 5 分鐘）

41. [ ] 無痕視窗開 https://www.findsomeone.co
42. [ ] 註冊或登入 → 發一篇測試文 → 地圖看得到
43. [ ] 第二帳號回覆 → 貼主收到通知（若已開 email）
44. [ ] 配對後聊天可傳訊息
45. [ ] About 聯絡表單可送出

## 🔗 連結
- Vercel：https://findsomeone.vercel.app/
- GitHub：https://github.com/claire1342t-hash/findsomeone
