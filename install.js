// ============================================================
// BRAINPOOL | CoreRing install.js v1.3 (Final Fix)
// - 담당: HajunAI (관제탑)
// - 기능: 카톡 탈출 + PWA 설치 + 모든 브라우저 대응 가이드
// ============================================================

(function() {
    const UA = (navigator.userAgent || "").toLowerCase();
    const isKakao = UA.indexOf('kakaotalk') !== -1;
    const isAndroid = UA.indexOf('android') !== -1;
    const isIOS = /iphone|ipad|ipod/.test(UA);
    const currentUrl = window.location.href;

    // ─── 1단계: 카카오톡 인앱 브라우저 탈출 로직 ──────────────────
    if (isKakao) {
        if (isAndroid) {
            try {
                // [CRITICAL FIX] 줄바꿈 제거한 단일 문자열로 인텐트 구성
                const chromeUrl = `intent://${window.location.host}${window.location.pathname}${window.location.search}#Intent;scheme=https;package=com.android.chrome;end`;
                window.location.href = chromeUrl;
                
                setTimeout(() => { window.location.href = currentUrl; }, 1200);
            } catch (err) {
                console.warn("Kakao escape fail:", err);
            }
        } else if (isIOS) {
            window.addEventListener('load', showKakaoSafariGuide);
        }
    }

    // ─── 2단계: PWA 설치 로직 ──────────────────────────────────
    let deferredPrompt = null;

    // 서비스 워커 등록
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js', { scope: '/' })
            .catch(e => console.warn('SW 등록 실패:', e));
    }

    // PWA 설치 프롬프트 캐치 (Android/Chrome)
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        
        const btn = document.getElementById('install-btn');
        if (btn) {
            btn.classList.add('pwa-ready');
            btn.style.display = 'block'; // 버튼 보이기
            btn.style.opacity = '1';
        }
    });

    // 설치 완료 시
    window.addEventListener('appinstalled', () => {
        showInstallToast('✅ 홈 화면에 설치되었습니다.');
        deferredPrompt = null;
    });

    // [중요] 버튼 클릭 이벤트 리스너 (위임 방식)
    document.addEventListener('click', async (e) => {
        const btn = e.target.closest('#install-btn');
        if (btn) {
            handleInstallClick();
        }
    });

    async function handleInstallClick() {
        // 1. 이미 앱 실행 중인 경우
        if (window.matchMedia('(display-mode: standalone)').matches) {
            showInstallToast('이미 앱이 설치되어 있습니다.');
            return;
        }

        // 2. 안드로이드/크롬 설치 프롬프트가 대기 중인 경우
        if (deferredPrompt) {
            try {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                if (outcome === 'accepted') {
                    showInstallToast('설치를 시작합니다.');
                }
            } catch (err) {
                console.warn("Prompt error:", err);
            }
            deferredPrompt = null;
            return;
        }

        // 3. 아이폰(Safari) 또는 프롬프트가 지원되지 않는 경우 -> 수동 가이드
        showInstallGuideModal();
    }

    // ─── 3단계: UI 컴포넌트 ──────────────────────────────────

    function showKakaoSafariGuide() {
        if (document.getElementById('kakao-guide-overlay')) return;
        const overlay = document.createElement('div');
        overlay.id = 'kakao-guide-overlay';
        overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.92);display:flex;flex-direction:column;align-items:flex-end;padding:20px;z-index:10000;color:#fff;`;
        overlay.innerHTML = `
            <div style="margin-top:20px;text-align:right;width:100%;">
                <p style="font-size:22px;font-weight:800;margin-bottom:12px;color:#FFEB3B;">Safari로 열기</p>
                <p style="font-size:16px;line-height:1.6;color:#eee;">설치를 위해 우측 하단 <b>···</b> 누르고<br><b>'다른 브라우저로 열기'</b>를 클릭하세요!</p>
            </div>
            <div style="margin-top:20px;margin-right:15px;animation:bounce 1s infinite;"><span style="font-size:40px;">↘︎</span></div>
            <style>@keyframes bounce { 0%,100% { transform:translateY(0); } 50% { transform:translateY(10px); } }</style>
        `;
        overlay.onclick = () => overlay.remove();
        document.body.appendChild(overlay);
    }

    function showInstallGuideModal() {
        const existing = document.getElementById('install-guide-modal');
        if (existing) existing.remove();

        const guideHtml = isIOS ? `
            <div class="install-step">① Safari 하단 <b>공유 버튼(↑)</b> 클릭</div>
            <div class="install-step">② 메뉴에서 <b>홈 화면에 추가</b> 선택</div>
            <div class="install-step">③ 우측 상단 <b>추가</b> 클릭</div>
        ` : `
            <div class="install-step">① 브라우저 <b>메뉴(⋮)</b> 클릭</div>
            <div class="install-step">② <b>홈 화면에 추가</b> 또는 <b>설치</b> 클릭</div>
            <div class="install-step">③ 팝업에서 <b>추가</b> 선택</div>
        `;

        const overlay = document.createElement('div');
        overlay.id = 'install-guide-modal';
        overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px;`;
        overlay.innerHTML = `
            <div style="background:#1a1a1a;width:100%;max-width:360px;border-radius:24px;padding:30px 24px;color:#fff;border:1px solid #333;">
                <div style="font-size:20px;font-weight:700;margin-bottom:8px;">📲 홈 화면에 추가</div>
                <div style="font-size:14px;color:#aaa;margin-bottom:24px;">CoreRing을 앱처럼 사용해보세요.</div>
                <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:24px;">${guideHtml}</div>
                <button id="guide-close" style="width:100%;padding:16px;background:#fff;border:none;border-radius:14px;color:#000;font-size:16px;font-weight:700;">확인</button>
            </div>
        `;
        document.body.appendChild(overlay);
        overlay.querySelectorAll('.install-step').forEach(el => {
            el.style.cssText = `background:#262626;border-radius:12px;padding:14px 18px;font-size:14px;line-height:1.5;border-left:4px solid #FFEB3B;`;
        });
        document.getElementById('guide-close').onclick = () => overlay.remove();
    }

    function showInstallToast(message) {
        const toast = document.createElement('div');
        toast.textContent = message;
        toast.style.cssText = `position:fixed;bottom:100px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.85);color:#fff;padding:12px 24px;border-radius:30px;font-size:14px;z-index:10001;box-shadow:0 4px 15px rgba(0,0,0,0.5);`;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.5s';
            setTimeout(() => { if (toast.parentNode) toast.remove(); }, 500);
        }, 2500);
    }
})();