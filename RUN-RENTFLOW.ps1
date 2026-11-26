$ErrorActionPreference = 'Stop'
$compose = Join-Path $PSScriptRoot 'compose.demo-v10.yml'
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw 'Cần cài Docker Desktop và mở Docker Engine trước khi chạy.' }
docker info *> $null
if ($LASTEXITCODE -ne 0) { throw 'Docker Engine chưa chạy.' }
docker compose -f $compose config --quiet
if ($LASTEXITCODE -ne 0) { throw 'Cấu hình Docker Compose không hợp lệ.' }
docker compose -f $compose up --build -d
if ($LASTEXITCODE -ne 0) { throw 'Không thể khởi động RentFlow V10.' }
$uri = 'http://127.0.0.1:32512/login'
for ($i = 0; $i -lt 60; $i++) {
  try {
    $response = Invoke-WebRequest -Uri $uri -TimeoutSec 2
    if ($response.StatusCode -eq 200) { Start-Process $uri; Write-Host "RentFlow sẵn sàng: $uri"; exit 0 }
  } catch {}
  Start-Sleep -Seconds 2
}
docker compose -f $compose logs --tail 80
throw 'Hệ thống chưa sẵn sàng sau 120 giây.'
