// ============================================================
// BRAINPOOL | CoreRing · flow-translate.js
// LANGUAGE LAYER — 순수 번역 함수만 포함
//
// 규칙:
//   ❌ DOM 접근 금지
//   ❌ UI 상태 변경 금지
//   ❌ sessionLogs / saveChatLog 등 side effect 금지
//   ✅ fetch → parse → return data만 허용
//   ✅ 사전 인덱스 빌드 포함 (상태는 모듈 내 캡슐화)
//
// 의존 없음 — 어디서든 import 가능
// ============================================================

// ── 모듈 내부 상태 (캡슐화) ──────────────────────────────────
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

    console.log('[flow-translate] Dict indexed:', _dictMap.size, '| Max phrase:', _maxPhraseLength);
}

// ── 엔진 초기화 (사전 로드 + 인덱스) ────────────────────────
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

// ── 사전 읽기 전용 접근자 (외부 노출) ───────────────────────
export function getDictionary()         { return _coreDictionary; }
export function getConflictDictionary() { return _conflictDictionary; }
export function getDictMap()            { return _dictMap; }
export function getDictMeaningMap()     { return _dictMeaningMap; }
export function getMaxPhraseLength()    { return _maxPhraseLength; }
export function isInitialized()         { return _initialized; }

// ── RING 모드 번역 ───────────────────────────────────────────
/**
 * DeepL 번역 API 호출
 * @param {string} text   — 원문
 * @param {'KO'|'VI'} target — 목표 언어
 * @returns {{ rawTranslation: string }}
 * @throws 번역 실패 시 Error
 */
export async function translateRing(text, target) {
    const res  = await fetch(`/api/corering?action=translate&text=${encodeURIComponent(text)}&target=${target}`);
    const data = await res.json();

    if (!res.ok || !data.translations?.[0]?.text) {
        throw new Error(data.error || 'translateRing: 번역 실패');
    }

    return {
        rawTranslation: data.translations[0].text,
    };
}

// ── CHAT 모드 번역 (Gemini) ──────────────────────────────────
/**
 * Gemini API 호출 (CHAT 모드 — 방 미연결 상태)
 * @param {string}   text        — 원문
 * @param {boolean}  isKorean    — 한국어 여부
 * @param {object}   options     — { softTone, role, dialect, history }
 * @returns {{ translated: string, softTone?: boolean }}
 * @throws 번역 실패 시 Error
 */
export async function translateChat(text, isKorean, options = {}) {
    const {
        softTone = false,
        role     = null,
        dialect  = 'vi_south',
        history  = [],
    } = options;

    const res = await fetch('/api/corechat?action=chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, history, softTone, role, dialect }),
    });

    const data = await res.json();

    if (!res.ok) {
        throw new Error(data.error || 'translateChat: 번역 오류');
    }

    return {
        translated: data.translated,
        softTone:   data.softTone ?? false,
    };
}

// ── 개별 채팅 메시지 번역 (CHAT 모드 인라인 버튼용) ─────────
/**
 * 기존 채팅 메시지를 번역해서 반환 (DOM 접근 없음)
 * 호출부(flow-render.js)에서 DOM 업데이트 담당
 * @param {string} text      — 원문 텍스트
 * @param {boolean} isKorean — 원문 언어
 * @returns {{ translated: string }}
 * @throws 번역 실패 시 Error
 */
export async function translateChatMessage(text, isKorean) {
    const target = isKorean ? 'VI' : 'KO';
    const res    = await fetch(`/api/corering?action=translate&text=${encodeURIComponent(text)}&target=${target}`);
    const data   = await res.json();

    if (!res.ok || !data.translations?.[0]?.text) {
        throw new Error(data.error || 'translateChatMessage: 번역 실패');
    }

    return {
        translated: data.translations[0].text,
    };
}