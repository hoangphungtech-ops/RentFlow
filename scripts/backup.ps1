$ts = Get-Date -Format "yyyyMMdd_HHmmss"
$dest = "E:\dev\rentflow\backups\rentflow_$ts"
New-Item -ItemType Directory -Force -Path $dest | Out-Null
docker exec rentflow-mysql mysqldump -u root -pRentflowRoot2026 rentflow | Set-Content -Path "$dest\db.sql" -Encoding UTF8
if (Test-Path "E:\dev\rentflow\backend\uploads") {
  Copy-Item -Path "E:\dev\rentflow\backend\uploads" -Destination "$dest\uploads" -Recurse -Force
}
Write-Host "Backup thanh cong tai: $dest" -ForegroundColor Green
