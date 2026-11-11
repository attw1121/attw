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

## 清單緊急程度篩選

清單上方提供「全部／高／中／低」按鈕，預設為「全部」，選取的按鈕以深綠底白字顯示並設定 `aria-pressed`。切換僅篩選網頁已載入的最近 20 筆，不會額外查詢資料庫；重新整理或送出後刷新清單仍保留目前篩選。沒有符合項目時顯示提示，高緊急程度標籤改為紅字淺紅底。

手機確認方式：在含此變更的版本滑到「最近報修」，依序點選四個按鈕，確認選取樣式、對應清單、無符合項目提示，以及「高」的紅色標籤。此變更僅修改網頁與說明，未變更資料庫、欄位或 `supabase/`。

[報修系統操作說明（Word）](文件/報修系統操作說明.docx)

## 型鋼腹板檢核｜WEB / CHECK

獨立工具位於 `steel-web-check/`，發布網址：https://attw1121.github.io/attw/steel-web-check/ 。使用既有 GitHub Pages 的 `main` 分支根目錄發布，無須建置。

本機可在儲存庫根目錄執行 `python -m http.server 8000`，再開啟 `http://localhost:8000/steel-web-check/`。功能、計算範圍與規範見 [工具說明](steel-web-check/README.md)。

[報修登記系統提案（PowerPoint）](文件/報修登記系統提案.pptx)
