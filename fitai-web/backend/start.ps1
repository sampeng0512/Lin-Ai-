$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

$python = Join-Path $PSScriptRoot '.venv\Scripts\python.exe'
if (-not (Test-Path $python)) {
  $pyLauncher = Get-Command py -ErrorAction SilentlyContinue
  if ($pyLauncher) {
    & $pyLauncher.Source -3 -m venv .venv
  } else {
    & python -m venv .venv
  }
  if ($LASTEXITCODE -ne 0) {
    throw 'Could not create the Python virtual environment. Check that Python is installed.'
  }
  if (-not (Test-Path $python)) {
    throw 'Python did not create a Windows virtual environment. Install Python for Windows and retry.'
  }
}

& $python -c "import importlib.util; raise SystemExit(0 if all(importlib.util.find_spec(m) for m in ('fastapi', 'uvicorn', 'dotenv', 'openai', 'pydantic')) else 1)"
if ($LASTEXITCODE -ne 0) {
  & $python -m pip install -r requirements.txt
  if ($LASTEXITCODE -ne 0) {
    throw 'Could not install backend requirements. Check your network connection and retry.'
  }
}

if (-not (Test-Path '.env')) {
  throw 'backend\.env is missing. Copy .env.example to .env and configure OPENAI_API_KEY and TEAM_ACCESS_TOKEN.'
}

& $python -c "from dotenv import load_dotenv; import os; load_dotenv('.env'); missing = [k for k in ('OPENAI_API_KEY', 'TEAM_ACCESS_TOKEN') if not os.getenv(k, '').strip() or os.getenv(k) in ('your_openai_api_key_here', 'replace_with_your_team_password')]; print('Missing configuration: ' + ', '.join(missing) if missing else 'Backend configuration OK.'); raise SystemExit(1 if missing else 0)"
if ($LASTEXITCODE -ne 0) {
  throw 'Update backend\.env using the configuration names above, then run this script again.'
}

Write-Host 'Health check: http://127.0.0.1:8000/health'
Write-Host 'Keep this terminal open. Use TEAM_ACCESS_TOKEN from backend\.env in the browser password prompt.'
& $python -m uvicorn rag_demo_server:app --host 127.0.0.1 --port 8000 --reload
if ($LASTEXITCODE -ne 0) {
  throw 'The RAG server failed to start. See the error above.'
}
