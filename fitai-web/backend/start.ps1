$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

$python = Join-Path $PSScriptRoot '.venv\Scripts\python.exe'
if (-not (Test-Path $python)) {
  & python -m venv .venv
  if ($LASTEXITCODE -ne 0) {
    throw 'Could not create the Python virtual environment. Check that Python is installed.'
  }
}

$sitePackages = Join-Path $PSScriptRoot '.venv\Lib\site-packages'
$requiredModules = @('fastapi', 'uvicorn', 'dotenv', 'openai')
$missingModules = @($requiredModules | Where-Object { -not (Test-Path (Join-Path $sitePackages $_)) })
if ($missingModules.Count -gt 0) {
  & $python -m pip install -r requirements.txt
  if ($LASTEXITCODE -ne 0) {
    throw 'Could not install backend requirements. Check your network connection and retry.'
  }
}

if (-not (Test-Path '.env')) {
  Write-Warning 'backend\.env is missing. The server will start, but AI answers require OPENAI_API_KEY. See .env.example.'
}

& $python -m uvicorn rag_demo_server:app --host 127.0.0.1 --port 8000 --reload
if ($LASTEXITCODE -ne 0) {
  throw 'The RAG server failed to start. See the error above.'
}
