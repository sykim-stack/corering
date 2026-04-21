// ============================================================
// BRAINPOOL | mindworld.js v1.1
// 감정/역할/리스크/의도 분석 — 순수 로직 엔진 (DB 없음)
// 변경: analyzeIntent() 추가, runMindWorld() conflicts 파라미터 추가 (v1.1)
// ============================================================

// ─────────────────────────────────────────
// 감정 정규화 (0~10 → 0~1)
// ─────────────────────────────────────────
export function normalizeEmotion(rawScore = 0) {
    return Math.max(0, Math.min(1, rawScore / 10));
}

// ─────────────────────────────────────────
// CAS (관계 누적 감정)
// ─────────────────────────────────────────
export function calculateCAS(scores = []) {
    if (!scores.length) return 0;

    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;

    // 0~10 → 0~1
    return Math.max(0, Math.min(1, avg / 10));
}

// ─────────────────────────────────────────
// RRP (관계 리스크)
// ─────────────────────────────────────────
export function calculateRRP({ cas = 0, normalized = 0 }) {
    const weightCAS = 0.6;
    const weightEmotion = 0.4;

    const raw = (cas * weightCAS) + (normalized * weightEmotion);

    return Math.max(0, Math.min(1, raw));
}

// ─────────────────────────────────────────
// 역할 추정
// ─────────────────────────────────────────
export function detectRole(sessionLogs = []) {
    if (!sessionLogs.length) return 'neutral';

    const last = sessionLogs[sessionLogs.length - 1];
    if (!last) return 'neutral';

    if (last.rawScore >= 6) return 'aggressor';
    if (last.rawScore <= 2) return 'stable';

    return 'neutral';
}

// ─────────────────────────────────────────
// 갈등 감지
// ─────────────────────────────────────────
export function detectConflict(text = '') {
    const keywords = ['왜', '짜증', '싫어', '그만', '하지마', '됐어'];

    return keywords.some(k => text.includes(k));
}

// ─────────────────────────────────────────
// 상태 전이 (Intent State)
// ─────────────────────────────────────────
export function nextIntentState({ currentState = 'CALM', hasConflict = false, normalized = 0 }) {

    if (normalized > 0.7) return 'ESCALATED';
    if (hasConflict && normalized > 0.4) return 'TENSE';
    if (normalized < 0.2) return 'CALM';

    return currentState;
}

// ─────────────────────────────────────────
// 위험도 평가
// ─────────────────────────────────────────
export function evaluateRisk({ rrp = 0, intentState = 'CALM' }) {

    let level = 'LOW';

    if (rrp > 0.7 || intentState === 'ESCALATED') level = 'HIGH';
    else if (rrp > 0.4 || intentState === 'TENSE') level = 'MEDIUM';

    return { level };
}

// ─────────────────────────────────────────
// 의도 분석
// ─────────────────────────────────────────
export function analyzeIntent({
    inputText = '',
    conflicts = [],
    rawScore = 0,
    intentState = 'CALM',
}) {

    if (intentState === 'ESCALATED') {
        return { intent: 'attack', confidence: 0.9 };
    }

    if (intentState === 'TENSE') {
        return { intent: 'defensive', confidence: 0.7 };
    }

    if (rawScore <= 2) {
        return { intent: 'friendly', confidence: 0.8 };
    }

    return { intent: 'neutral', confidence: 0.5 };
}

// ─────────────────────────────────────────
// 🔥 통합 실행 함수 (핵심)
// ─────────────────────────────────────────
export function runMindWorld({ rawScore = 0, inputText = '', sessionLogs = [], conflicts = [] }) {

    // 1️⃣ 감정 정규화
    const normalized = normalizeEmotion(rawScore);

    // 2️⃣ 역할
    const role = detectRole(sessionLogs);

    // 3️⃣ 갈등 여부
    const hasConflict = detectConflict(inputText);

    // 4️⃣ 이전 상태
    const prevState = sessionLogs.length > 1
        ? (sessionLogs[sessionLogs.length - 2].intentState || 'CALM')
        : 'CALM';

    // 5️⃣ 상태 전이
    const intentState = nextIntentState({
        currentState: prevState,
        hasConflict,
        normalized
    });

    // 6️⃣ 관계 누적
    const cas = calculateCAS(sessionLogs.map(l => l.rawScore || 0));

    // 7️⃣ 🔥 핵심 (수정 완료된 부분)
    const rrp = calculateRRP({ cas, normalized });

    // 8️⃣ 위험도
    const risk = evaluateRisk({ rrp, intentState });

    // 9️⃣ 의도 분석
    const intentResult = analyzeIntent({
        inputText,
        conflicts,
        rawScore,
        intentState,
    });

    return {
        level: risk.level,
        intentState,
        role,
        rrp,
        cas,
        intent: intentResult.intent,
        confidence: intentResult.confidence,
    };
}