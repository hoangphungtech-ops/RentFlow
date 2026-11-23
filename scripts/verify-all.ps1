$ErrorActionPreference = "Stop"
$base = "http://localhost:3000/api"
$propA = "11111111-1111-4111-8111-111111111111"
$propB = "22222222-2222-4222-8222-222222222222"
$leaseA = "33333333-3333-4333-8333-333333333333"
$tenantA = "55555555-5555-4555-8555-555555555555"
$passCount = 0
$failCount = 0

function Pass([string]$msg) {
  $script:passCount++
  Write-Host "[PASS] $msg" -ForegroundColor Green
}

function Fail([string]$msg) {
  $script:failCount++
  Write-Host "[FAIL] $msg" -ForegroundColor Red
}

function Expect-Http([scriptblock]$fn, [int]$expected, [string]$label) {
  try {
    & $fn | Out-Null
    Fail "$label (mong đợi HTTP $expected nhưng thành công)"
  } catch {
    $code = 0
    if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
    if ($code -eq $expected) { Pass "$label (HTTP $code)" }
    else { Fail "$label (mong đợi HTTP $expected nhưng nhận $code)" }
  }
}

Write-Host "=== KIỂM TRA H01: HẠ TẦNG & SEED ===" -ForegroundColor Cyan
if ((Test-Path "backend\.env") -and (Test-Path "backend\.env.example") -and (Test-Path ".gitignore")) {
  Pass "Đủ file cấu hình .env, .env.example, .gitignore"
} else { Fail "Thiếu file cấu hình gốc" }

$emails = @("owner.a@rentflow.local","owner.b@rentflow.local","staff.a@rentflow.local","accountant.a@rentflow.local","renter.a@rentflow.local","renter.b@rentflow.local")
$tokens = @{}
foreach ($e in $emails) {
  $res = Invoke-RestMethod -Method Post "$base/auth/login" -ContentType "application/json" -Body "{`"email`":`"$e`",`"password`":`"Rentflow@2026`"}"
  $tokens[$e] = $res.accessToken
}
Pass "Đăng nhập đủ 6 tài khoản seed (OWNER, STAFF, ACCOUNTANT, TENANT)"

$hOwnerA = @{ Authorization = "Bearer $($tokens['owner.a@rentflow.local'])" }
$hOwnerB = @{ Authorization = "Bearer $($tokens['owner.b@rentflow.local'])" }
$hStaffA = @{ Authorization = "Bearer $($tokens['staff.a@rentflow.local'])" }
$hAccA   = @{ Authorization = "Bearer $($tokens['accountant.a@rentflow.local'])" }
$hRentA  = @{ Authorization = "Bearer $($tokens['renter.a@rentflow.local'])" }

Write-Host "`n=== KIỂM TRA H02: PHÂN QUYỀN & THU HỒI PHIÊN ===" -ForegroundColor Cyan
Expect-Http { Invoke-RestMethod -Method Get "$base/users?propertyId=$propB" -Headers $hOwnerA } 403 "Chặn OWNER_A truy cập Khu B"
Expect-Http { Invoke-RestMethod -Method Post "$base/payments" -Headers $hStaffA -ContentType "application/json" -Body "{}" } 403 "Chặn STAFF_A gọi API thu tiền"

Invoke-RestMethod -Method Post "$base/auth/logout" -Headers $hStaffA | Out-Null
Expect-Http { Invoke-RestMethod -Method Get "$base/auth/me" -Headers $hStaffA } 401 "Thu hồi phiên tức thì sau logout (tokenVersion)"

Write-Host "`n=== KIỂM TRA H03: LỜI MỜI 1 LẦN, TỆP RIÊNG TƯ 5MB & AUDITLOG ===" -ForegroundColor Cyan
Expect-Http { Invoke-RestMethod -Method Post "$base/invitations" -Headers $hOwnerA -ContentType "application/json" -Body "{`"propertyId`":`"$propB`",`"tenantId`":`"$tenantA`",`"leaseId`":`"$leaseA`"}" } 403 "Chặn tạo lời mời cho khu trọ không quản lý"

$inv = Invoke-RestMethod -Method Post "$base/invitations" -Headers $hOwnerA -ContentType "application/json" -Body "{`"propertyId`":`"$propA`",`"tenantId`":`"$tenantA`",`"leaseId`":`"$leaseA`"}"
$newTenantEmail = "tenant.$(Get-Random)@rentflow.local"
$accBody = "{`"token`":`"$($inv.inviteToken)`",`"email`":`"$newTenantEmail`",`"password`":`"Rentflow@2026`",`"fullName`":`"Tenant Check`"}"
Invoke-RestMethod -Method Post "$base/invitations/accept" -ContentType "application/json" -Body $accBody | Out-Null
Pass "Kích hoạt lời mời hợp lệ lần 1"
Expect-Http { Invoke-RestMethod -Method Post "$base/invitations/accept" -ContentType "application/json" -Body $accBody } 400 "Chặn dùng lại lời mời lần 2"

$bFake = "----RentFlowFake$(Get-Random)"
$fakeMultipart = "--$bFake`r`nContent-Disposition: form-data; name=`"entityType`"`r`n`r`nPAYMENT_PROOF`r`n--$bFake`r`nContent-Disposition: form-data; name=`"entityId`"`r`n`r`n$leaseA`r`n--$bFake`r`nContent-Disposition: form-data; name=`"propertyId`"`r`n`r`n$propA`r`n--$bFake`r`nContent-Disposition: form-data; name=`"file`"; filename=`"fake.png`"`r`nContent-Type: image/png`r`n`r`nNOT_A_REAL_PNG`r`n--$bFake--`r`n"
Expect-Http { Invoke-RestMethod -Method Post "$base/files/upload" -Headers $hOwnerA -ContentType "multipart/form-data; boundary=$bFake" -Body $fakeMultipart } 400 "Chặn tệp giả mạo đuôi .png (magic bytes)"

$bOk = "----RentFlowOk$(Get-Random)"
$enc = [System.Text.Encoding]::GetEncoding("iso-8859-1")
$pngHeader = $enc.GetString([byte[]](0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A,0x00,0x00,0x00,0x0D))
$okMultipart = "--$bOk`r`nContent-Disposition: form-data; name=`"entityType`"`r`n`r`nPAYMENT_PROOF`r`n--$bOk`r`nContent-Disposition: form-data; name=`"entityId`"`r`n`r`n$leaseA`r`n--$bOk`r`nContent-Disposition: form-data; name=`"propertyId`"`r`n`r`n$propA`r`n--$bOk`r`nContent-Disposition: form-data; name=`"file`"; filename=`"valid.png`"`r`nContent-Type: image/png`r`n`r`n$pngHeader`r`n--$bOk--`r`n"
$up = Invoke-RestMethod -Method Post "$base/files/upload" -Headers $hOwnerA -ContentType "multipart/form-data; boundary=$bOk" -Body $enc.GetBytes($okMultipart)
Pass "Upload tệp PNG hợp lệ ($($up.id))"
Expect-Http { Invoke-WebRequest -UseBasicParsing -Uri "$base/files/$($up.id)/download" -Headers $hOwnerB } 403 "Chặn OWNER_B tải tệp của Khu A"
$dl = Invoke-WebRequest -UseBasicParsing -Uri "$base/files/$($up.id)/download" -Headers $hOwnerA
if ($dl.StatusCode -eq 200) { Pass "OWNER_A tải tệp minh chứng thành công (HTTP 200)" } else { Fail "OWNER_A tải tệp thất bại" }

Write-Host "`n=== KIỂM TRA H04: THU TIỀN, PENDING->CONFIRMED, THU DƯ & IDEMPOTENCY ===" -ForegroundColor Cyan
$testLease = [guid]::NewGuid().ToString()
$testInv = [guid]::NewGuid().ToString()

$rep = Invoke-RestMethod -Method Post "$base/payments/report" -Headers $hRentA -ContentType "application/json" -Body "{`"leaseId`":`"$testLease`",`"amount`":1500000,`"payerName`":`"RENTER_A`",`"paidAt`":`"2026-11-23T16:00:00.000Z`"}"
$sum1 = Invoke-RestMethod -Method Get "$base/payments/lease/$testLease/summary" -Headers $hAccA
if ($sum1.totalPending -eq "1500000" -and $sum1.totalConfirmed -eq "0") {
  Pass "Người thuê báo chuyển khoản tạo PENDING, chưa tính vào CONFIRMED"
} else { Fail "Sai trạng thái PENDING" }

$conf = Invoke-RestMethod -Method Post "$base/payments/$($rep.payment.id)/confirm" -Headers $hAccA -ContentType "application/json" -Body "{`"propertyId`":`"$propA`",`"allocations`":[{`"invoiceId`":`"$testInv`",`"amount`":1500000,`"invoiceTotal`":3620000}]}"
if ($conf.payment.status -eq "CONFIRMED" -and $conf.allocatedAmount -eq "1500000") {
  Pass "Kế toán duyệt PENDING -> CONFIRMED và phân bổ 1.500.000đ"
} else { Fail "Duyệt PENDING thất bại" }

$idem = "check-idem-$(Get-Random)"
$hIdem = @{ Authorization = "Bearer $($tokens['accountant.a@rentflow.local'])"; "Idempotency-Key" = $idem }
$overBody = "{`"propertyId`":`"$propA`",`"leaseId`":`"$testLease`",`"amount`":3000000,`"paymentMethod`":`"CASH`",`"payerName`":`"RENTER_A`",`"paidAt`":`"2026-11-23T16:05:00.000Z`",`"allocations`":[{`"invoiceId`":`"$testInv`",`"amount`":2120000,`"invoiceTotal`":3620000}]}"
$p1 = Invoke-RestMethod -Method Post "$base/payments" -Headers $hIdem -ContentType "application/json" -Body $overBody
$p2 = Invoke-RestMethod -Method Post "$base/payments" -Headers $hIdem -ContentType "application/json" -Body $overBody
if ($p1.unallocatedAmount -eq "880000" -and $p2.idempotentReplay -eq $true) {
  Pass "Thu dư giữ lại 880.000đ chưa phân bổ & Idempotency-Key chống trùng thành công"
} else { Fail "Sai logic thu dư hoặc Idempotency-Key" }

Expect-Http { Invoke-RestMethod -Method Post "$base/payments" -Headers $hAccA -ContentType "application/json" -Body "{`"propertyId`":`"$propA`",`"leaseId`":`"$testLease`",`"amount`":100000,`"paymentMethod`":`"CASH`",`"payerName`":`"RENTER_A`",`"paidAt`":`"2026-11-23T16:06:00.000Z`",`"allocations`":[{`"invoiceId`":`"$testInv`",`"amount`":100000,`"invoiceTotal`":3620000}]}" } 400 "Chặn phân bổ vượt dư nợ hóa đơn"

Write-Host "`n=== KIỂM TRA H06: ĐẢO GIAO DỊCH CÓ LƯU VẾT & BACKUP ===" -ForegroundColor Cyan
$rev = Invoke-RestMethod -Method Post "$base/payments/$($p1.payment.id)/reverse" -Headers $hOwnerA -ContentType "application/json" -Body "{`"propertyId`":`"$propA`",`"reason`":`"Kiểm tra toàn diện H06`"}"
$invSum = Invoke-RestMethod -Method Get "$base/payments/invoice/$testInv/summary" -Headers $hOwnerA
$audits = Invoke-RestMethod -Method Get "$base/audit-logs?entityType=Payment&entityId=$($p1.payment.id)" -Headers $hOwnerA
if ($rev.status -eq "REVERSED" -and $invSum.confirmedPaid -eq "1500000" -and $audits.Count -ge 2) {
  Pass "Đảo giao dịch giữ nguyên lịch sử REVERSED, hoàn trả dư nợ hóa đơn & ghi đủ AuditLog"
} else { Fail "Sai logic đảo giao dịch H06" }

.\scripts\backup.ps1 | Out-Null
$latestBackup = Get-ChildItem "E:\dev\rentflow\backups" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($latestBackup -and (Test-Path "$($latestBackup.FullName)\db.sql")) {
  Pass "Script backup xuất thành công DB + uploads ($($latestBackup.Name))"
} else { Fail "Backup thất bại" }

Write-Host "`n==========================================" -ForegroundColor Cyan
Write-Host "KẾT QUẢ TỔNG HỢP: $passCount PASS | $failCount FAIL" -ForegroundColor $(if ($failCount -eq 0) { "Green" } else { "Red" })
