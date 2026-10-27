# WHO RAG 後端（本機測試）

需要 Python 3.10 以上。於 PowerShell 執行以下指令，啟動腳本會建立 `.venv`、安裝缺少的套件並啟動伺服器：

```powershell
.\fitai-web\backend\start.ps1
```

或先切換到 `fitai-web\backend` 後執行：

```powershell
.\start.ps1
```

第一次使用時，複製 `.env.example` 為 `.env`，並設定有效的 `OPENAI_API_KEY`。`.env` 僅供本機使用，勿提交或貼到網頁。

啟動後可在瀏覽器開啟 `http://127.0.0.1:8000/health`。正常時應回傳 `status: ok`、12 筆知識紀錄，以及 `api_key_configured: true`。網頁需透過本機網站伺服器開啟，並與 API 使用同一台電腦；此 RAG 測試後端不供正式環境或手機直接連線。

停止伺服器請在啟動它的終端機按 `Ctrl+C`。
