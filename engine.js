let CORE_DICTIONARY = [];
let CONFLICT_DICTIONARY = [];
const input = document.getElementById('userInput');
const header = document.getElementById('header');
const history = document.getElementById('chat-history');
const modal = document.getElementById('modal-overlay');
let msgCount = 0;

async function initEngine() {
    try {
        const res = await fetch('/api/get-sheet-dictionary');
        CORE_DICTIONARY = await res.json();

        const conflictRes = await fetch('/api/get-conflicts');
        CONFLICT_DICTIONARY = await conflictRes.json();
    } catch (e) {
        console.error("DB Load Failed");
        CORE_DICTIONARY = [];
        CONFLICT_DICTIONARY = [];
    }
}
initEngine();

function trackEvent(type, data) {
    const payload = { type, ...data };
    const session = JSON.parse(sessionStorage.getItem('core_session') || '[]');
    session.push(payload);
    sessionStorage.setItem('core_session', JSON.stringify(session));
    fetch('/api/corelink', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    }).catch(() => {});
}

input.addEventListener('input', () => {
    input.value.length > 0
        ? header.classList.add('glow-active')
        : header.classList.remove('glow-active');
});

async function handleSend() {
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    header.classList.remove('glow-active');

    const isKorean = /[ㄱ-ㅎ|가-힣]/.test(text);
    const tempId = Date.now();
    msgCount++;

    const isLeft = msgCount % 2 === 1;

    const pairDiv = document.createElement('div');
    pairDiv.className = isLeft ? 'msg-pair pair-left' : 'msg-pair pair-right';
    pairDiv.innerHTML = `
        <div class="box-top" id="t-${tempId}">
            <span class="loading-dots"><span>.</span><span>.</span><span>.</span></span>
        </div>
        <div class="box-bottom">${text}</div>`;

    history.appendChild(pairDiv);
    pairDiv.scrollIntoView({ behavior: 'smooth' });

    try {
        const target = isKorean ? 'VI' : 'KO';
        const res = await fetch(`/api/translate?text=${encodeURIComponent(text)}&target=${target}`);
        const data = await res.json();
        let standardResult = data.translations[0].text;
        let southernResult = standardResult;
        let isSouthern = false;

        // 충돌 단어 감지
        const conflictWords = CONFLICT_DICTIONARY.filter(item =>
            standardResult.includes(item.word)
        );

        if (conflictWords.length > 0) {
            document.getElementById(`t-${tempId}`).innerHTML =
                `${standardResult} <span class="conflict-badge">⚠️ 방언 주의</span>`;

            trackEvent('conflict_detected', {
                input: text,
                output: standardResult,
                conflicts: conflictWords.map(w => w.word),
                timestamp: Date.now()
            });

        } else {
            const idioms = CORE_DICTIONARY.filter(item => item.type === '숙어');
            const words = CORE_DICTIONARY.filter(item => item.type !== '숙어');

            idioms.forEach(item => {
                if (item.standard && southernResult.includes(item.standard)) {
                    southernResult = southernResult.replace(new RegExp(item.standard, 'gi'), item.southern);
                    isSouthern = true;
                }
            });
            words.forEach(item => {
                if (item.standard && southernResult.includes(item.standard)) {
                    southernResult = southernResult.replace(new RegExp(item.standard, 'gi'), item.southern);
                    isSouthern = true;
                }
            });

            document.getElementById(`t-${tempId}`).innerText = southernResult;

            trackEvent('translate', {
                input: text,
                output: southernResult,
                standard_vi: standardResult,
                southern_vi: isSouthern ? southernResult : null,
                is_southern: isSouthern,
                direction: isKorean ? 'KO→VI' : 'VI→KO',
                timestamp: Date.now()
            });
        }

        pairDiv.onclick = () => {
            trackEvent('card_click', { input: text, output: southernResult, timestamp: Date.now() });
            showModal(text, southernResult, isKorean);
        };

    } catch (e) {
        document.getElementById(`t-${tempId}`).innerText = "번역 오류";
        console.error(e);
    }
}

function showModal(original, translated, isKorean) {
    let chunkHtml = '';
    let matched = new Set();

    const idioms = CORE_DICTIONARY.filter(item => item.type === '숙어');
    idioms.forEach(item => {
        if (item.southern && translated.includes(item.southern) && !matched.has(item.southern)) {
            chunkHtml += `
                <div class="chunk-card">
                    <span class="chunk-v">${item.southern}</span>
                    <span class="chunk-k">${item.meaning || ''}</span>
                </div>`;
            matched.add(item.southern);
        }
    });

    const words = CORE_DICTIONARY.filter(item => item.type !== '숙어');
    words.forEach(item => {
        if (item.southern && translated.includes(item.southern) && !matched.has(item.southern)) {
            chunkHtml += `
                <div class="chunk-card">
                    <span class="chunk-v">${item.southern}</span>
                    <span class="chunk-k">${item.meaning || item.standard || ''}</span>
                </div>`;
            matched.add(item.southern);
        }
    });

    if (!chunkHtml) {
        const splitWords = translated.split(/\s+/).filter(w => w.length > 1);
        const origWords = original.split(/\s+/).filter(w => w.length > 0);
        splitWords.forEach((word, i) => {
            const meaning = origWords[i] || '';
            chunkHtml += `
                <div class="chunk-card">
                    <span class="chunk-v">${word}</span>
                    <span class="chunk-k ${meaning ? '' : 'chunk-empty'}">${meaning || '—'}</span>
                </div>`;
        });
    }

    // 충돌 단어 경고 카드
    const conflictWords = CONFLICT_DICTIONARY.filter(item =>
        translated.includes(item.word)
    );
    if (conflictWords.length > 0) {
        conflictWords.forEach(item => {
            chunkHtml += `
                <div class="chunk-card conflict-card">
                    <span class="chunk-v">⚠️ ${item.word}</span>
                    <span class="chunk-k">북부: ${item.meaning_northern} / 남부: ${item.meaning_southern}</span>
                </div>`;
        });
    }

    trackEvent('modal_open', { original, translated, timestamp: Date.now() });

    document.getElementById('modal-body').innerHTML = `
        <div class="modal-header-text">
            <div class="modal-translated">${translated}</div>
            <div class="modal-original">${original}</div>
        </div>
        <div class="modal-divider"></div>
        <div class="chunk-grid">${chunkHtml}</div>`;
    modal.style.display = 'flex';
}

document.addEventListener('click', (e) => {
    const card = e.target.closest('.chunk-card');
    if (card) {
        trackEvent('word_click', {
            word: card.querySelector('.chunk-v')?.innerText,
            meaning: card.querySelector('.chunk-k')?.innerText,
            timestamp: Date.now()
        });
    }
});

document.getElementById('send-btn').onclick = handleSend;
input.onkeypress = (e) => { if (e.key === 'Enter') handleSend(); };
document.getElementById('modal-close').onclick = () => modal.style.display = 'none';
modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });