$ErrorActionPreference = 'Stop'
docker compose -f (Join-Path $PSScriptRoot 'compose.demo-v10.yml') stop
if ($LASTEXITCODE -ne 0) { throw 'Không thể dừng dịch vụ RentFlow.' }
Write-Host 'RentFlow đã dừng. Dữ liệu demo còn trong volume để tiếp tục lần sau.'
