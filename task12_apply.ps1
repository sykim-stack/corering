Write-Host "TASK-12 start" -ForegroundColor Cyan
Write-Host ""
Write-Host "Running patch_room_owner_only_delete.cjs..." -ForegroundColor Cyan
node patch_room_owner_only_delete.cjs
if ($LASTEXITCODE -ne 0) {
    Write-Host "Patch failed - check diagnostics above" -ForegroundColor Red
    exit 1
}
Write-Host ""
Write-Host "Running npx next build..." -ForegroundColor Cyan
npx next build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed - not committing" -ForegroundColor Red
    exit 1
}
Write-Host ""
Write-Host "Build succeeded" -ForegroundColor Green
Write-Host ""
Write-Host "Changed files:" -ForegroundColor Cyan
git status --short
Write-Host ""
$confirm = Read-Host "Commit and push these changes? (y/n)"
if ($confirm -eq 'y') {
    git add -A
    git commit -m "TASK-12: Restrict room deletion to owner only (server-side verification)"
    git push
    Write-Host ""
    Write-Host "Done. Waiting for Vercel auto-deploy..." -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "Not committed." -ForegroundColor Yellow
}
