# 原始碼（給維護者）

- `template.html`：網頁主程式（HTML／CSS／JS），`/*DATA*/` 和 `/*BUILD*/` 會在建置時取代。
- `data.json`：從遊戲檔案（日版 Rev 1）整理的招式、精靈、進化表資料。
- `build.py`：建置。執行 `python3 build.py` 會產生：
  - `dw1.html`：網頁版（artifact 用）
  - `dist/web/index.html`：網頁版獨立檔案（放到 repository 根目錄的 `index.html`）
  - `dist/index.html`：實時版（放進實時版套件）
- `live/`：實時版小程式 `dw1_bridge.py`、使用說明和啟動檔。
- `DW1資料統整.md`：資料來源、遊戲程式解析紀錄（記憶體位置、存檔格式、進化判定等）。
- `parts/`：已合併進 template.html 的模組原稿，僅供參考。

更新流程：修改 `src/template.html` → `cd src && python3 build.py` → 把 `src/dist/web/index.html` 複製到根目錄 `index.html` → commit → push。
