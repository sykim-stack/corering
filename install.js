// ============================================================
// BRAINPOOL | CoreRing install.js v1.6 (Google Search Fix)
// - 담당: HajunAI (관제탑)
// - 패치: 안드로이드 인텐트 주소 정규화 (구글 검색 현상 해결)
// ============================================================

(function() {
    const UA = (navigator.userAgent || "").toLowerCase();
    const isKakao = UA.indexOf('kakaotalk') !== -1;
    const isAndroid = UA.indexOf('android') !== -1;
    const isIOS = /iphone|ipad|ipod/.test(UA);

    // ─── 1단계: 카카오톡 탈출 로직 (정밀 수정) ──────────────────
    if (isKakao) {
        const hasAttempted = sessionStorage.getItem('kakao_escape');
        
        if (!hasAttempted) {
            sessionStorage.setItem('kakao_escape', 'true');
            
            if (isAndroid) {
                // [CRITICAL FIX] https://를 제거한 순수 호스트+경로만 추출
                // intent://corering.vercel.app/... 형식이 되어야 구글 검색으로 안 갑니다.
                const cleanUrl = window.location.href.replace(/https?:\/\//, "");
                const chromeIntent = "intent://" + cleanUrl + "#Intent;scheme=https;package=com.android.chrome;end";
                
                location.href = chromeIntent;
            } else if (isIOS) {
                window.addEventListener('load', showKakaoSafariGuide);
            }
        } else {
            // 탈출 실패 시 수동 안내
            window.addEventListener('load', showKakaoSafariGuide);
        }
    }

    // ─── 2단계: PWA 설치 엔진 ──────────────────────────────────
    let deferredPrompt = null;

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
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

    document.addEventListener('click', (e) => {
        const btn = e.target.closest('#install-btn');
        if (btn) handleSmartInstall();
    });

    async function handleSmartInstall() {
        if (window.matchMedia('(display-mode: standalone)').matches) {
            showInstallToast('✅ 이미 앱이 설치되어 있습니다.');
            return;
        }

        // [크롬/안드로이드] 바로 설치 팝업
        if (deferredPrompt) {
            try {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                if (outcome === 'accepted') showInstallToast('설치를 시작합니다!');
            } catch (err) { console.error(err); }
            deferredPrompt = null;
            return;
        }

        // [아이폰/기타] 수동 안내창
        showInstallGuideModal();
    }

    // ─── 3단계: UI 컴포넌트 ──────────────────────────────────

    function showKakaoSafariGuide() {
        if (document.getElementById('kakao-guide-overlay')) return;
        const div = document.createElement('div');
        div.id = 'kakao-guide-overlay';
        div.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.95);display:flex;flex-direction:column;align-items:flex-end;padding:25px;z-index:10000;color:#fff;`;
        div.innerHTML = `
            <div style="text-align:right;width:100%;">
                <p style="font-size:24px;font-weight:900;color:#FFEB3B;margin-bottom:10px;">외부 브라우저로 연결</p>
                <p style="font-size:16px;line-height:1.6;">설치를 위해 우측 하단 <b>점 세개(···)</b>를<br>누른 뒤 <b>'다른 브라우저로 열기'</b>를 클릭!</p>
            </div>
            <div style="margin-top:30px;margin-right:15px;animation:bounce 1s infinite;"><span style="font-size:50px;">↘︎</span></div>
            <style>@keyframes bounce { 0%,100% { transform:translateY(0); } 50% { transform:translateY(15px); } }</style>
        `;
        div.onclick = () => div.remove();
        document.body.appendChild(div);
    }

    function showInstallGuideModal() {
        const existing = document.getElementById('install-guide-modal');
        if (existing) existing.remove();
        const guideHtml = isIOS ? 
            `<div class="step">① Safari 하단 <b>공유(↑)</b> 클릭</div><div class="step">② <b>홈 화면에 추가</b> 선택</div><div class="step">③ 우측 상단 <b>추가</b> 클릭</div>` : 
            `<div class="step">① 브라우저 <b>메뉴(⋮)</b> 클릭</div><div class="step">② <b>홈 화면에 추가</b> 선택</div>`;

        const overlay = document.createElement('div');
        overlay.id = 'install-guide-modal';
        overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px;`;
        overlay.innerHTML = `
            <div style="background:#1a1a1a;width:100%;max-width:360px;border-radius:24px;padding:32px 24px;color:#fff;border:1px solid #333;">
                <div style="font-size:22px;font-weight:700;margin-bottom:8px;">📲 홈 화면에 추가</div>
                <div style="font-size:14px;color:#aaa;margin-bottom:28px;">이 브라우저는 수동 설치가 필요합니다.</div>
                <div style="display:flex;flex-direction:column;gap:15px;margin-bottom:30px;">${guideHtml}</div>
                <button id="guide-close" style="width:100%;padding:18px;background:#fff;border:none;border-radius:16px;color:#000;font-size:17px;font-weight:800;">확인</button>
            </div>
        `;
        document.body.appendChild(overlay);
        overlay.querySelectorAll('.step').forEach(el => {
            el.style.cssText = `background:#262626;border-radius:14px;padding:16px 20px;font-size:15px;border-left:5px solid #FFEB3B;`;
        });
        document.getElementById('guide-close').onclick = () => overlay.remove();
    }

    function showInstallToast(msg) {
        const t = document.createElement('div');
        t.style.cssText = `position:fixed;bottom:110px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.9);color:#fff;padding:14px 28px;border-radius:30px;font-size:15px;z-index:10001;`;
        t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(() => { t.style.opacity='0'; t.style.transition='0.5s'; setTimeout(()=>t.remove(),500); }, 3000);
    }
})();