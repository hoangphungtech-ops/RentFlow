$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
foreach ($entry in @(@{ file='.rentflow-api.pid'; marker='dist/src/main.js' }, @{ file='.rentflow-web.pid'; marker='node_modules/next/dist/bin/next' })) {
    if (!(Test-Path -LiteralPath $entry.file)) { continue }
    $processId = [int](Get-Content -LiteralPath $entry.file)
    $process = Get-CimInstance Win32_Process -Filter "ProcessId=$processId"
    if ($process -and $process.Name -eq 'node.exe' -and $process.CommandLine.Contains($entry.marker)) {
        Stop-Process -Id $processId
    }
    Remove-Item -LiteralPath $entry.file
}
docker compose -p rentflow-demo stop mysql
if ($LASTEXITCODE -ne 0) { throw 'Docker could not stop MySQL.' }
