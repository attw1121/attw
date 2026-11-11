# 型鋼腹板集中載重檢核

開啟 dist/index.html 即可使用，或使用 outputs/型鋼腹板檢核.html 單檔離線版。無外部套件、CDN 或伺服器計算依賴。

規範：台灣96年鋼結構極限設計法11.2.3–11.2.6；ANSI/AISC360-22 J10.2–J10.5（LRFD/ASD）。

功能：四項腹板檢核、斷面與載重SVG、公式與代入過程、真正xlsx匯出、列印樣式、JSON匯入匯出、瀏覽器自動儲存。

範圍：無加勁板雙對稱熱軋H/I型鋼、垂直翼板且對稱腹板之壓力；雙側僅等值相向載重。未包含整體構材與加勁板設計，需專業覆核。

Excel為計算快照，容量和需求比含公式；修改輸入應回網頁重算。單位：mm、kgf、kgf/cm²、kgf·cm。

驗證：端距 d 與 d/2 邊界、N/d分支、ASD係數、單/雙側及拘束適用性、kgf與SI獨立換算、輸入阻擋、手機版無水平溢出、實際xlsx下載。

## PWA 安裝與離線

開啟 HTTPS 網頁，待頁尾顯示「離線已就緒」。Chrome／Edge 可使用安裝按鈕或瀏覽器安裝選單；iPhone／iPad 使用 Safari 分享 → 加入主畫面。首次快取完成後可離線開啟已安裝的應用程式、計算及匯出 Excel／JSON。外部規範連結需要網路，輸入資料只存於本機瀏覽器。

GitHub Pages 安裝入口：https://attw1121.github.io/attw/steel-web-check/dist/ 。`manifest.webmanifest` 與 service worker 均使用相對路徑，作用範圍限於工具目錄。更新快取檔案時須遞增 `dist/sw.js` 的快取版本；使用者看到更新按鈕後可重新載入最新版。
