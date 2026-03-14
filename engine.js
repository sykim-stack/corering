// ============================================================
// BRAINPOOL | CoreRing Engine v3.7
// RING 모드: DeepL 번역 + 단어 카드
// CHAT 모드: C안 - 전송만, 번역 버튼 방식
//
// v3.7 수정사항:
//   - CHAT 모드 + 방 연결 시 자동번역 OFF
//   - sendChatOnly() — 원문 전송 + 번역 버튼 카드
//   - buildChatCard() — 채팅 카드 HTML 생성
//   - translateChatMsg() — 번역 버튼 클릭 시 DeepL 호출
//   - appendChatToHistory() — 상대방 메시지 수신 표시
//   - switchToChatMode() / switchToRingMode() — 헤더 전환
// ============================================================

let CORE_DICTIONARY     = [];
let CONFLICT_DICTIONARY = [];
let firstLang           = null;
let userLocale          = null;
let engineInitialized   = false;
let currentMode         = localStorage.getItem('core_mode') || 'RING';

// ─── Dictionary 인덱스 ────────────────────────────────────────
let DICT_MAP          = new Map();
let DICT_MEANING_MAP  = new Map();
let MAX_PHRASE_LENGTH = 1;

const SESSION_ID  = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
const input       = document.getElementById('userInput');
const header      = document.getElementById('header');
const history     = document.getElementById('chat-history');
const modal       = document.getElementById('modal-overlay');
let msgCount      = 0;
let sessionLogs   = [];

// ─── 날짜별 localStorage 키 ───────────────────────────────────
function getTodayKey() {
    const d    = new Date();
    const yyyy = d.getFullYear();
    const mm   = String(d.getMonth() + 1).padStart(2, '0');
    const dd   = String(d.getDate()).padStart(2, '0');
    return `chat_log_${yyyy}-${mm}-${dd}`;
}

// ─── 대화 저장 ────────────────────────────────────────────────
function saveChatLog(entry) {
    const key  = getTodayKey();
    const logs = JSON.parse(localStorage.getItem(key) || '[]');
    logs.push(entry);
    localStorage.setItem(key, JSON.stringify(logs));
}

// ─── 오늘 대화 불러오기 ───────────────────────────────────────
function loadTodayChat() {
    const key  = getTodayKey();
    const logs = JSON.parse(localStorage.getItem(key) || '[]');
    return logs;
}

// ─── 오늘 대화 삭제 ───────────────────────────────────────────
function clearTodayChat() {
    if (!confirm('오늘 대화를 삭제할까요?')) return;
    localStorage.removeItem(getTodayKey());
    history.innerHTML = '';
    msgCount    = 0;
    firstLang   = null;
    sessionLogs = [];
    showWelcomeScreen();
}

// ─── 저장된 대화 복원 ─────────────────────────────────────────
function restoreChat(logs) {
    if (!logs || logs.length === 0) return;
    const wc = document.getElementById('welcome-card');
    if (wc) wc.remove();

    logs.forEach(entry => {
        msgCount++;
        if (msgCount === 1) firstLang = entry.firstLang;

        const isLeft  = entry.isLeft;
        const pairDiv = document.createElement('div');
        pairDiv.className = isLeft ? 'msg-pair pair-left' : 'msg-pair pair-right';
        pairDiv.innerHTML = `
            <div class="box-top">${entry.topHtml}</div>
            <div class="box-bottom">${entry.original}</div>`;
        history.appendChild(pairDiv);

        const snap = entry;
        pairDiv.onclick = () => {
            trackEvent('card_click', { input: snap.original, output: snap.translated, timestamp: Date.now() });
            showModal(snap.original, snap.translated, snap.isKorean, snap.checkText);
        };
    });

    history.scrollTop = history.scrollHeight;
}

// ─── 감정 점수 ────────────────────────────────────────────────
function calcEmotionScore(text) {
    let score = 0;
    const negativeWords = ['왜', '짜증', '싫어', '됐어', '몰라', '하지마', '그만'];
    const positiveWords  = ['고마워', '사랑해', '괜찮아', '미안해'];
    negativeWords.forEach(w => { if (text.includes(w)) score += 2; });
    positiveWords.forEach(w  => { if (text.includes(w)) score -= 1; });
    if (text.length < 5)                              score += 1;
    if (text.includes('!') || text.includes('?'))     score += 1;
    return Math.max(0, score);
}

// ─── Dictionary Map 인덱싱 ────────────────────────────────────
function buildDictionaryIndex() {
    DICT_MAP.clear();
    DICT_MEANING_MAP.clear();

    const clean = (str) =>
        str?.toLowerCase().replace(/[.,!?]/g, '').trim();

    CORE_DICTIONARY.forEach(d => {
        const standard = clean(d.standard || d.standard_word);
        const southern = clean(d.southern || d.southern_word);
        const meaning  = clean(d.meaning  || d.meaning_ko);

        if (standard) DICT_MAP.set(standard, d);
        if (southern) DICT_MAP.set(southern, d);
        if (meaning)  DICT_MEANING_MAP.set(meaning, d);
    });

    MAX_PHRASE_LENGTH = 1;
    DICT_MAP.forEach((_, key) => {
        const length = key.split(' ').length;
        if (length > MAX_PHRASE_LENGTH) MAX_PHRASE_LENGTH = length;
    });

    console.log('[CoreRing] Dict indexed:', DICT_MAP.size, '| Max phrase length:', MAX_PHRASE_LENGTH);
}

// ─── 엔진 초기화 ──────────────────────────────────────────────
async function initEngine() {
    if (engineInitialized) return;
    engineInitialized = true;
    try {
        const res             = await fetch('/api/corering?action=get-dictionary');
        CORE_DICTIONARY       = await res.json();
        const conflictRes     = await fetch('/api/corering?action=get-conflicts');
        CONFLICT_DICTIONARY   = await conflictRes.json();
        buildDictionaryIndex();
    } catch (e) {
        console.error('DB Load Failed:', e);
        engineInitialized   = false;
        CORE_DICTIONARY     = [];
        CONFLICT_DICTIONARY = [];
    }
}

// ─── 웰컴 화면 ───────────────────────────────────────────────
const WELCOME_PHRASES = [
    { vi: 'Anh yêu em.',           ko: '나는 당신을 사랑해요.' },
    { vi: 'Cảm ơn em rất nhiều.',  ko: '정말 고마워요.' },
    { vi: 'Em có khỏe không?',     ko: '잘 지내고 있어요?' },
    { vi: 'Chúc em ngủ ngon.',     ko: '잘 자요.' },
    { vi: 'Em đẹp lắm.',           ko: '당신은 정말 예뻐요.' },
];

function renderWelcomeCard(vi, ko) {
    const historyEl = document.getElementById('chat-history');
    const date = new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });

    let card = document.getElementById('welcome-card');
    if (!card) {
        card = document.createElement('div');
        card.id = 'welcome-card';
        card.style.cssText = `
            display: flex; flex-direction: column;
            align-items: center; justify-content: center;
            min-height: 60vh; padding: 40px 24px;
            text-align: center; animation: fadeInUp 0.6s ease;
        `;
        historyEl.appendChild(card);
    }

    const modeTag = currentMode === 'CHAT'
        ? `<div style="margin-bottom:12px; font-size:10px; letter-spacing:2px; color:#f0b429;">● CHAT MODE</div>`
        : '';

    card.innerHTML = `
        ${modeTag}
        <div style="font-size:11px; letter-spacing:3px; color:#444; margin-bottom:32px; text-transform:uppercase;">
            ${date} · 오늘의 문장
        </div>
        <div style="
            background: rgba(255,255,255,0.04);
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 20px; padding: 32px 28px;
            max-width: 320px; width: 100%;
        ">
            <div style="font-size:19px; font-weight:600; color:#ffffff; line-height:1.5; margin-bottom:16px;">
                ${vi}
            </div>
            <div style="width:32px; height:1px; background:rgba(255,255,255,0.15); margin:0 auto 16px;"></div>
            <div style="font-size:14px; color:#888; line-height:1.6;">
                ${ko}
            </div>
        </div>
        <div style="margin-top:28px; font-size:12px; color:#333; letter-spacing:1px;">
            한국어 또는 베트남어를 입력하세요
        </div>
    `;
}

function showWelcomeScreen() {
    const historyEl = document.getElementById('chat-history');

    historyEl.style.cssText += `
        background-image: repeating-linear-gradient(
            45deg, rgba(255,255,255,0.012) 0px,
            rgba(255,255,255,0.012) 1px, transparent 1px, transparent 40px
        ), repeating-linear-gradient(
            -45deg, rgba(255,255,255,0.012) 0px,
            rgba(255,255,255,0.012) 1px, transparent 1px, transparent 40px
        );
    `;

    const preset = WELCOME_PHRASES[Math.floor(Math.random() * WELCOME_PHRASES.length)];
    renderWelcomeCard(preset.vi, preset.ko);

    initEngine().then(() => {
        const savedLogs = loadTodayChat();
        if (savedLogs.length > 0) {
            const wc = document.getElementById('welcome-card');
            if (wc) wc.remove();
            restoreChat(savedLogs);
            return;
        }

        const phrases = CORE_DICTIONARY.filter(d =>
            d.entry_type === 'phrase' || (d.standard?.split(' ').length > 1)
        );
        const pool = phrases.length > 0 ? phrases : CORE_DICTIONARY;
        const item = pool[Math.floor(Math.random() * pool.length)];
        if (!item) return;
        const vi = item.standard || item.standard_word || '';
        const ko = item.meaning  || item.meaning_ko    || '';
        if (vi && ko) renderWelcomeCard(vi, ko);
    });
}

showWelcomeScreen();

// ─── 모드 전환 ────────────────────────────────────────────────
function toggleMode() {
    currentMode = currentMode === 'RING' ? 'CHAT' : 'RING';
    localStorage.setItem('core_mode', currentMode);

    const label = document.getElementById('mode-label');
    if (label) label.textContent = currentMode;

    input.placeholder = currentMode === 'RING'
        ? '심장을 분석합니다...'
        : '대화를 입력하세요...';

    const preset = WELCOME_PHRASES[Math.floor(Math.random() * WELCOME_PHRASES.length)];
    const wc = document.getElementById('welcome-card');
    if (wc) renderWelcomeCard(preset.vi, preset.ko);

    showModeToast(currentMode);
}

function showModeToast(mode) {
    const existing = document.getElementById('mode-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'mode-toast';
    toast.style.cssText = `
        position: fixed; top: 70px; left: 50%;
        transform: translateX(-50%);
        background: rgba(20,20,20,0.95);
        border: 1px solid rgba(255,255,255,0.1);
        padding: 8px 20px; border-radius: 20px;
        font-size: 11px; letter-spacing: 2px;
        color: ${mode === 'CHAT' ? '#f0b429' : '#aaa'};
        z-index: 999; transition: opacity 0.4s;
    `;
    toast.textContent = mode === 'CHAT'
        ? '● CHAT MODE — 채팅 연결됨'
        : '● RING MODE — 단어 분석';
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; }, 2000);
    setTimeout(() => toast.remove(), 2400);
}

// ─── CHAT 모드 전환 (방 연결 시) ────────────────────────────
function switchToChatMode(room) {
    currentMode = 'CHAT';
    localStorage.setItem('core_mode', 'CHAT');

    // 로고 변경
    const logoRing = document.querySelector('.logo-ring');
    if (logoRing) logoRing.textContent = 'CHAT';

    // ROOM 버튼 → 방번호 + 나가기 버튼으로 교체
    const roomToggle = document.getElementById('room-toggle');
    if (roomToggle) {
        roomToggle.outerHTML = `
            <div id="chat-header-controls" style="display:flex; align-items:center; gap:8px;">
                <button id="room-code-btn" onclick="toggleRooms()" style="
                    background:none; border:1px solid #2a4a2a;
                    color:#6aba6a; padding:4px 14px; border-radius:20px;
                    font-size:10px; letter-spacing:2px; font-family:monospace; cursor:pointer;
                ">● ${room.invite_code}</button>
                <button id="exit-chat-btn" onclick="exitChatMode()" style="
                    background:none; border:1px solid rgba(255,255,255,0.1);
                    color:#777; padding:4px 12px; border-radius:20px;
                    font-size:10px; letter-spacing:1px; font-family:monospace; cursor:pointer;
                ">나가기</button>
            </div>
        `;
    }

    input.placeholder = '메시지 입력...';
    showModeToast('CHAT');
}

// ─── RING 모드 복귀 ──────────────────────────────────────────
function switchToRingMode() {
    currentMode = 'RING';
    localStorage.setItem('core_mode', 'RING');

    // 로고 복귀
    const logoRing = document.querySelector('.logo-ring');
    if (logoRing) logoRing.textContent = 'RING';

    // 헤더 컨트롤 → ROOM 버튼으로 복귀
    const chatControls = document.getElementById('chat-header-controls');
    if (chatControls) {
        chatControls.outerHTML = `
            <button id="room-toggle" style="
                background:none; border:1px solid rgba(255,255,255,0.12);
                cursor:pointer; color:currentColor; padding:4px 14px;
                border-radius:20px; font-size:10px; letter-spacing:2px; font-family:monospace;
            ">ROOM</button>
        `;
        // 이벤트 재등록
        const newToggle = document.getElementById('room-toggle');
        if (newToggle) newToggle.addEventListener('click', toggleRooms);
    }

    input.placeholder = '심장을 분석합니다...';
    showModeToast('RING');
}

// ─── 세션 이벤트 트래킹 ───────────────────────────────────────
function trackEvent(type, data) {
    const payload = { type, ...data };
    const session = JSON.parse(sessionStorage.getItem('core_session') || '[]');
    session.push(payload);
    sessionStorage.setItem('core_session', JSON.stringify(session));
}

// ─── 입력 헤더 글로우 ─────────────────────────────────────────
input.addEventListener('input', () => {
    input.value.length > 0
        ? header.classList.add('glow-active')
        : header.classList.remove('glow-active');
});

// ─── 의도 배지 생성 헬퍼 ─────────────────────────────────────
function buildIntentBadge(intent) {
    if (intent === 'THREAT') {
        return ' <span class="conflict-badge risk-badge">⚡ 강한 불만</span>';
    }
    if (intent === 'COMPLAINT') {
        return ' <span class="conflict-badge risk-badge risk-medium">💬 불만 감지</span>';
    }
    if (intent === 'AFFECTION') {
        return ' <span class="conflict-badge affection-badge">💙 애정 표현</span>';
    }
    return '';
}

// ─── 채팅 카드 HTML 생성 ─────────────────────────────────────
function buildChatCard(text, isKorean, msgId, isMe) {
    const btnId    = 'translate-btn-' + (msgId || Date.now());
    const resultId = 'translate-result-' + (msgId || Date.now());
    return `
        <div style="font-size:14px; line-height:1.6;">${text}</div>
        <div id="${resultId}" style="
            font-size:12px; color:#888; margin-top:6px;
            border-top:1px solid #2a2a3a; padding-top:6px;
            display:none;
        "></div>
        <button id="${btnId}" onclick="translateChatMsg('${btnId}', '${resultId}', ${isKorean})" style="
            margin-top:8px; background:none;
            border:1px solid ${isMe ? '#2a4a2a' : '#2a2a4a'};
            color:${isMe ? '#4a8a4a' : '#6a6aaa'};
            padding:3px 10px; border-radius:10px;
            font-size:10px; letter-spacing:1px; cursor:pointer; font-family:monospace;
        ">번역</button>
    `;
}

// ─── 채팅 메시지 번역 (버튼 클릭 시) ────────────────────────
async function translateChatMsg(btnId, resultId, isKorean) {
    const btn      = document.getElementById(btnId);
    const resultEl = document.getElementById(resultId);
    if (!btn || !resultEl) return;

    // 원문 찾기 — 버튼의 부모 box-top 안 첫 번째 div
    const boxTop = btn.closest('.box-top');
    const textEl = boxTop?.querySelector('div');
    const text   = textEl?.innerText?.trim();
    if (!text) return;

    btn.textContent = '...';
    btn.disabled    = true;

    try {
        const target = isKorean ? 'VI' : 'KO';
        const res    = await fetch(`/api/corering?action=translate&text=${encodeURIComponent(text)}&target=${target}`);
        const data   = await res.json();
        const translated = data.translations?.[0]?.text;

        if (translated) {
            resultEl.textContent  = translated;
            resultEl.style.display = 'block';
            btn.style.display      = 'none';
        }
    } catch(e) {
        btn.textContent = '번역';
        btn.disabled    = false;
    }
}

// ─── C안: 전송만, 자동번역 없음 ──────────────────────────────
async function sendChatOnly(text, isKorean, isLeft, tempId, pairDiv) {
    const room = (typeof currentRoom !== 'undefined') ? currentRoom : null
    if (!room) return

    try {
        const res = await fetch("/api/corechat?action=send-message", {
            method: "POST",
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                room_id:   room.id,
                nickname:  room.nickname,
                device_id: DEVICE_ID,
                message:   text,
            })
        })
        const data  = await res.json();
        const msgId = data?.[0]?.id || null;
        if (msgId && typeof sentMsgIds !== 'undefined') sentMsgIds.add(msgId);

        // chat-history에 내 메시지 카드 표시
        document.getElementById(`t-${tempId}`).innerHTML = buildChatCard(text, isKorean, msgId, true);
        pairDiv.className = isLeft ? 'msg-pair pair-left' : 'msg-pair pair-right';

    } catch(e) {
        document.getElementById(`t-${tempId}`).innerText = '전송 실패';
        console.error('[sendChatOnly]', e);
    }
}

// ─── 상대방 메시지 chat-history에 추가 ──────────────────────
function appendChatToHistory(msg) {
    if (!history) return;

    // 중복 방지
    if (msg.id && history.querySelector(`[data-msg-id="${msg.id}"]`)) return;

    const isKorean = /[ㄱ-ㅎ|가-힣]/.test(msg.message);

    if (msgCount === 0) {
        firstLang = isKorean ? 'ko' : 'vi';
        const wc = document.getElementById('welcome-card');
        if (wc) wc.remove();
    }
    msgCount++;

    const isLeft  = firstLang === 'ko' ? isKorean : !isKorean;

    const pairDiv = document.createElement('div');
    pairDiv.className = isLeft ? 'msg-pair pair-left' : 'msg-pair pair-right';
    if (msg.id) pairDiv.dataset.msgId = msg.id;

    pairDiv.innerHTML = `
    <div class="box-top">${buildChatCard(msg.message, isKorean, msg.id, false)}</div>
    <div class="box-bottom" style="font-size:11px; color:#6a6aaa; margin-top:4px;">
        💬 ${msg.nickname || '상대방'}
    </div>
    `;
    history.appendChild(pairDiv);
    history.scrollTop = history.scrollHeight;
}

// ─── CHAT 모드 처리 (방 미연결 시 Gemini 자동번역) ──────────
async function handleChatMode(text, mw, tempId, pairDiv, isKorean, isLeft) {
    try {
        const res = await fetch('/api/corechat?action=chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text,
                history:  sessionLogs.slice(-5),
                softTone: mw.softTone,
                role:     mw.role,
                dialect:  userLocale || 'vi_south',
            }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '번역 오류');

        const translated = data.translated;
        const checkText  = isKorean ? translated : text;
        const conflicts  = detectConflicts(checkText, CONFLICT_DICTIONARY);
        const mwFinal    = runMindWorld({ rawScore: calcEmotionScore(text), inputText: text, sessionLogs, conflicts });

        let topHtml = translated;

        if (conflicts.length > 0) {
            const hasHigh = conflicts.some(c => c.severity === 'high');
            topHtml += hasHigh
                ? ' <span class="conflict-badge">🔴 방언 주의</span>'
                : ' <span class="conflict-badge">⚠️ 방언 주의</span>';
        }
        if (mwFinal.level === 'HIGH') {
            topHtml += ' <span class="conflict-badge risk-badge">🔴 갈등 감지</span>';
        } else if (mwFinal.level === 'MEDIUM') {
            topHtml += ' <span class="conflict-badge risk-badge risk-medium">🟡 주의</span>';
        }
        if (data.softTone) {
            topHtml += ' <span class="conflict-badge" style="background:rgba(240,180,41,0.15);color:#f0b429;">💛 순화됨</span>';
        }
        topHtml += buildIntentBadge(mwFinal.intent);

        document.getElementById(`t-${tempId}`).innerHTML = topHtml;

        try { await navigator.clipboard.writeText(translated); } catch {}

        saveChatLog({
            original:   text,
            translated,
            topHtml,
            isKorean,
            isLeft,
            checkText,
            firstLang,
            mode:       'CHAT',
            timestamp:  Date.now(),
        });

        sessionLogs.push({ input: text, output: translated, rawScore: calcEmotionScore(text), timestamp: Date.now() });

        fetch('/api/corechat?action=log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                source_locale:     isKorean ? 'ko' : 'vi',
                target_locale:     isKorean ? 'vi' : 'ko',
                input_text:        text,
                output_text:       translated,
                engine_used:       'gemini',
                emotion_score:     mwFinal?.rrp ?? null,
                conflict_detected: conflicts.length > 0,
                intent:            mwFinal.intent,
                intent_conf:       mwFinal.confidence,
            }),
        }).catch(() => {});

        pairDiv.onclick = () => showModal(text, translated, isKorean, checkText);

    } catch (e) {
        document.getElementById(`t-${tempId}`).innerText = '번역 오류';
        console.error('[CoreChat]', e);
    }
}

// ─── 메인 번역 처리 ───────────────────────────────────────────
async function handleSend() {
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    header.classList.remove('glow-active');

    const isKorean = /[ㄱ-ㅎ|가-힣]/.test(text);
    const tempId   = Date.now();
    msgCount++;

    if (msgCount === 1) {
        firstLang = isKorean ? 'ko' : 'vi';
        const wc = document.getElementById('welcome-card');
        if (wc) wc.remove();
    }
    const isLeft = firstLang === 'ko' ? isKorean : !isKorean;

    const pairDiv = document.createElement('div');
    pairDiv.className = isLeft ? 'msg-pair pair-left' : 'msg-pair pair-right';
    pairDiv.innerHTML = `
        <div class="box-top" id="t-${tempId}">
            <span class="loading-dots"><span>.</span><span>.</span><span>.</span></span>
        </div>
        <div class="box-bottom" style="font-size:11px; color:#6aba6a; margin-top:4px;">
    👤 ${getNickname() || '나'}
</div>`;
    history.appendChild(pairDiv);
    pairDiv.scrollIntoView({ behavior: 'smooth' });

    const rawScore = calcEmotionScore(text);

// ── 모드 분기 ──
if (currentMode === 'CHAT') {
    // currentRoom을 직접 참조 (rooms.js 전역변수)
    const room = (typeof currentRoom !== 'undefined') ? currentRoom : null
    if (room && room.id) {
        // C안: 방 연결 상태 → 전송만
        await sendChatOnly(text, isKorean, isLeft, tempId, pairDiv)
    } else {
        // 방 미연결 → Gemini 자동번역
        const mw = runMindWorld({ rawScore, inputText: text, sessionLogs, conflicts: [] })
        await handleChatMode(text, mw, tempId, pairDiv, isKorean, isLeft)
    }
    return
}

    // ── RING 모드 (DeepL) ──
    try {
        const target         = isKorean ? 'VI' : 'KO';
        const res            = await fetch(`/api/corering?action=translate&text=${encodeURIComponent(text)}&target=${target}`);
        const data           = await res.json();
        const rawTranslation = data.translations[0].text;

        if (typeof sendTranslationToRoom === 'function') {
            sendTranslationToRoom(text, rawTranslation, isKorean ? 'KO→VI' : 'VI→KO');
        }

        const checkText       = isKorean ? rawTranslation : text;
        const detectedDialect = detectDialectScore(checkText);
        const finalDialect    = resolveDialect({ detectedDialect, userLocale });
        const conflicts       = detectConflicts(checkText, CONFLICT_DICTIONARY);
        const mw              = runMindWorld({ rawScore, inputText: text, sessionLogs, conflicts });

        const sessionLog = { input: text, output: rawTranslation, rawScore, timestamp: Date.now() };
        sessionLogs.push(sessionLog);

        let topHtml = rawTranslation;

        if (conflicts.length > 0) {
            const hasHigh = conflicts.some(c => c.severity === 'high');
            topHtml += hasHigh
                ? ' <span class="conflict-badge">🔴 방언 주의</span>'
                : ' <span class="conflict-badge">⚠️ 방언 주의</span>';
        }
        if (mw.level === 'HIGH') {
            topHtml += ' <span class="conflict-badge risk-badge">🔴 갈등 감지</span>';
        } else if (mw.level === 'MEDIUM') {
            topHtml += ' <span class="conflict-badge risk-badge risk-medium">🟡 주의</span>';
        }
        topHtml += buildIntentBadge(mw.intent);

        document.getElementById(`t-${tempId}`).innerHTML = topHtml;

        try {
            await navigator.clipboard.writeText(rawTranslation);
        } catch {
            try {
                const ta = document.createElement('textarea');
                ta.value = rawTranslation;
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
            } catch {}
        }

        saveChatLog({
            original:   text,
            translated: rawTranslation,
            topHtml,
            isKorean,
            isLeft,
            checkText,
            firstLang,
            mode:      'RING',
            timestamp: Date.now(),
        });

        autoSaveToDataset({ inputText: text, outputText: rawTranslation, isKorean });

        await saveTranslationLog({
            inputText:      text,
            outputText:     rawTranslation,
            direction:      isKorean ? 'KO→VI' : 'VI→KO',
            detectedDialect,
            finalDialect,
            emotionScore:   mw.rrp,
            sessionId:      SESSION_ID,
            conflictCount:  conflicts.length,
            intent:         mw.intent,
            intentConf:     mw.confidence,
        });

        trackEvent('translate', {
            input:        text,
            output:       rawTranslation,
            dialect:      finalDialect,
            emotionScore: rawScore,
            rrp:          mw.rrp,
            intentState:  mw.intentState,
            intent:       mw.intent,
            mode:         'RING',
            timestamp:    Date.now(),
        });

        pairDiv.onclick = () => {
            trackEvent('card_click', { input: text, output: rawTranslation, timestamp: Date.now() });
            showModal(text, rawTranslation, isKorean, checkText);
        };

    } catch (e) {
        document.getElementById(`t-${tempId}`).innerText = '번역 오류';
        console.error(e);
    }
}

// ─── 베트남어 Dynamic Longest-Match 토크나이저 ────────────────
function tokenizeVietnamese(text) {
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const tokens = [];
    const clean = (str) => str.replace(/[.,!?]/g, '').toLowerCase();

    let i = 0;
    while (i < words.length) {
        let matched = false;
        const maxTry = Math.min(MAX_PHRASE_LENGTH, words.length - i);

        for (let size = maxTry; size > 0; size--) {
            const slice = words.slice(i, i + size).map(w => clean(w)).join(' ');
            if (DICT_MAP.has(slice)) {
                tokens.push(words.slice(i, i + size).join(' '));
                i += size;
                matched = true;
                break;
            }
        }

        if (!matched) { tokens.push(words[i]); i++; }
    }
    return tokens;
}

// ─── 단어 카드 모달 ───────────────────────────────────────────
function showModal(original, translated, isKorean, cardText) {
    let chunkHtml = '';
    const words   = tokenizeVietnamese(cardText);

    const sentenceCard = `
        <div class="chunk-card sentence-unit">
            <div class="chunk-header">
                <span class="chunk-v">${translated}</span>
            </div>
            <span class="chunk-k">${original}</span>
        </div>
    `;

    words.forEach(word => {
        const cleanWord = word.replace(/[.,!?]/g, '');
        if (!cleanWord) return;

        const clean = cleanWord.toLowerCase();
        const found = DICT_MAP.get(clean) || DICT_MEANING_MAP.get(clean);
        if (!found) return;
        if (found.entry_type === 'auxiliary') return;

        const standard       = found.standard || found.standard_word || cleanWord;
        const southern       = found.southern || found.southern_word || cleanWord;
        const hasDialectDiff = standard.toLowerCase() !== southern.toLowerCase();

        let typeClass = '';
        if (found.entry_type === 'phrase') typeClass = 'type-phrase';

        chunkHtml += `
            <div class="chunk-card ${typeClass} ${hasDialectDiff ? 'dialect-card' : ''}">
                <div class="chunk-header">
                    <span class="chunk-v">${cleanWord}</span>
                </div>
                <span class="chunk-north">북부: ${standard}</span>
                <span class="chunk-south ${hasDialectDiff ? 'dialect-diff' : ''}">
                    남부: ${southern}
                </span>
                <span class="chunk-k">${found.meaning || found.meaning_ko || '—'}</span>
            </div>
        `;
    });

    detectConflicts(cardText, CONFLICT_DICTIONARY)
        .forEach(item => {
            const severityIcon = item.severity === 'high' ? '🔴' : '⚠️';
            chunkHtml += `
                <div class="chunk-card conflict-card">
                    <span class="chunk-v">${severityIcon} ${item.word}</span>
                    <span class="chunk-north">북부: ${item.meaning_northern}</span>
                    <span class="chunk-south dialect-diff">남부: ${item.meaning_southern}</span>
                    ${item.note ? `<span class="chunk-k">${item.note}</span>` : ''}
                </div>`;
        });

    trackEvent('modal_open', { original, translated, timestamp: Date.now() });

    document.getElementById('modal-body').innerHTML = `
        <div class="modal-sentence-area">${sentenceCard}</div>
        <div class="modal-divider"></div>
        <div class="chunk-grid">${chunkHtml}</div>
    `;
    modal.style.display = 'flex';
}

// ─── 이벤트 핸들러 ────────────────────────────────────────────
const clearBtn   = document.getElementById('clear-btn');
const sendBtn    = document.getElementById('send-btn');
const modalClose = document.getElementById('modal-close');
const modeToggle = document.getElementById('mode-toggle');

if (clearBtn)   clearBtn.onclick   = clearTodayChat;
if (modeToggle) modeToggle.onclick = toggleMode;
if (sendBtn)    sendBtn.onclick    = handleSend;
if (modalClose) modalClose.onclick = () => modal.style.display = 'none';

input.onkeypress = (e) => { if (e.key === 'Enter') handleSend(); };
modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });

document.addEventListener('click', (e) => {
    const card = e.target.closest('.chunk-card');
    if (card) {
        trackEvent('word_click', {
            word:      card.querySelector('.chunk-v')?.innerText,
            meaning:   card.querySelector('.chunk-k')?.innerText,
            timestamp: Date.now()
        });
    }
});