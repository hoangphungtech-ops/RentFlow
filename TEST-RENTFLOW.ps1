$ErrorActionPreference = 'Stop'
$env:RENTFLOW_API_BASE = 'http://127.0.0.1:32512/api'
if (-not $env:DEMO_PASSWORD) { $env:DEMO_PASSWORD = 'Demo@2026!' }
node (Join-Path $PSScriptRoot 'scripts/test-v10-accounts.cjs')
if ($LASTEXITCODE -ne 0) { throw 'Kiểm tra tài khoản hoặc phân quyền thất bại.' }
