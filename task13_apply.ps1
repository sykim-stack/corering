Write-Host "TASK-13 start" -ForegroundColor Cyan
Write-Host ""
Write-Host "Running patch_hide_delete_button.cjs..." -ForegroundColor Cyan
node patch_hide_delete_button.cjs
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
    git commit -m "TASK-13: Hide delete button for non-owners in room list"
    git push
    Write-Host ""
    Write-Host "Done. Waiting for Vercel auto-deploy..." -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "Not committed." -ForegroundColor Yellow
}
