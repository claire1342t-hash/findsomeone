# Build 與效能（檢查清單 24、27）

## 24. `npm run build`

```bash
cd findsomeone && npm run build
```

預期：**exit 0**。Firebase 主 chunk 約 500KB（gzip ~148KB）屬常態，Vite 可能提示 chunk >500KB，可接受。

### 主要 JS chunk（gzip，約略）

| Chunk | 用途 | 首頁是否載入 |
|-------|------|----------------|
| `react-vendor` ~60KB | React | 是 |
| `index` ~76KB | 路由、首頁、i18n | 是 |
| `firebase` ~148KB | Auth / Firestore（登入後或 idle 後） | 延後／條件載入 |
| `leaflet` ~62KB | 地圖（Leaflet + cluster + CSS） | **否**（僅 `/map`、`/post` lazy） |
| `Map` ~6KB | 地圖頁邏輯 | 否 |
| `Post` ~8KB | 發文頁邏輯 | 否 |

`vite.config.js` 已將 **leaflet** 獨立拆包，且 `modulePreload` 排除 leaflet／firebase，避免首頁預載地圖。

## 27. 圖片 WebP 與 lazy load

- 插圖：`src/assets/illustrations/**/*.webp`（含 `-480w` 響應式）
- 首頁功能卡、`FeatureCardImages`、`App` CTA：`loading="lazy"`
- 地圖 ping：`Map.jsx` 內 import，僅進入地圖路由時載入
- 路由：`routes.jsx` 對 `/map`、`/post` 等使用 `React.lazy`

## 驗證建議

1. `npm run build` 無錯誤  
2. 無痕開首頁 → Network 不應出現 `leaflet-*.js`（未點地圖／發文前）  
3. 進入 `/map` 後才載入 `leaflet` + `Map` chunk  
