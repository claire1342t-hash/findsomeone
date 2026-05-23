# 法律與信任（檢查清單 28–31）

## 28. 隱私權政策

位置：**關於** →「關於隱私與資料」（`/about#about-privacy-title`）

內容涵蓋：email 用途、7 日貼文、聊天結束／7 日刪除、不備份、檢舉資料、**Vercel Web Analytics**（lead5）。

與產品一致：`postLifecycle.js`（7 日）、`deleteChatCascade`、`deletePostCascade`（保留進行中聊天）。

## 29. 使用條款

位置：**關於** →「使用條款」（`/about#about-terms-title`）

## 30. 聯絡與檢舉

- **聯絡**：頁尾「聯絡」→ About 表單（`/about#about-contact-title`，須登入）
- **檢舉**：地圖貼文詳情、聊天室選單；頁尾「檢舉說明」→ `/about#about-feature-report`
- **關於** 內「聯絡與檢舉」區塊摘要

## 31. Analytics

- 實作：`src/main.jsx` 的 `<Analytics />`（`@vercel/analytics`）
- 揭露：`about.privacy.lead5`（三語）
