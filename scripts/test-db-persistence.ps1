param()
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
$probe = @'
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
(async () => {
  const rows = await db.$queryRawUnsafe('SELECT VERSION() AS version');
  const invoice = await db.invoice.findUniqueOrThrow({ where: { id: '77777777-7777-4777-8777-777777777701' } });
  const settlement = await db.settlement.findUniqueOrThrow({ where: { leaseId: '55555555-5555-4555-8555-555555555502' } });
  console.log(JSON.stringify({
    version: rows[0].version, invoice: invoice.totalAmount, paid: invoice.paidAmount, debt: invoice.remainingAmount,
    refund: settlement.refund, invoiceCount: await db.invoice.count(), trialCount: await db.trialLead.count(),
  }));
})().catch(() => { console.error('MySQL probe failed'); process.exitCode = 1; }).finally(() => db.$disconnect());
'@
function Read-DemoData {
    Push-Location backend
    try {
        $data = $probe | node --env-file=.env -
        if ($LASTEXITCODE -ne 0) { throw 'Could not read data from MySQL demo' }
        return $data
    } finally { Pop-Location }
}
$before = Read-DemoData
docker compose -p rentflow-demo restart mysql
if ($LASTEXITCODE -ne 0) { throw 'Could not restart demo MySQL' }
docker compose -p rentflow-demo up -d --wait mysql
if ($LASTEXITCODE -ne 0) { throw 'Demo MySQL did not become healthy' }
$after = Read-DemoData
if ($before -cne $after) { throw 'Demo records changed after MySQL restart' }
Write-Host "RF14 PASS $after"
