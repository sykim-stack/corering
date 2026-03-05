// ============================================================
// BRAINPOOL | CoreRing install.js v1.2 (Kakao Escape Edition)
// - 담당: HajunAI (관제탑)
// - 기능: 카톡 인앱 브라우저 감지 시 탈출 및 PWA 설치 가이드
// - PATCH: 안정성 / 브라우저 호환 / 보안 개선
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
                const chromeUrl =
                `intent://${window.location.host}${window.location.pathname}${window.location.search}
                #Intent;scheme=https;package=com.android.chrome;end`;

                window.location.href = chromeUrl;

                // fallback (intent 실패 대비)
                setTimeout(() => {
                    window.location.href = currentUrl;
                }, 1200);

            } catch (err) {
                console.warn("Kakao escape fail:", err);
            }

        } else if (isIOS) {

            window.addEventListener('load', () => {
                showKakaoSafariGuide();
            });

        }
    }

    // ─── 2단계: PWA 설치 로직 ──────────────────────────────────

    let deferredPrompt = null;

    // 서비스 워커 등록
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker
            .register('/sw.js', { scope: '/' })
            .catch(e => console.warn('SW 등록 실패:', e));
    }

    // PWA 설치 프롬프트 캐치
    window.addEventListener('beforeinstallprompt', (e) => {

        e.preventDefault();
        deferredPrompt = e;

        const btn = document.getElementById('install-btn');

        if (btn) {
            btn.classList.add('pwa-ready');
            btn.style.display = 'block';
        }

    });

    // 설치 완료 감지
    window.addEventListener('appinstalled', () => {

        showInstallToast('설치가 완료되었습니다.');
        deferredPrompt = null;

    });

    // 설치 버튼 클릭 이벤트 핸들러
    document.addEventListener('click', async (e) => {

        if (e.target?.id === 'install-btn') {
            handleInstallClick();
        }

    });

    async function handleInstallClick() {

        // 이미 앱 실행 상태
        if (window.matchMedia('(display-mode: standalone)').matches) {

            showInstallToast('이미 설치되어 실행 중입니다.');
            return;

        }

        // PWA 프롬프트 가능
        if (deferredPrompt) {

            try {

                deferredPrompt.prompt();

                const { outcome } = await deferredPrompt.userChoice;

                if (outcome === 'accepted') {
                    showInstallToast('설치를 시작합니다.');
                }

            } catch (err) {

                console.warn("install prompt fail:", err);

            }

            deferredPrompt = null;
            return;

        }

        // 수동 설치 안내
        showInstallGuideModal();

    }

    // ─── 3단계: UI 컴포넌트 ──────────────────────────────────

    function showKakaoSafariGuide() {

        const overlay = document.createElement('div');

        overlay.id = 'kakao-guide-overlay';

        overlay.style.cssText = `
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.9);
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            padding: 20px;
            z-index: 10000;
            color: #fff;
        `;

        overlay.innerHTML = `
            <div style="margin-top:10px;text-align:right;width:100%;">
                <p style="font-size:22px;font-weight:800;margin-bottom:12px;color:#FFEB3B;">
                    Safari로 열어주세요
                </p>
                <p style="font-size:15px;line-height:1.6;color:#eee;">
                    화면 우측 아래 <b>···</b> 버튼을 누른 뒤<br>
                    <b>'다른 브라우저로 열기'</b>를 선택해주세요.
                </p>
            </div>

            <div style="margin-top:20px;margin-right:15px;animation:bounce 1s infinite;">
                <span style="font-size:40px;">↘︎</span>
            </div>

            <style>
            @keyframes bounce {
                0%,100% { transform:translateY(0); }
                50% { transform:translateY(10px); }
            }
            </style>
        `;

        overlay.onclick = () => overlay.remove();

        document.body.appendChild(overlay);

    }

    function showInstallGuideModal() {

        const existing = document.getElementById('install-guide-modal');
        if (existing) existing.remove();

        const guideHtml = isIOS ? `
            <div class="install-step">① Safari 하단 <strong>공유 버튼</strong></div>
            <div class="install-step">② <strong>홈 화면에 추가</strong></div>
            <div class="install-step">③ <strong>추가</strong> 선택</div>
        ` : `
            <div class="install-step">① 브라우저 메뉴 열기</div>
            <div class="install-step">② <strong>홈 화면에 추가</strong></div>
            <div class="install-step">③ 추가 선택</div>
        `;

        const overlay = document.createElement('div');

        overlay.id = 'install-guide-modal';

        overlay.style.cssText = `
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.8);
            display: flex;
            align-items: flex-end;
            z-index: 9999;
        `;

        overlay.innerHTML = `
            <div style="
                background:#1a1a1a;
                width:100%;
                border-radius:20px 20px 0 0;
                padding:30px 24px 40px;
                color:#fff;
            ">

                <div style="font-size:19px;font-weight:700;margin-bottom:8px;">
                    홈 화면에 추가
                </div>

                <div style="font-size:14px;color:#aaa;margin-bottom:24px;">
                    CoreRing을 조금 더 편하게 사용할 수 있습니다.
                </div>

                <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:24px;">
                    ${guideHtml}
                </div>

                <button id="guide-close"
                style="
                    width:100%;
                    padding:15px;
                    background:#333;
                    border:none;
                    border-radius:12px;
                    color:#fff;
                    font-size:16px;
                    font-weight:600;
                ">
                확인
                </button>

            </div>
        `;

        document.body.appendChild(overlay);

        overlay.querySelectorAll('.install-step').forEach(el => {

            el.style.cssText = `
                background:#262626;
                border-radius:12px;
                padding:14px 18px;
                font-size:14px;
                line-height:1.5;
                border-left:4px solid #FFEB3B;
            `;

        });

        document.getElementById('guide-close').onclick = () => overlay.remove();

        overlay.onclick = (e) => {
            if (e.target === overlay) overlay.remove();
        };

    }

    function showInstallToast(message) {

        const toast = document.createElement('div');

        toast.textContent = message;

        toast.style.cssText = `
            position: fixed;
            bottom: 100px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0,0,0,0.85);
            color: #fff;
            padding: 12px 24px;
            border-radius: 30px;
            font-size: 14px;
            z-index: 10001;
        `;

        document.body.appendChild(toast);

        setTimeout(() => {

            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.5s';

            setTimeout(() => {
                if (toast.parentNode) toast.remove();
            }, 500);

        }, 2500);

    }

})();