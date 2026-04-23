// ============================================================
// BRAINPOOL | CoreRing flow-translate.js v1.0
// 번역 흐름 분리 — RING / CHAT 모드 독립 처리
// engine.js에서 import하여 사용
//
// 반환 구조:
//   { rawTranslation, emotion: null, tone: null }
//   → emotion / tone은 추후 MindWorld 연동 시 채울 예정
// ============================================================

// ── RING 모드 번역 ─────────────────────────────────────────────
/**
 * @param {string} text
 * @param {boolean} isKorean
 * @returns {Promise<{ rawTranslation: string, emotion: null, tone: null }>}
 */
    async function translateRing(text, isKorean) {
    const target = isKorean ? 'VI' : 'KO';
    const res    = await fetch(
        `/api/corering?action=translate&text=${encodeURIComponent(text)}&target=${target}`
    );

    if (!res.ok) throw new Error(`translate API ${res.status}`);

    const data           = await res.json();
    const rawTranslation = data?.translations?.[0]?.text;

    if (!rawTranslation) throw new Error('번역 결과 없음');

    return {
        rawTranslation,
        emotion: null, // 추후 MindWorld 연동 시 채울 예정
        tone:    null, // 추후 CoreRing 감정 분석 연동 시 채울 예정
    };
}

// ── CHAT 모드 번역 (Gemini) ────────────────────────────────────
/**
 * @param {string}   text
 * @param {boolean}  isKorean
 * @param {object[]} history      - 최근 대화 로그 (최대 5개)
 * @param {boolean}  softTone     - 감정 긴장 시 부드러운 번역
 * @param {string}   dialect      - 'vi_north' | 'vi_south' | 'vi_neutral'
 * @returns {Promise<{ rawTranslation: string, emotion: null, tone: null }>}
 */
    async function translateChat(text, isKorean, history = [], softTone = false, dialect = 'vi_south') {
    const res = await fetch('/api/corechat?action=chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            text,
            history:  history.slice(-5),
            softTone,
            dialect,
        }),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `chat API ${res.status}`);
    }

    const data           = await res.json();
    const rawTranslation = data?.translated;

    if (!rawTranslation) throw new Error('번역 결과 없음');

    return {
        rawTranslation,
        emotion: null, // 추후 MindWorld 연동 시 채울 예정
        tone:    null, // 추후 CoreRing 감정 분석 연동 시 채울 예정
    };
}

    async function translateChatMessage(text, isKorean) {
    const target = isKorean ? 'VI' : 'KO';

    const res = await fetch(
        `/api/corering?action=translate&text=${encodeURIComponent(text)}&target=${target}`
    );

    if (!res.ok) throw new Error(`message API ${res.status}`);

    const data = await res.json();
    const rawTranslation = data?.translations?.[0]?.text;

    if (!rawTranslation) throw new Error('번역 결과 없음');

    return {
        rawTranslation,
        emotion: null,
        tone: null,
    };
}