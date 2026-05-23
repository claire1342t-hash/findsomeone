# SEO（檢查清單 25、26）

## 25. Title / description / canonical

| 路徑 | 設定方式 |
|------|----------|
| `/` | `App.jsx` → `useDocumentMeta` + `meta.home.*` |
| `/about` | `About.jsx` → `meta.about.*` |
| `/map` | `Map.jsx` → `meta.map.*` |
| `/post` | `Post.jsx` → `meta.post.*` |

- Canonical 基底：`https://www.findsomeone.co`（`useDocumentMeta.js`）
- 切換語言時 title／description 會隨 `t()` 更新
- `index.html` 內建首頁預設 meta（爬蟲未執行 JS 時仍可讀）

## 26. robots.txt / sitemap.xml

靜態檔：`public/robots.txt`、`public/sitemap.xml`（build 後在網站根目錄）

- https://www.findsomeone.co/robots.txt  
- https://www.findsomeone.co/sitemap.xml  

`robots.txt` 允許 `/`、`/about`、`/map`、`/post`；`Disallow` 私人區（`/admin`、`/login`、`/profile`、`/chat`）。

Sitemap 含：`/`、`/about`、`/map`、`/post`。
