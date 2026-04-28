# Findsomeone — 開發進度

## ✅ 已完成
- 環境設定：agency-agents 安裝至 .cursor/rules/（UX Architect、UI Designer、Senior Developer、Senior PM）
- Senior Developer stack 從 Laravel 改為 React
- Homepage：Navbar、Hero 區塊、四個功能介紹卡片、復古插圖風格、思源字體
- Post 頁面：Leaflet 地圖選點、描述表單、動機選擇卡片、驗證問題、發布按鈕
- 部署至 Vercel，修正圖片路徑問題
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

## 🔧 待修正
- 動機卡片液體動畫效果
- Navbar active 狀態（移除框框）
- Hero 按鈕換回自製插圖按鈕

## 📋 待開發
- 驗證問題流程（/verify/:postId）
- 聊天室
- 站內通知中心
- Email 通知（SendGrid）
- About 頁面完成
- 所有頁面翻譯補齊（英文 + 日文）

## 🔗 連結
- Vercel：https://findsomeone.vercel.app/
- GitHub：https://github.com/claire1342t-hash/findsomeone
