import { detectDialectScore, resolveDialect } from './dialect.js';
import { detectConflicts } from './conflict.js';
import { saveTranslationLog } from './logger.js';

let CORE_DICTIONARY = [];
let CONFLICT_DICTIONARY = [];
let firstLang = null;
let userLocale = null; // profiles.vi_locale (로그인 시 설정)

const SESSION_ID = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
const input = document.getElementById('userInput');
const header = document.getElementById('header');
const history = document.getElementById('chat-history');
const modal = document.getElementById('modal-overlay');
let msgCount = 0;

export function calcEmotionScore(text) {
    let score = 0;
    const negativeWords = ['왜', '짜증', '싫어', '됐어', '몰라', '하지마', '그만'];
    const positiveWords = ['고마워', '사랑해', '괜찮아', '미안해'];
    negativeWords.forEach(w => { if (text.includes(w)) score += 2; });
    positiveWords.forEach(w => { if (text.includes(w)) score -= 1; });
    if (text.length < 5) score += 1;
    if (text.includes('!') || text.includes('?')) score += 1;
    return Math.max(0, score);
}

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

    if (msgCount === 1) firstLang = isKorean ? 'ko' : 'vi';
    const isLeft = firstLang === 'ko' ? isKorean : !isKorean;

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
        const rawTranslation = data.translations[0].text;

        // ① 방언 감지
        const checkText = isKorean ? rawTranslation : text;
        const detectedDialect = detectDialectScore(checkText);

        // ② 방언 결정
        const finalDialect = resolveDialect({ detectedDialect, userLocale });

        // ③ 충돌 감지
        const conflicts = detectConflicts(checkText, CONFLICT_DICTIONARY);

        // ④ 감정 점수
        const emotionScore = calcEmotionScore(text);

        // ⑤ UI 출력
        if (conflicts.length > 0) {
            document.getElementById(`t-${tempId}`).innerHTML =
                `${rawTranslation} <span class="conflict-badge">⚠️ 방언 주의</span>`;
        } else {
            document.getElementById(`t-${tempId}`).innerText = rawTranslation;
        }

        // ⑥ 로그 저장
        await saveTranslationLog({
            inputText: text,
            outputText: rawTranslation,
            direction: isKorean ? 'KO→VI' : 'VI→KO',
            detectedDialect,
            finalDialect,
            emotionScore,
            sessionId: SESSION_ID,
            conflictCount: conflicts.length
        });

        trackEvent('translate', {
            input: text,
            output: rawTranslation,
            dialect: finalDialect,
            emotionScore,
            timestamp: Date.now()
        });

        pairDiv.onclick = () => {
            trackEvent('card_click', { input: text, output: rawTranslation, timestamp: Date.now() });
            const cardText = isKorean ? rawTranslation : text;
            showModal(text, rawTranslation, isKorean, cardText);
        };

    } catch (e) {
        document.getElementById(`t-${tempId}`).innerText = "번역 오류";
        console.error(e);
    }
}

function showModal(original, translated, isKorean, cardText) {
    let chunkHtml = '';

    const words = cardText.split(/\s+/).filter(w => w.length > 0);

    words.forEach(word => {
        const cleanWord = word.replace(/[.,!?]/g, '');
        if (!cleanWord) return;

        const found = CORE_DICTIONARY.find(d =>
            d.standard?.toLowerCase() === cleanWord.toLowerCase() ||
            d.southern?.toLowerCase() === cleanWord.toLowerCase()
        );

        const isDifferent = found &&
            found.standard?.toLowerCase() !== found.southern?.toLowerCase();

        chunkHtml += `
            <div class="chunk-card ${isDifferent ? 'dialect-card' : ''}">
                <span class="chunk-v">${cleanWord}</span>
                ${found ? `
                    <span class="chunk-north">북부: ${found.standard || cleanWord}</span>
                    <span class="chunk-south ${isDifferent ? 'dialect-diff' : ''}">
                        남부: ${found.southern || cleanWord}
                    </span>
                    <span class="chunk-k">${found.meaning || '—'}</span>
                ` : `
                    <span class="chunk-k">—</span>
                `}
            </div>`;
    });

    const conflictCheck = isKorean ? translated : original;
    detectConflicts(conflictCheck, CONFLICT_DICTIONARY).forEach(item => {
        chunkHtml += `
            <div class="chunk-card conflict-card">
                <span class="chunk-v">⚠️ ${item.word}</span>
                <span class="chunk-north">북부: ${item.meaning_northern}</span>
                <span class="chunk-south dialect-diff">남부: ${item.meaning_southern}</span>
            </div>`;
    });

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