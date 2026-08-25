$ErrorActionPreference = "Stop"

Set-Location $PSScriptRoot

if (-not (Get-Command py -ErrorAction SilentlyContinue)) {
  throw "Python launcher 'py' not found. Install Python 3.11/3.12 x64 first."
}

if (-not (Test-Path ".venv")) {
  py -3 -m venv .venv
}

& .\.venv\Scripts\python.exe -m pip install --upgrade pip
& .\.venv\Scripts\python.exe -m pip install -r requirements.txt

if (-not (Test-Path ".env")) {
  Copy-Item ".env.example" ".env"
  Write-Host "Created .env. Set MT5_BRIDGE_API_KEY before starting the bridge." -ForegroundColor Yellow
  exit 1
}

$envFile = Get-Content ".env" -Raw
if ($envFile -match "replace-with-long-random-secret") {
  Write-Host "Edit bridge/windows-mt5/.env and replace the placeholder API key." -ForegroundColor Yellow
  exit 1
}

& .\.venv\Scripts\python.exe -m uvicorn app:app --host 127.0.0.1 --port 8765
