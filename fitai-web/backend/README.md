# WHO RAG 後端

需要 Python 3.10 以上。於 PowerShell 執行以下指令，啟動腳本會建立 `.venv`、安裝缺少的套件並啟動伺服器：

```powershell
.\fitai-web\backend\start.ps1
```

或先切換到 `fitai-web\backend` 後執行：

```powershell
.\start.ps1
```

第一次使用時，複製 `.env.example` 為 `.env`，並設定有效的 `OPENAI_API_KEY`。`.env` 僅供本機使用，勿提交或貼到網頁。

啟動後可在瀏覽器開啟 `http://127.0.0.1:8000/health`。正常時應回傳 `status: ok`、12 筆知識紀錄，以及 `api_key_configured: true`。本機 PWA 預設連線此服務。

## 正式環境

不同使用者的裝置不能連到開發者電腦上的 `127.0.0.1`。部署 FastAPI 到可公開連線的 HTTPS 主機後，將 `fitai-web/index.html` 的 `API_BASE_URL` 改為該服務網址，並在後端部署環境設定 `OPENAI_API_KEY`。金鑰只放在後端環境變數，不要放進前端或提交至 Git。

Netlify 網域（`*.netlify.app`）及 localhost 已列入 CORS 規則。若 PWA 使用自訂網域，請在後端環境設定 `CORS_ALLOW_ORIGINS`，值為完整來源（含 `https://`，不要加路徑），多個來源以逗號分隔。CORS 不是 API 存取控制；正式公開服務仍需設定使用量限制及監控。

停止伺服器請在啟動它的終端機按 `Ctrl+C`。
