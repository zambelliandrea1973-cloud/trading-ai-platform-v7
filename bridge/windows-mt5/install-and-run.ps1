$ErrorActionPreference = "Stop"

Set-Location $PSScriptRoot

$python = $null
$pythonCommand = Get-Command python -ErrorAction SilentlyContinue
if ($pythonCommand) {
  $python = $pythonCommand.Source
}

if (-not $python) {
  $localPython = Join-Path $env:LOCALAPPDATA "Programs\Python\Python312\python.exe"
  if (Test-Path $localPython) {
    $python = $localPython
  }
}

if (-not $python) {
  throw "Python 3.12 x64 not found. Expected either 'python' in PATH or $env:LOCALAPPDATA\Programs\Python\Python312\python.exe"
}

Write-Host "Using Python: $python" -ForegroundColor Cyan

if (-not (Test-Path ".venv")) {
  & $python -m venv .venv
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
  Write-Host "Edit .env and replace the placeholder API key before starting the bridge." -ForegroundColor Yellow
  exit 1
}

& .\.venv\Scripts\python.exe -m uvicorn app:app --host 127.0.0.1 --port 8765
