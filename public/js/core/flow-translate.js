// ============================================================
// BRAINPOOL | CoreRing · flow-translate.js
// LANGUAGE LAYER — 순수 번역 함수
//
// 위치: /public/js/core/flow-translate.js
// 로드: engine.js에서 import
//
// 규칙:
//   ❌ DOM 접근 금지
//   ❌ UI 상태 변경 금지
//   ✅ fetch → parse → return data만
// ============================================================

// ── 내부 상태 ────────────────────────────────────────────────
let _coreDictionary     = [];
let _conflictDictionary = [];
let _dictMap            = new Map();
let _dictMeaningMap     = new Map();
let _maxPhraseLength    = 1;
let _initialized        = false;

// ── 사전 인덱스 빌드 ─────────────────────────────────────────
export function buildDictionaryIndex() {
    _dictMap.clear();
    _dictMeaningMap.clear();

    const clean = (str) => str?.toLowerCase().replace(/[.,!?]/g, '').trim();

    _coreDictionary.forEach(d => {
        const standard = clean(d.standard || d.standard_word);
        const southern = clean(d.southern || d.southern_word);
        const meaning  = clean(d.meaning  || d.meaning_ko);
        if (standard) _dictMap.set(standard, d);
        if (southern) _dictMap.set(southern, d);
        if (meaning)  _dictMeaningMap.set(meaning, d);
    });

    _maxPhraseLength = 1;
    _dictMap.forEach((_, key) => {
        const len = key.split(' ').length;
        if (len > _maxPhraseLength) _maxPhraseLength = len;
    });

    console.log('[flow-translate] indexed:', _dictMap.size, '| maxPhrase:', _maxPhraseLength);
}

// ── 엔진 초기화 ──────────────────────────────────────────────
export async function initEngine() {
    if (_initialized) return;
    _initialized = true;
    try {
        const [dictRes, conflictRes] = await Promise.all([
            fetch('/api/corering?action=get-dictionary'),
            fetch('/api/corering?action=get-conflicts'),
        ]);
        _coreDictionary     = await dictRes.json();
        _conflictDictionary = await conflictRes.json();
        buildDictionaryIndex();
    } catch (e) {
        console.error('[flow-translate] initEngine failed:', e);
        _initialized        = false;
        _coreDictionary     = [];
        _conflictDictionary = [];
        throw e;
    }
}

// ── 접근자 ───────────────────────────────────────────────────
export function getDictionary()         { return _coreDictionary; }
export function getConflictDictionary() { return _conflictDictionary; }
export function getDictMap()            { return _dictMap; }
export function getDictMeaningMap()     { return _dictMeaningMap; }
export function getMaxPhraseLength()    { return _maxPhraseLength; }
export function isEngineInitialized()   { return _initialized; }

// ── RING 모드 번역 (DeepL) ───────────────────────────────────
/**
 * @param {string} text
 * @param {'KO'|'VI'} target
 * @returns {Promise<{
 *   rawTranslation: string,
 *   emotion: null,   // 선택적 — 현재 비활성
 *   tone: null       // 선택적 — 현재 비활성
 * }>}
 */
export async function translateRing(text, target) {
    const res  = await fetch(
        `/api/corering?action=translate&text=${encodeURIComponent(text)}&target=${target}`
    );
    const data = await res.json();

    if (!res.ok || !data.translations?.[0]?.text) {
        throw new Error(data.error || 'translateRing: 번역 실패');
    }

    return {
        rawTranslation: data.translations[0].text,
        emotion: null,  // Phase 2에서 활성화
        tone:    null,  // Phase 2에서 활성화
    };
}

// ── CHAT 모드 번역 (Gemini) ──────────────────────────────────
/**
 * @param {string}  text
 * @param {boolean} isKorean
 * @param {{softTone?, role?, dialect?, history?}} options
 * @returns {Promise<{ translated: string, softTone: boolean }>}
 */
export async function translateChat(text, isKorean, options = {}) {
    const {
        softTone = false,
        role     = null,
        dialect  = 'vi_south',
        history  = [],
    } = options;

    const res  = await fetch('/api/corechat?action=chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ text, history, softTone, role, dialect }),
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'translateChat: 번역 오류');

    return {
        translated: data.translated,
        softTone:   data.softTone ?? false,
    };
}

// ── 채팅 메시지 번역 (인라인 버튼 — DOM 없음) ───────────────
/**
 * @param {string}  text
 * @param {boolean} isKorean
 * @returns {Promise<{ translated: string }>}
 */
export async function translateChatMessage(text, isKorean) {
    const target = isKorean ? 'VI' : 'KO';
    const res    = await fetch(
        `/api/corering?action=translate&text=${encodeURIComponent(text)}&target=${target}`
    );
    const data   = await res.json();

    if (!res.ok || !data.translations?.[0]?.text) {
        throw new Error(data.error || 'translateChatMessage: 번역 실패');
    }

    return { translated: data.translations[0].text };
}