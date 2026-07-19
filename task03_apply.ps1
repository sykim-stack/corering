# ============================================================
# TASK-03: SEO ADR-001 적용 (공유 URL = /rooms/{id} 통일)
# 실행 위치: C:\brainpool-clean\brainpool-clean
# ============================================================

$ROOT = "C:\brainpool-clean\brainpool-clean"
Set-Location $ROOT

Write-Host "🔵 TASK-03 시작: SEO URL 통일 (ADR-SEO-001)" -ForegroundColor Cyan

# ── STEP 0: 앵커 사전 확인 (Select-String) ──────────────────────
Write-Host ""
Write-Host "🔍 앵커 문자열 사전 확인 중..." -ForegroundColor Yellow

$anchorChecks = @(
    @{ File = "components\ShareRoomModal.tsx"; Pattern = "roomCode: string;" },
    @{ File = "components\ShareRoomModal.tsx"; Pattern = "export default function ShareRoomModal" },
    @{ File = "app\page.tsx"; Pattern = "export default function Home\(\) \{" },
    @{ File = "app\page.tsx"; Pattern = "shareRoomCode, setShareRoomCode" },
    @{ File = "app\page.tsx"; Pattern = "URL 딥링크 처리" }
)

$allFound = $true
foreach ($check in $anchorChecks) {
    $found = Select-String -Path $check.File -Pattern $check.Pattern -Quiet
    if ($found) {
        Write-Host "  ✅ 발견: $($check.Pattern) in $($check.File)" -ForegroundColor Green
    } else {
        Write-Host "  ❌ 없음: $($check.Pattern) in $($check.File)" -ForegroundColor Red
        $allFound = $false
    }
}

if (-not $allFound) {
    Write-Host ""
    Write-Host "⚠️  일부 앵커가 없습니다. 이미 부분 적용됐거나 파일이 다를 수 있습니다." -ForegroundColor Yellow
    Write-Host "    계속 진행하면 각 .cjs 스크립트가 SKIP 처리하며 안전하게 넘어갑니다." -ForegroundColor Yellow
}

# ── STEP 1: ShareRoomModal.tsx 패치 ──────────────────────────────
Write-Host ""
Write-Host "🛠️  patch_seo_sharemodal.cjs 실행..." -ForegroundColor Cyan
node patch_seo_sharemodal.cjs
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ ShareRoomModal.tsx 패치 실패 - 중단" -ForegroundColor Red
    exit 1
}

# ── STEP 2: page.tsx 패치 ─────────────────────────────────────────
Write-Host ""
Write-Host "🛠️  patch_seo_page.cjs 실행..." -ForegroundColor Cyan
node patch_seo_page.cjs
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ page.tsx 패치 실패 - 중단" -ForegroundColor Red
    exit 1
}

# ── STEP 3: 빌드 검증 ─────────────────────────────────────────────
Write-Host ""
Write-Host "🏗️  npx next build 검증 중..." -ForegroundColor Cyan
npx next build
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "❌ 빌드 실패 — git commit 하지 않습니다. 에러 내용을 확인하세요." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✅ 빌드 성공" -ForegroundColor Green

# ── STEP 4: 변경 사항 확인 (사람 리뷰) ───────────────────────────
Write-Host ""
Write-Host "📋 변경된 파일:" -ForegroundColor Cyan
git status --short

Write-Host ""
$confirm = Read-Host "위 변경사항을 커밋하고 push 하시겠습니까? (y/n)"

if ($confirm -eq 'y') {
    git add -A
    git commit -m "TASK-03: SEO ADR-001 적용 - 공유 URL을 /rooms/{id}로 통일"
    git push
    Write-Host ""
    Write-Host "🚀 완료. Vercel 자동 배포 대기 중..." -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "⏸️  커밋하지 않았습니다. 직접 git add/commit 하세요." -ForegroundColor Yellow
}