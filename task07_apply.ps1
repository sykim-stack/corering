# ============================================================
# TASK-07: iOS 기기 제약 안내 메시지 추가 (녹음 실패 / TTS 음성 없음)
# 실행 위치: C:\brainpool-clean\brainpool-clean
# ============================================================

$ROOT = "g:\brainpool-clean"
Set-Location $ROOT

Write-Host "TASK-07 시작: iOS 기기 제약 안내 추가" -ForegroundColor Cyan

Write-Host ""
Write-Host "patch_ios_fallback.cjs 실행..." -ForegroundColor Cyan
node patch_ios_fallback.cjs
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
    git commit -m "TASK-07: iOS 기기 제약(녹음 미지원/TTS 음성 없음) 시 사용자 안내 메시지 추가"
    git push
    Write-Host ""
    Write-Host "완료. Vercel 자동 배포 대기 중..." -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "커밋하지 않았습니다." -ForegroundColor Yellow
}