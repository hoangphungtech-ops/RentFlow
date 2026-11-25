$ErrorActionPreference = 'Stop'
Push-Location -LiteralPath $PSScriptRoot
try {
    docker info --format '{{.ServerVersion}}'
    if ($LASTEXITCODE -ne 0) { throw 'Start Docker Desktop with Linux containers and run this command again.' }

    docker compose -f compose.demo-25-11.yml up --build --wait --wait-timeout 240
    if ($LASTEXITCODE -ne 0) { throw 'RentFlow did not start. Check Docker Desktop and the Compose output above.' }

    $demoUrl = 'http://127.0.0.1:32511/demo/index.html'
    Write-Host "RentFlow demo: $demoUrl"
    Start-Process $demoUrl
} finally {
    Pop-Location
}
