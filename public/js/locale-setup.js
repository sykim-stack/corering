// ============================================================
// BRAINPOOL | CoreRing
// locale-setup.js — 방언 설정 온보딩 모달
//
// 역할:
//   - 앱 첫 실행 시 (profiles.vi_locale === null) 자동 표시
//   - 아내가 출신 지역(북부/남부/중부) 선택
//   - Supabase profiles.vi_locale 업데이트
//   - 이후 engine.js의 resolveDialect()가 이 값을 우선 사용
//
// 로드 순서 (index.html):
//   dialect.js → conflict.js → logger.js → mindworld.js → engine.js → locale-setup.js
// ============================================================

(async function initLocaleSetup() {

    // ─── Supabase 설정 ────────────────────────────────────────
    // 환경변수 직접 사용 불가 → Vercel API 경유
    // profiles.vi_locale 조회 및 업데이트는 /api/locale.js 통해 처리
    const LOCALE_KEY = 'cr_vi_locale'; // localStorage 캐시 키

    // ─── 이미 설정된 경우 스킵 ───────────────────────────────
    const cached = localStorage.getItem(LOCALE_KEY);
    if (cached) {
        window.userLocale = cached; // engine.js의 userLocale 전역 변수에 반영
        return;
    }

    // ─── 서버에서 설정값 확인 ────────────────────────────────
    try {
        const res = await fetch('/api/locale');
        if (res.ok) {
            const data = await res.json();
            if (data.vi_locale) {
                localStorage.setItem(LOCALE_KEY, data.vi_locale);
                window.userLocale = data.vi_locale;
                return; // 이미 설정됨 → 모달 표시 안 함
            }
        }
    } catch (e) {
        // 비로그인 상태 또는 API 오류 → 모달 표시
        console.warn('[locale-setup] API 호출 실패, 모달 표시', e);
    }

    // ─── 온보딩 모달 표시 ────────────────────────────────────
    showLocaleModal();

    // ─── 모달 렌더 함수 ──────────────────────────────────────
    function showLocaleModal() {
        // 기존 모달 재사용 (index.html의 #modal-overlay)
        const overlay  = document.getElementById('modal-overlay');
        const body     = document.getElementById('modal-body');
        const closeBtn = document.getElementById('modal-close');

        body.innerHTML = `
            <div style="text-align:center; padding: 8px 0 24px;">

                <!-- 타이틀 -->
                <div style="
                    font-size: 11px; letter-spacing: 3px;
                    color: #555; text-transform: uppercase;
                    margin-bottom: 20px;
                ">CORERING · 처음 설정</div>

                <div style="
                    font-size: 1.5rem; font-weight: 800;
                    color: #fff; line-height: 1.4;
                    margin-bottom: 8px;
                    font-family: 'Be Vietnam Pro', sans-serif;
                ">어디 출신이에요?</div>

                <div style="
                    font-size: 0.9rem; color: #666;
                    margin-bottom: 32px; line-height: 1.6;
                ">
                    출신 지역에 맞게 번역해 드릴게요.<br>
                    나중에 바꿀 수 있어요.
                </div>

                <!-- 선택 버튼 3개 -->
                <div style="display:flex; flex-direction:column; gap:12px;">

                    <button class="locale-btn" data-locale="vi_north" style="
                        background: #111; border: 1px solid #2a2a2a;
                        border-radius: 16px; padding: 18px 20px;
                        color: #fff; font-size: 1rem; font-weight: 700;
                        cursor: pointer; text-align: left;
                        display: flex; align-items: center; gap: 16px;
                        transition: border-color 0.2s, background 0.2s;
                        font-family: 'Noto Sans KR', sans-serif;
                    ">
                        <span style="font-size:1.6rem;">🏙️</span>
                        <span>
                            <span style="display:block;">북부 (하노이)</span>
                            <span style="font-size:0.8rem; color:#555; font-weight:400;">Miền Bắc · Hà Nội</span>
                        </span>
                    </button>

                    <button class="locale-btn" data-locale="vi_south" style="
                        background: #111; border: 1px solid #2a2a2a;
                        border-radius: 16px; padding: 18px 20px;
                        color: #fff; font-size: 1rem; font-weight: 700;
                        cursor: pointer; text-align: left;
                        display: flex; align-items: center; gap: 16px;
                        transition: border-color 0.2s, background 0.2s;
                        font-family: 'Noto Sans KR', sans-serif;
                    ">
                        <span style="font-size:1.6rem;">🌴</span>
                        <span>
                            <span style="display:block;">남부 (호치민)</span>
                            <span style="font-size:0.8rem; color:#555; font-weight:400;">Miền Nam · TP.HCM</span>
                        </span>
                    </button>

                    <button class="locale-btn" data-locale="vi_neutral" style="
                        background: #111; border: 1px solid #2a2a2a;
                        border-radius: 16px; padding: 18px 20px;
                        color: #fff; font-size: 1rem; font-weight: 700;
                        cursor: pointer; text-align: left;
                        display: flex; align-items: center; gap: 16px;
                        transition: border-color 0.2s, background 0.2s;
                        font-family: 'Noto Sans KR', sans-serif;
                    ">
                        <span style="font-size:1.6rem;">🗺️</span>
                        <span>
                            <span style="display:block;">잘 모르겠어요</span>
                            <span style="font-size:0.8rem; color:#555; font-weight:400;">표준어로 번역</span>
                        </span>
                    </button>

                </div>
            </div>
        `;

        // 확인 버튼 숨김 (선택 시 자동 닫힘)
        closeBtn.style.display = 'none';

        // 버튼 호버 효과
        body.querySelectorAll('.locale-btn').forEach(btn => {
            btn.addEventListener('mouseenter', () => {
                btn.style.borderColor = '#D4AF37';
                btn.style.background  = '#141414';
            });
            btn.addEventListener('mouseleave', () => {
                if (!btn.classList.contains('selected')) {
                    btn.style.borderColor = '#2a2a2a';
                    btn.style.background  = '#111';
                }
            });

            // 선택 처리
            btn.addEventListener('click', async () => {
                const locale = btn.dataset.locale;
                await saveLocale(locale);
            });
        });

        overlay.style.display = 'flex';
    }

    // ─── 로케일 저장 ─────────────────────────────────────────
    async function saveLocale(locale) {
        const overlay  = document.getElementById('modal-overlay');
        const closeBtn = document.getElementById('modal-close');

        // 선택 피드백 (골드 테두리)
        document.querySelectorAll('.locale-btn').forEach(b => {
            b.style.borderColor = b.dataset.locale === locale ? '#D4AF37' : '#2a2a2a';
            b.style.opacity     = b.dataset.locale === locale ? '1' : '0.4';
        });

        try {
            // Vercel API 경유 저장
            await fetch('/api/locale', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ vi_locale: locale })
            });
        } catch (e) {
            console.warn('[locale-setup] 저장 실패, localStorage만 사용', e);
        }

        // localStorage 캐시 저장
        localStorage.setItem(LOCALE_KEY, locale);

        // engine.js 전역 변수 반영
        window.userLocale = locale;

        // 짧은 딜레이 후 닫기
        await new Promise(r => setTimeout(r, 350));
        overlay.style.display = 'none';

        // 확인 버튼 원상 복구
        closeBtn.style.display = '';

        // 토스트 메시지
        showToast(getLocaleName(locale) + ' 방언으로 설정됐어요 ✓');
    }

    // ─── 로케일 이름 변환 ────────────────────────────────────
    function getLocaleName(locale) {
        const names = {
            vi_north:   '북부 (하노이)',
            vi_south:   '남부 (호치민)',
            vi_neutral: '표준'
        };
        return names[locale] || locale;
    }

    // ─── 토스트 메시지 ───────────────────────────────────────
    function showToast(msg) {
        const existing = document.getElementById('cr-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.id = 'cr-toast';
        toast.innerText = msg;
        toast.style.cssText = `
            position: fixed; bottom: 100px; left: 50%;
            transform: translateX(-50%);
            background: #1a1a1a; color: #D4AF37;
            border: 1px solid #D4AF37;
            padding: 12px 20px; border-radius: 12px;
            font-size: 0.85rem; font-weight: 700;
            z-index: 9999; white-space: nowrap;
            animation: fadeInUp 0.3s ease;
            font-family: 'Noto Sans KR', sans-serif;
        `;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2500);
    }

})();