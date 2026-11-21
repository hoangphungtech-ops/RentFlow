param([switch]$Seed, [switch]$SkipInstall)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $root
function Assert-Success($operation) {
    if ($LASTEXITCODE -ne 0) { throw "$operation failed ($LASTEXITCODE)" }
}
foreach ($file in @('.env','backend/.env')) {
    if (!(Test-Path -LiteralPath $file)) { throw "Configure $file from its .env.example before starting." }
}
foreach ($file in @('.rentflow-api.pid','.rentflow-web.pid')) {
    if (Test-Path -LiteralPath $file) { throw "Run scripts/stop-demo.ps1 before starting RentFlow again." }
}
docker info --format '{{.ServerVersion}}'
Assert-Success 'Docker Desktop engine check'
docker compose -p rentflow-demo up -d --wait mysql
Assert-Success 'MySQL startup'
if (!$SkipInstall) {
    npm.cmd --prefix backend ci --prefer-offline --no-fund --no-audit
    Assert-Success 'Backend dependency installation'
    npm.cmd --prefix web ci --prefer-offline --no-fund --no-audit
    Assert-Success 'Web dependency installation'
}
Push-Location backend
try {
    & .\node_modules\.bin\prisma.cmd generate
    Assert-Success 'Prisma client generation'
    & .\node_modules\.bin\prisma.cmd migrate deploy
    Assert-Success 'MySQL migrations'
    npm.cmd run build
    Assert-Success 'NestJS build'
    if ($Seed) {
        npm.cmd run seed
        Assert-Success 'Demo seed'
    }
} finally { Pop-Location }
npm.cmd --prefix web run build
Assert-Success 'Next.js build'
$node = (Get-Command node.exe).Source
$api = Start-Process -FilePath $node -ArgumentList '--env-file=.env','dist/src/main.js' -WorkingDirectory (Join-Path $root 'backend') -WindowStyle Hidden -PassThru
$api.Id | Set-Content .rentflow-api.pid
$web = Start-Process -FilePath $node -ArgumentList 'node_modules/next/dist/bin/next','start','--hostname','127.0.0.1' -WorkingDirectory (Join-Path $root 'web') -WindowStyle Hidden -PassThru
$web.Id | Set-Content .rentflow-web.pid
& "$PSScriptRoot/health-check.ps1" -Attempts 15
Write-Host 'Web http://127.0.0.1:3000 | Admin http://127.0.0.1:3000/quan-ly | Swagger http://127.0.0.1:3001/swagger'
