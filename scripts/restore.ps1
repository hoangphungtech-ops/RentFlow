param([Parameter(Mandatory=$true)][string]$BackupFolder)
Get-Content "$BackupFolder\db.sql" -Raw | docker exec -i rentflow-mysql mysql -u root -pRentflowRoot2026 rentflow
if (Test-Path "$BackupFolder\uploads") {
  Remove-Item -Path "E:\dev\rentflow\backend\uploads" -Recurse -Force -ErrorAction SilentlyContinue
  Copy-Item -Path "$BackupFolder\uploads" -Destination "E:\dev\rentflow\backend\uploads" -Recurse -Force
}
Write-Host "Restore thanh cong tu: $BackupFolder" -ForegroundColor Green
