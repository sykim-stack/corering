// ============================================================
// BRAINPOOL | CoreRing install.js v1.4 (Infinite Loop Fix)
// - 담당: HajunAI (관제탑)
// - 패치: sessionStorage를 이용한 무한 새로고침 방지
// ============================================================

(function() {
    const UA = (navigator.userAgent || "").toLowerCase();
    const isKakao = UA.indexOf('kakaotalk') !== -1;
    const isAndroid = UA.indexOf('android') !== -1;
    const isIOS = /iphone|ipad|ipod/.test(UA);

    // ─── 1단계: 카카오톡 탈출 및 루프 방지 ───────────────────
    if (isKakao) {
        // 이미 한 번 탈출을 시도했는지 세션 저장소 확인
        const hasAttemptedEscape = sessionStorage.getItem('kakao_escape_attempt');

        if (!hasAttemptedEscape) {
            // 시도 기록 저장 (세션이 유지되는 동안 1회만 실행)
            sessionStorage.setItem('kakao_escape_attempt', 'true');

            if (isAndroid) {
                // 안드로이드 크롬 강제 실행 (줄바꿈 없는 순수 문자열)
                const chromeUrl = "intent://" + window.location.host + window.location.pathname + window.location.search + "#Intent;scheme=https;package=com.android.chrome;end";
                window.location.href = chromeUrl;
            } else if (isIOS) {
                // iOS는 안내 모달 표시
                window.addEventListener('load', showKakaoSafariGuide);
            }
        } else {
            // 이미 시도했는데도 카톡 안에 있다면? -> 루프를 멈추고 수동 안내만 표시
            window.addEventListener('load', () => {
                showInstallToast("카톡 인앱에서는 설치가 어렵습니다. 외부 브라우저를 이용해주세요.");
                showKakaoSafariGuide(); // 수동 안내창 띄우기
            });
        }
    }

    // ─── 2단계: PWA 설치 로직 ──────────────────────────────────
    let deferredPrompt = null;

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js', { scope: '/' })
            .catch(e => console.warn('SW 등록 실패:', e));
    }

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        const btn = document.getElementById('install-btn');
        if (btn) {
            btn.style.display = 'block';
            btn.style.opacity = '1';
        }
    });

    window.addEventListener('appinstalled', () => {
        showInstallToast('✅ 설치가 완료되었습니다!');
        deferredPrompt = null;
    });

    document.addEventListener('click', (e) => {
        const btn = e.target.closest('#install-btn');
        if (btn) handleInstallClick();
    });

    async function handleInstallClick() {
        if (window.matchMedia('(display-mode: standalone)').matches) {
            showInstallToast('이미 앱이 설치되어 있습니다.');
            return;
        }

        if (deferredPrompt) {
            try {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                if (outcome === 'accepted') showInstallToast('설치를 시작합니다.');
            } catch (err) { console.warn(err); }
            deferredPrompt = null;
            return;
        }
        showInstallGuideModal();
    }

    // ─── 3단계: UI 컴포넌트 ──────────────────────────────────

    function showKakaoSafariGuide() {
        if (document.getElementById('kakao-guide-overlay')) return;
        const overlay = document.createElement('div');
        overlay.id = 'kakao-guide-overlay';
        overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.95);display:flex;flex-direction:column;align-items:flex-end;padding:20px;z-index:10000;color:#fff;`;
        overlay.innerHTML = `
            <div style="margin-top:20px;text-align:right;width:100%;">
                <p style="font-size:24px;font-weight:900;margin-bottom:15px;color:#FFEB3B;">외부 브라우저로 실행</p>
                <p style="font-size:16px;line-height:1.6;color:#fff;">
                    PWA 설치를 위해 외부 브라우저가 필요합니다.<br><br>
                    1. 우측 하단 <b>점 세개(···)</b> 클릭<br>
                    2. <b>'다른 브라우저로 열기'</b> 클릭
                </p>
            </div>
            <div style="margin-top:30px;margin-right:20px;animation:bounce 1s infinite;"><span style="font-size:50px;">↘︎</span></div>
            <style>@keyframes bounce { 0%,100% { transform:translateY(0); } 50% { transform:translateY(15px); } }</style>
        `;
        overlay.onclick = () => overlay.remove();
        document.body.appendChild(overlay);
    }

    function showInstallGuideModal() {
        const existing = document.getElementById('install-guide-modal');
        if (existing) existing.remove();
        const guideHtml = isIOS ? 
            `<div class="install-step">① Safari 하단 <b>공유(↑)</b> 클릭</div><div class="install-step">② <b>홈 화면에 추가</b> 선택</div><div class="install-step">③ 우측 상단 <b>추가</b> 클릭</div>` : 
            `<div class="install-step">① 브라우저 <b>메뉴(⋮)</b> 클릭</div><div class="install-step">② <b>홈 화면에 추가</b> 선택</div><div class="install-step">③ 팝업에서 <b>추가</b> 클릭</div>`;

        const overlay = document.createElement('div');
        overlay.id = 'install-guide-modal';
        overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px;`;
        overlay.innerHTML = `
            <div style="background:#1a1a1a;width:100%;max-width:360px;border-radius:24px;padding:32px 24px;color:#fff;border:1px solid #333;">
                <div style="font-size:22px;font-weight:700;margin-bottom:10px;">📲 홈 화면에 추가</div>
                <div style="font-size:15px;color:#aaa;margin-bottom:28px;">앱처럼 설치하여 편하게 사용하세요.</div>
                <div style="display:flex;flex-direction:column;gap:15px;margin-bottom:30px;">${guideHtml}</div>
                <button id="guide-close" style="width:100%;padding:18px;background:#fff;border:none;border-radius:16px;color:#000;font-size:17px;font-weight:800;">확인</button>
            </div>
        `;
        document.body.appendChild(overlay);
        overlay.querySelectorAll('.install-step').forEach(el => {
            el.style.cssText = `background:#262626;border-radius:14px;padding:16px 20px;font-size:15px;border-left:5px solid #FFEB3B;`;
        });
        document.getElementById('guide-close').onclick = () => overlay.remove();
    }

    function showInstallToast(message) {
        const existing = document.querySelector('.install-toast');
        if (existing) existing.remove();
        const toast = document.createElement('div');
        toast.className = 'install-toast';
        toast.textContent = message;
        toast.style.cssText = `position:fixed;bottom:110px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.9);color:#fff;padding:14px 28px;border-radius:30px;font-size:15px;z-index:10001;white-space:nowrap;`;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.5s';
            setTimeout(() => toast.remove(), 500);
        }, 3000);
    }
})();