# 報修登記系統
用於提交報修需求並查看報修清單。
雲端任務測試
[報修欄位表（Excel）](文件/報修欄位表.xlsx)

## 網頁使用與發佈

根目錄 `index.html` 為首頁，使用純 HTML/CSS/JavaScript，透過 CDN 載入 supabase-js v2，無須建置。開發時以 `python -m http.server 8000` 啟動靜態伺服器，再開啟 `http://localhost:8000`。

`config.js` 僅放 Supabase 專案網址與可公開的 publishable key；不得放 secret 或 service_role 金鑰。資料庫須先由管理者審閱並套用 `supabase/schema.sql`，確認 anon 可讀取及新增五個表單欄位、RLS 限制初始狀態，且禁止公開修改與刪除。

在 GitHub Settings → Pages 選擇 Deploy from a branch、`main`、`/ (root)`，首頁預期為 https://attw1121.github.io/attw/ 。網站提供新增與最近 20 筆清單，不提供登入、修改、刪除或通知；清單公開，請僅填虛構資料。

## 驗證紀錄

已用 Chromium 與模擬 API 回應檢查手機／桌面版面、五欄新增內容、成功後刷新、空清單、錯誤保留輸入、20 筆查詢及純文字呈現。雲端測試環境的網路政策阻擋此 Supabase 網域，尚未完成真實新增、讀取及禁止更新／刪除的整合驗證；發佈前應使用虛構資料完成這些檢查。
