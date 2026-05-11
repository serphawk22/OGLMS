Write-Host ""
Write-Host "=== Recorded Classes Setup ===" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/2] Generating Prisma client..." -ForegroundColor Yellow
npx prisma generate
if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: prisma generate failed" -ForegroundColor Red; exit 1 }
Write-Host "Prisma client generated OK" -ForegroundColor Green

Write-Host ""
Write-Host "[2/2] Pushing schema to database..." -ForegroundColor Yellow
npx prisma db push --accept-data-loss
if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: prisma db push failed" -ForegroundColor Red; exit 1 }
Write-Host "Database schema pushed OK" -ForegroundColor Green

Write-Host ""
Write-Host "Setup complete. Starting dev server..." -ForegroundColor Cyan
Write-Host ""
npm run dev
