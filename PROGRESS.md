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


## 🔧 待修正
通知系統（發文者收到「有人回覆」的通知）站內通知中心或 Email 通知
About 頁面完成（品牌故事、功能介紹、作者介紹、聯絡信封）
安全性（重要，上線前必須修）
Firestore rules — 通知權限過寬，其他用戶可以 update 別人的通知，改成只允許 create
ownedPosts — 客戶端可偽造 ownership，改用 posts.authorUid 做驗證據
responder 可竄改 response 的 status/attemptCount，加欄位限制功能 bug
4. Map 驗證狀態只做一次 getDoc，改成 onSnapshot 即時同步
5. 註冊時 displayName 時序競態，可能寫入錯誤名字
6. 動機標籤顯示異常值時沒有 fallback資料驗證
7. 發文內容可全空字串送出，加最小長度驗證
8. 訂閱地點無去重、無上限，加限制細節
9. 可點擊元素 cursor: auto 改成 cursor: pointer
10. SiteHeader 的 aria-label 硬編碼，補進 i18n
噁男問題

## 🔗 連結
- Vercel：https://findsomeone.vercel.app/
- GitHub：https://github.com/claire1342t-hash/findsomeone
