# Firestore 安全規則審查

審查日期：2026-05-19  
規則檔：`firestore.rules`  
客戶端：`findsomeone/src/**`

## 集合現況

| 集合 | 客戶端使用 | 規則狀態（審查前） |
|------|------------|-------------------|
| `users` | 登入同步、Profile 頭像、Admin 讀取 | 有規則，**欄位未鎖** |
| `users/{uid}/ownedPosts` | 發文 batch、刪文 | **與 posts 交叉驗證**，不可偽造 |
| `users/{uid}/repliedPosts` | Map 回覆索引、Profile | 有規則，合理 |
| `posts` | 地圖公開列表、發文、刪文 | 有規則，**update 未鎖欄位** |
| `posts/{id}/responses` | Map 驗證回覆、Profile 審核 | 有規則，**回覆者可自設 accepted** |
| `chats` | Profile 開聊天、ChatList、結束聊天 | 有規則，**participant 可改身份欄位** |
| `chats/{id}/messages` | 聊天、系統結束訊息 | 有規則，**senderRole 未驗證** |
| `notifications` | 可選 in-app（目前仍以 email 為主） | **僅 create + 本人 read** |
| `reports` | Map/Chat 檢舉、Admin | 有規則，合理 |

---

## 嚴重（已於 `firestore.rules` 修復）

### 1. 使用者可自行提升 `isAdmin`

**規則（舊）：** `users/{userId}` 允許本人 `update` 任意欄位。  
**風險：** 任意登入者可寫入 `isAdmin: true`，觸發 `match /{document=**}` 管理員全庫讀寫。  
**修復：** `isAdmin` / `isBanned` 建立時必須為 false；更新時不可變更。

### 2. 回覆者可自行 `update` 為 `accepted` 並填入 `chatId`（已強化）

**風險：** 略過發文者審核，或任意改 `status` / `attemptCount` / `chatId`。  
**修復（responder）：**

- **create**：僅 `status=pending`、`attemptCount=1`，不可含 `chatId` / `reviewedAt`
- **update**：僅可改 `answers`、`responderAnonymousName`、`createdAt` 等；`chatId` / `reviewedAt` 必須與原值相同
- **status** 寫入後必須仍為 `pending`；不可在 `accepted` 後再改
- **attemptCount** 僅允許：`pending` 時不變，或 `rejected` 且原為 `1` 時改為 `2`（第二次作答）
- **發文者** 僅能在 `pending` 時改為 `accepted`/`rejected`（並在 accept 時必填 `chatId`）

### 3. 聊天參與者可改 `posterUid` / `participants`

**規則（舊）：** 任一 `participants` 成員可 `update` 整份文件。  
**風險：** 將自己加入他人聊天或竄改身份。  
**修復：** 參與者僅能更新 `lastMessage*`、`updatedAt`；身份欄位由發文者（擁有該 post）在建立/核准時寫入。

---

## 高（已修復或緩解）

### 4. `ownedPosts` 可偽造 ownership（已強化）

**風險（舊）：** 僅檢查 `users/{uid}/ownedPosts` 內的 `authorUid`，可在他人 `posts/{postId}` 上自建索引，騙過 `ownsPostById()`。  
**修復：**

- `ownsPostById()` 必須同時符合 `posts.authorUid`、`posts.claimToken` 與 `ownedPosts` 一致。
- `ownedPosts` **不可 update**；**create** 僅允許 post 尚不存在（發文 batch）或與既有 post 交叉驗證通過。
- **delete** 需 `claimToken` 與 post 一致（或 post 已刪）。

### 4b. `ownedPosts` 任意登入者可讀（已修復）

**修復：** 僅本人可讀 `users/{uid}/ownedPosts/{postId}`。

### 5. `posts` update 未鎖定不可變欄位

**風險：** 擁有者可改 `authorUid`、`claimToken`、`createdAt` 等。  
**修復：** update 時 `authorUid`、`claimToken`、`authorPublicId`、`createdAt` 必須與原值相同。

### 6. `messages` 未驗證 `senderRole`

**風險：** 參與者可送 `senderRole: "poster"` 冒充對方。  
**修復：** `senderRole` 必須與 `request.auth.uid` 在 chat 上的角色一致；`system` 僅限參與者；僅參與者可刪訊息（發文者若非聊天成員不可刪他人訊息）。

### 7. `chats` create 未驗證發文者擁有該 post

**修復：** create 需 `ownsPostById(postId)` 且 `responderUid != request.auth.uid`。

---

## 中／設計取捨（保留並記錄）

### 8. `posts` 公開讀取 `allow read: if true`

**用途：** 地圖未登入也可看貼文（`Map.jsx` `onSnapshot` 全集合）。  
**外洩：** `authorUid`、精確座標、描述等。若需匿名化地圖，應改為 Cloud Function 回傳 redacted 欄位或改為登入後才讀。

### 9. 管理員萬用規則 `match /{document=**}`

**用途：** Admin 後台讀寫所有集合。  
**要求：** `isAdmin` 僅能由 Firebase Console / Admin SDK 設定，不可由客戶端寫入（見 #1）。

### 10. Post 擁有者可讀取非參與之 chat（`ownsPostById`）

**用途：** `hasActiveChatsForPost`、Profile 管理等。  
**風險：** 擁有者可讀聊天內容（若知道 `chatId`）。屬產品設計；若只要 metadata，應改查詢 API。

---

## notifications

客戶端規則（`firestore.rules`）：

| 操作 | 誰 | 條件 |
|------|-----|------|
| **create** | 登入者 | `actorUid == 自己`，`recipientUid` 為他人，必填 `type`/`createdAt`，`read == false` |
| **read / list** | 收件者 | `recipientUid == 自己` |
| **update / delete** | 任何人 | **拒絕**（含無法改別人、也無法在客戶端改自己的已讀狀態） |

管理員仍可依 `isAdmin` 萬用規則讀寫。  
若需「標記已讀」，請用 Cloud Functions（Admin SDK）或之後再加僅允許改 `read` 的規則。

建議文件欄位：`recipientUid`, `actorUid`, `type`, `createdAt`, `read`（可選 `postId`, `chatId`, `title`, `body`）。

郵件通知仍走 `sendEmail` / `sendProfileNotificationEmail`，與此集合獨立。

---

## 部署

```bash
firebase deploy --only firestore:rules
```

或在 Firebase Console → Firestore → Rules 貼上並發布。

## 建議後續（未實作）

1. **欄位型別驗證**：`location.lat/lng` 範圍、`status` enum、`text` 長度上限（rules 表達式較冗長，可部分移至 CF）。
2. **Rate limiting**：回覆、訊息、檢舉建立頻率 — 需 Cloud Functions 或 App Check + 後端。
3. **App Check**：降低 API key 濫用。
4. **PROGRESS.md #11**：審查完成後可勾選。
