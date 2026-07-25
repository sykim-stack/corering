# ============================================================
# TASK-10: 삭제된 방 감지 - 고아 메시지 방지 + 상대방 자동 퇴장 안내
# 실행 위치: G:\brainpool-clean (또는 실제 작업 경로)
# ============================================================

Write-Host "TASK-10 시작: 삭제된 방 감지 로직 추가" -ForegroundColor Cyan

Write-Host ""
Write-Host "patch_orphan_room_fix.cjs 실행..." -ForegroundColor Cyan
node patch_orphan_room_fix.cjs
if ($LASTEXITCODE -ne 0) {
    Write-Host "패치 실패 - 중단" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "npx next build 검증 중..." -ForegroundColor Cyan
npx next build
if ($LASTEXITCODE -ne 0) {
    Write-Host "빌드 실패 - git commit 하지 않습니다" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "빌드 성공" -ForegroundColor Green
Write-Host ""
Write-Host "변경된 파일:" -ForegroundColor Cyan
git status --short

Write-Host ""
$confirm = Read-Host "커밋하고 push 하시겠습니까? (y/n)"

if ($confirm -eq 'y') {
    git add -A
    git commit -m "TASK-10: 삭제된 방에 고아 메시지 적재 방지 + 상대방 자동 퇴장 안내"
    git push
    Write-Host ""
    Write-Host "완료. Vercel 자동 배포 대기 중..." -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "커밋하지 않았습니다." -ForegroundColor Yellow
}