param([int]$Attempts = 1)
$ErrorActionPreference = 'Stop'
$urls = @('http://127.0.0.1:3001/api/health','http://127.0.0.1:3001/swagger','http://127.0.0.1:3000/','http://127.0.0.1:3000/api/health')
foreach ($url in $urls) {
    for ($i = 1; $i -le $Attempts; $i++) {
        try {
            $result = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 4
            if ($result.StatusCode -ne 200) { throw "HTTP $($result.StatusCode)" }
            Write-Host "OK $url"
            break
        } catch {
            if ($i -eq $Attempts) { throw "Health check failed for $url" }
            Start-Sleep -Seconds 2
        }
    }
}
