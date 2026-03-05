// ============================================================
// BRAINPOOL | CoreRing install.js v1.2 (Kakao Escape Edition)
// - 담당: HajunAI (관제탑)
// - 기능: 카톡 인앱 브라우저 감지 시 탈출 및 PWA 설치 가이드
// ============================================================

(function() {
    const UA = navigator.userAgent.toLowerCase();
    const isKakao = UA.indexOf('kakaotalk') !== -1;
    const isAndroid = UA.indexOf('android') !== -1;
    const isIOS = /iphone|ipad|ipod/.test(UA);
    const currentUrl = window.location.href;

    // ─── 1단계: 카카오톡 인앱 브라우저 탈출 로직 ──────────────────
    if (isKakao) {
        if (isAndroid) {
            // 안드로이드: 크롬 브라우저로 강제 전환
            const chromeUrl = `intent://${window.location.host}${window.location.pathname}${window.location.search}#Intent;scheme=https;package=com.android.chrome;end`;
            window.location.href = chromeUrl;
        } else if (isIOS) {
            // iOS: 사파리 유도 오버레이 표시 (페이지 로드 후 실행)
            window.addEventListener('load', () => {
                showKakaoSafariGuide();
            });
        }
    }

    // ─── 2단계: PWA 설치 로직 ──────────────────────────────────
    let deferredPrompt = null;

    // 서비스 워커 등록
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(e => console.error('SW 등록 실패:', e));
    }

    // PWA 설치 프롬프트 캐치 (Chrome/Android 전용)
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        const btn = document.getElementById('install-btn');
        if (btn) {
            btn.classList.add('pwa-ready');
            btn.style.display = 'block'; // 버튼 보이기
        }
    });

    // 설치 완료 감지
    window.addEventListener('appinstalled', () => {
        showInstallToast('✅ 홈 화면에 설치되었습니다!');
        deferredPrompt = null;
    });

    // 설치 버튼 클릭 이벤트 핸들러
    document.addEventListener('click', async (e) => {
        if (e.target && e.target.id === 'install-btn') {
            handleInstallClick();
        }
    });

    async function handleInstallClick() {
        // 이미 앱으로 접속 중인 경우
        if (window.matchMedia('(display-mode: standalone)').matches) {
            showInstallToast('✅ 이미 설치되어 실행 중입니다!');
            return;
        }

        // PWA 설치 프롬프트가 대기 중인 경우 (Android/Chrome)
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                showInstallToast('✅ 설치를 시작합니다!');
            }
            deferredPrompt = null;
            return;
        }

        // 그 외 (Safari, 또는 프롬프트가 안 뜬 경우) -> 수동 안내
        showInstallGuideModal();
    }

    // ─── 3단계: UI 컴포넌트 (iOS 가이드 / 일반 가이드 / 토스트) ─────

    // 카톡-iOS 전용 가이드
    function showKakaoSafariGuide() {
        const overlay = document.createElement('div');
        overlay.id = 'kakao-guide-overlay';
        overlay.style.cssText = `
            position: fixed; inset: 0; background: rgba(0,0,0,0.9);
            display: flex; flex-direction: column; align-items: flex-end;
            padding: 20px; z-index: 10000; color: #fff;
        `;
        overlay.innerHTML = `
            <div style="margin-top: 10px; text-align: right; width: 100%;">
                <p style="font-size: 22px; font-weight: 800; margin-bottom: 12px; color: #FFEB3B;">
                    사파리(Safari)로 열기
                </p>
                <p style="font-size: 15px; line-height: 1.6; color: #eee;">
                    홈 화면에 추가하려면<br>
                    우측 하단 <b>점 세개(···)</b>를 누르고<br>
                    <b>'다른 브라우저로 열기'</b>를 선택하세요!
                </p>
            </div>
            <div style="margin-top: 20px; margin-right: 15px; animation: bounce 1s infinite;">
                <span style="font-size: 40px;">↘︎</span>
            </div>
            <style>
                @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(10px); } }
            </style>
        `;
        overlay.onclick = () => overlay.remove();
        document.body.appendChild(overlay);
    }

    // 일반 설치 안내 모달 (PWA 미지원 브라우저용)
    function showInstallGuideModal() {
        const existing = document.getElementById('install-guide-modal');
        if (existing) existing.remove();

        const guideHtml = isIOS ? `
            <div class="install-step">① Safari 하단 <strong>공유 버튼(↑)</strong> 탭</div>
            <div class="install-step">② 메뉴에서 <strong>'홈 화면에 추가'</strong> 탭</div>
            <div class="install-step">③ 우측 상단 <strong>'추가'</strong> 버튼 탭</div>
        ` : `
            <div class="install-step">① 브라우저 우측 상단 <strong>점 세개(⋮)</strong> 탭</div>
            <div class="install-step">② <strong>'홈 화면에 추가'</strong> 또는 <strong>'앱 설치'</strong> 탭</div>
            <div class="install-step">③ 팝업에서 <strong>'추가'</strong> 선택</div>
        `;

        const overlay = document.createElement('div');
        overlay.id = 'install-guide-modal';
        overlay.style.cssText = `
            position: fixed; inset: 0; background: rgba(0,0,0,0.8);
            display: flex; align-items: flex-end; z-index: 9999;
        `;
        overlay.innerHTML = `
            <div style="background:#1a1a1a; width:100%; border-radius:20px 20px 0 0; padding:30px 24px 40px; color:#fff;">
                <div style="font-size:19px; font-weight:700; margin-bottom:8px;">📲 홈 화면에 추가하기</div>
                <div style="font-size:14px; color:#aaa; margin-bottom:24px;">CoreRing을 앱처럼 빠르게 사용하세요.</div>
                <div style="display:flex; flex-direction:column; gap:12px; margin-bottom:24px;">${guideHtml}</div>
                <button id="guide-close" style="width:100%; padding:15px; background:#333; border:none; border-radius:12px; color:#fff; font-size:16px; font-weight:600;">확인했습니다</button>
            </div>
        `;
        
        document.body.appendChild(overlay);
        
        // 스텝 내부 스타일링
        overlay.querySelectorAll('.install-step').forEach(el => {
            el.style.cssText = `background:#262626; border-radius:12px; padding:14px 18px; font-size:14px; line-height:1.5; border-left: 4px solid #FFEB3B;`;
        });

        document.getElementById('guide-close').onclick = () => overlay.remove();
        overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    }

    // 토스트 메시지
    function showInstallToast(message) {
        const toast = document.createElement('div');
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed; bottom: 100px; left: 50%; transform: translateX(-50%);
            background: rgba(0,0,0,0.85); color: #fff; padding: 12px 24px;
            border-radius: 30px; font-size: 14px; z-index: 10001; box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        `;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.5s';
            setTimeout(() => toast.remove(), 500);
        }, 2500);
    }
})();