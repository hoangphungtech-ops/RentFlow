$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $root

foreach ($file in @('.env','backend/.env','backend/.env.admin-demo')) {
    if (!(Test-Path -LiteralPath $file)) { throw "Missing local demo configuration: $file" }
}
$db = Get-Content backend/.env -Raw
$compose = Get-Content .env -Raw
if ($db -notmatch 'DATABASE_URL="mysql://rentflow:[^@]+@127\.0\.0\.1:33317/rentflow"' -or $compose -notmatch 'MYSQL_PORT=33317') {
    throw 'Refusing to start: this workspace is not configured for the isolated V9.2 database on 127.0.0.1:33317.'
}
foreach ($entry in @(@{file='.rentflow-api.pid';marker='dist/src/main.js'},@{file='.rentflow-web.pid';marker='run-standalone.cjs'})) {
    if (Test-Path -LiteralPath $entry.file) {
        $oldPid = 0; [void][int]::TryParse((Get-Content -LiteralPath $entry.file -Raw), [ref]$oldPid)
        $old = if ($oldPid -gt 0) { Get-CimInstance Win32_Process -Filter "ProcessId=$oldPid" -ErrorAction SilentlyContinue }
        if ($old -and $old.Name -eq 'node.exe' -and $old.CommandLine.Contains($entry.marker)) { throw "RentFlow is already running (PID $oldPid)." }
        Remove-Item -LiteralPath $entry.file
    }
}
foreach ($path in @('backend/dist/src/main.js','web/.next/standalone/server.js')) {
    if (!(Test-Path -LiteralPath $path)) { throw "Missing built application: $path. Run the verified start-demo.ps1 once first." }
}

docker compose -p rentflow-v9-demo up -d --wait mysql
if ($LASTEXITCODE -ne 0) { throw 'V9.2 isolated MySQL startup failed.' }
$logDir = Join-Path $root 'artifacts/real-demo-v9-2/logs'
New-Item -ItemType Directory -Path $logDir -Force | Out-Null
$node = (Get-Command node.exe).Source
$api = Start-Process -FilePath $node -ArgumentList '--env-file=.env','dist/src/main.js' -WorkingDirectory (Join-Path $root 'backend') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logDir 'backend.log') -RedirectStandardError (Join-Path $logDir 'backend-error.log') -PassThru
$api.Id | Set-Content (Join-Path $root '.rentflow-api.pid')
$web = Start-Process -FilePath $node -ArgumentList 'run-standalone.cjs' -WorkingDirectory (Join-Path $root 'web') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logDir 'web.log') -RedirectStandardError (Join-Path $logDir 'web-error.log') -PassThru
$web.Id | Set-Content (Join-Path $root '.rentflow-web.pid')

try {
    & (Join-Path $PSScriptRoot 'health-check.ps1') -Attempts 60
} catch {
    foreach ($pidFile in @('.rentflow-api.pid','.rentflow-web.pid')) {
        if (Test-Path -LiteralPath $pidFile) {
            $processId = [int](Get-Content -LiteralPath $pidFile)
            $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$processId" -ErrorAction SilentlyContinue
            if ($proc -and $proc.Name -eq 'node.exe') { Stop-Process -Id $processId -ErrorAction SilentlyContinue }
            Remove-Item -LiteralPath $pidFile
        }
    }
    throw "Demo health check failed. Review logs in $logDir"
}
Write-Host 'Demo ready: Web http://127.0.0.1:3000 | Admin http://127.0.0.1:3000/quan-ly | Swagger http://127.0.0.1:3001/swagger'
