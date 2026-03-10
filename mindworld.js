// ============================================================
// BRAINPOOL | mindworld.js v1.1
// 감정/역할/리스크/의도 분석 — 순수 로직 엔진 (DB 없음)
// 변경: analyzeIntent() 추가, runMindWorld() conflicts 파라미터 추가 (v1.1)
// ============================================================

// ─── 감정 점수 정규화 (0~1) ───────────────────────────────────
function normalizeEmotion(rawScore) {
    return Math.min(1, Math.max(0, rawScore / 10));
}

// ─── 역할 감지 (세션 로그 10개 이상 기준) ────────────────────
function detectRole(sessionLogs) {
    if (!sessionLogs || sessionLogs.length < 10) return 'unknown';
    const koCount = sessionLogs.filter(l => /[ㄱ-ㅎ|가-힣]/.test(l.input || '')).length;
    const viCount = sessionLogs.length - koCount;
    if (koCount > viCount * 1.5) return 'husband';
    if (viCount > koCount * 1.5) return 'wife';
    return 'unknown';
}

// ─── 충돌 키워드 감지 (상태 전이용) ──────────────────────────
function detectConflict(inputText) {
    const conflictKeywords = ['왜', '싫어', '됐어', '하지마', '그만', 'thôi', 'đừng', 'ghét', 'không muốn'];
    return conflictKeywords.some(k => (inputText || '').includes(k));
}

// ─── 5상태 전이 머신 ──────────────────────────────────────────
// CALM → TENSE → CONFLICT → RECOVERY → STABLE
function nextIntentState({ currentState, hasConflict, normalized }) {
    const state = currentState || 'CALM';

    if (hasConflict) {
        if (state === 'CALM')     return 'TENSE';
        if (state === 'TENSE')    return 'CONFLICT';
        if (state === 'CONFLICT') return 'CONFLICT';
        if (state === 'RECOVERY') return 'TENSE';
        if (state === 'STABLE')   return 'TENSE';
    } else {
        if (normalized < 0.3) {
            if (state === 'CONFLICT') return 'RECOVERY';
            if (state === 'TENSE')    return 'CALM';
            if (state === 'RECOVERY') return 'STABLE';
        }
    }
    return state;
}

// ─── 갈등 누적 점수 (최근 5개 슬라이딩 윈도우) ───────────────
function calculateCAS(scoreHistory) {
    if (!scoreHistory || scoreHistory.length === 0) return 0;
    const recent = scoreHistory.slice(-5);
    const sum    = recent.reduce((a, b) => a + (b || 0), 0);
    return sum / recent.length;
}

// ─── 관계 리스크 확률 (바이어스 -2.0 적용) ───────────────────
function calculateRRP({ cas, normalized }) {
    const raw = (cas * 0.6) + (normalized * 10 * 0.4) - 2.0;
    return Math.min(1, Math.max(0, raw / 10));
}

// ─── Decision Layer (Gemini 분기 여부 결정) ───────────────────
function evaluateRisk({ rrp, intentState }) {
    if (rrp >= 0.7 || intentState === 'CONFLICT') {
        return { level: 'HIGH',   useGemini: true  };
    }
    if (rrp >= 0.4 || intentState === 'TENSE') {
        return { level: 'MEDIUM', useGemini: false };
    }
    return     { level: 'LOW',    useGemini: false };
}

// ─── 의도 분류 (순수 로직) ────────────────────────────────────
// intent: REQUEST | COMPLAINT | THREAT | AFFECTION | NEUTRAL
function analyzeIntent({ inputText, conflicts = [], rawScore = 0, intentState = 'CALM' }) {
    const text = inputText || '';

    const intentMap = {
        THREAT:    ['하지마', '그만해', '됐어', '꺼져', 'thôi', 'đừng', 'ghét'],
        COMPLAINT: ['왜', '짜증', '싫어', '몰라', 'sao lại', 'không thích', 'bực'],
        REQUEST:   ['해줘', '부탁', '원해', '있어?', 'giúp', 'được không', 'muốn'],
        AFFECTION: ['사랑해', '고마워', '미안해', '보고싶어', 'yêu', 'cảm ơn', 'nhớ'],
    };

    let detected = 'NEUTRAL';
    let maxHits  = 0;

    for (const [intent, keywords] of Object.entries(intentMap)) {
        const hits = keywords.filter(k => text.includes(k)).length;
        if (hits > maxHits) {
            maxHits  = hits;
            detected = intent;
        }
    }
// 2차: 충돌 단어 가중 보정
// meaning_flip + high severity 인 경우에만 적용 (방언 차이는 제외)
const meaningFlipConflicts = conflicts.filter(
    c => c.conflict_type === 'meaning_flip' && c.severity === 'high'
);
    if (conflicts.length > 0) {
        if (detected === 'NEUTRAL')        detected = 'COMPLAINT';
        else if (detected === 'COMPLAINT') detected = 'THREAT';
    }

    if (intentState === 'CONFLICT' && detected === 'NEUTRAL') {
        detected = 'COMPLAINT';
    }

    if (rawScore >= 6 && detected === 'NEUTRAL') {
        detected = 'COMPLAINT';
    }

    return {
        intent:     detected,
        confidence: maxHits > 0 ? 'keyword' : 'inferred',
    };
}

// ─── 통합 실행 함수 ───────────────────────────────────────────
function runMindWorld({ rawScore, inputText, sessionLogs = [], conflicts = [] }) {

    const normalized  = normalizeEmotion(rawScore);
    const role        = detectRole(sessionLogs);
    const hasConflict = detectConflict(inputText);

    const prevState   = sessionLogs.length > 1
        ? (sessionLogs[sessionLogs.length - 2].intentState || 'CALM')
        : 'CALM';
    const intentState = nextIntentState({ currentState: prevState, hasConflict, normalized });

    const cas  = calculateCAS(sessionLogs.map(l => l.rawScore || 0));
    const rrp  = calculateRRP({ cas, normalized });
    const risk = evaluateRisk({ rrp, intentState });

    const intentResult = analyzeIntent({
        inputText,
        conflicts,
        rawScore,
        intentState,
    });

    return {
        level:      risk.level,
        intentState,
        role,
        rrp,
        cas,
        intent:     intentResult.intent,
        confidence: intentResult.confidence,
    };
}