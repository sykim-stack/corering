// ============================================================
// BRAINPOOL | CoreRing install.js v1.0
// 홈 화면 추가 버튼
// - PWA 지원 브라우저: 설치 프롬프트 직접 호출
// - 미지원 브라우저 (Safari 등): 안내 모달 표시
// ============================================================

let deferredPrompt = null;

// 서비스 워커 등록
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(e => console.error('SW 등록 실패:', e));
}

// PWA 설치 프롬프트 캐치 (Chrome/Android)
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    // 버튼 활성화 표시
    const btn = document.getElementById('install-btn');
    if (btn) btn.classList.add('pwa-ready');
});

// 설치 완료 감지
window.addEventListener('appinstalled', () => {
    showInstallToast('✅ 홈 화면에 추가됐어요!');
    deferredPrompt = null;
});

// 설치 버튼 클릭
document.getElementById('install-btn').addEventListener('click', async () => {
    // 이미 설치된 경우
    if (window.matchMedia('(display-mode: standalone)').matches) {
        showInstallToast('✅ 이미 설치되어 있어요!');
        return;
    }

    // PWA 지원 브라우저 (Chrome, Android)
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            showInstallToast('✅ 홈 화면에 추가됐어요!');
        }
        deferredPrompt = null;
        return;
    }

    // PWA 미지원 브라우저 (Safari, 기타) → 안내 모달
    showInstallGuideModal();
});

// ─── 설치 안내 모달 ───────────────────────────────────────────
function showInstallGuideModal() {
    const existing = document.getElementById('install-guide-modal');
    if (existing) existing.remove();

    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

    const guideHtml = isIOS ? `
        <div class="install-step">① Safari에서 하단 <strong>공유 버튼</strong> 탭</div>
        <div class="install-step">② <strong>"홈 화면에 추가"</strong> 탭</div>
        <div class="install-step">③ <strong>추가</strong> 탭</div>
    ` : `
        <div class="install-step">① Chrome 우측 상단 <strong>⋮ 메뉴</strong> 탭</div>
        <div class="install-step">② <strong>"홈 화면에 추가"</strong> 탭</div>
        <div class="install-step">③ <strong>추가</strong> 탭</div>
    `;

    const overlay = document.createElement('div');
    overlay.id = 'install-guide-modal';
    overlay.style.cssText = `
        position: fixed; inset: 0;
        background: rgba(0,0,0,0.7);
        display: flex; align-items: flex-end;
        z-index: 9999;
    `;
    overlay.innerHTML = `
        <div style="
            background: #1a1a1a;
            width: 100%;
            border-radius: 20px 20px 0 0;
            padding: 28px 24px 40px;
            color: #fff;
        ">
            <div style="font-size:18px; font-weight:700; margin-bottom:6px;">
                📲 홈 화면에 추가하기
            </div>
            <div style="font-size:13px; color:#888; margin-bottom:20px;">
                앱처럼 바로 열 수 있어요
            </div>
            <div style="display:flex; flex-direction:column; gap:12px; margin-bottom:24px;">
                ${guideHtml}
            </div>
            <button id="install-guide-close" style="
                width:100%; padding:14px;
                background:#222; border:none;
                border-radius:12px; color:#fff;
                font-size:15px; cursor:pointer;
            ">확인</button>
        </div>
    `;

    // 스텝 스타일
    overlay.querySelectorAll('.install-step').forEach(el => {
        el.style.cssText = `
            background: #222;
            border-radius: 10px;
            padding: 12px 16px;
            font-size: 14px;
            line-height: 1.5;
        `;
    });

    document.body.appendChild(overlay);

    document.getElementById('install-guide-close').onclick = () => overlay.remove();
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
}

// ─── 토스트 메시지 ────────────────────────────────────────────
function showInstallToast(message) {
    const existing = document.getElementById('install-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'install-toast';
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 90px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(30,30,30,0.92);
        color: #fff;
        padding: 12px 20px;
        border-radius: 24px;
        font-size: 14px;
        z-index: 9999;
        white-space: nowrap;
        box-shadow: 0 4px 16px rgba(0,0,0,0.3);
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2800);
}