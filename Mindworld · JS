// ============================================================
// BRAINPOOL | MindWorld v1.0
// 감정 상태 분석 / 역할 감지 / 관계 리스크 확률
// DB 없음. 순수 로직 엔진. 세션 종료 시 전체 초기화.
// ============================================================

// ─── 세션 상태 (engine.js에서 참조) ───────────────────────────
const sessionState = {
    intentState: 'CALM',
    recentEmotionScores: [],   // 최대 5개 슬라이딩 윈도우
    conflictCount: 0,
    conflictStateEntries: 0,
    calmStreak: 0,
    role: 'unknown'
};

// ─── 1. normalizeEmotion ──────────────────────────────────────
// rawScore → 0~1 사이로 정규화 (clamp)
function normalizeEmotion(rawScore) {
    if (rawScore === null || rawScore === undefined || isNaN(rawScore)) return 0;
    return Math.min(1, Math.max(0, rawScore / 10));
}

// ─── 2. detectRole ────────────────────────────────────────────
// 세션 로그 기반 남편/아내 판단
// 최소 10개 로그 없으면 unknown 반환
function detectRole(sessionLogs) {
    if (!sessionLogs || sessionLogs.length < 10) return 'unknown';

    const husbandWords = ['자기야', '당신', '여기', '이리와'];
    const wifeWords   = ['오빠', '자기', 'anh', 'em', '여보세요'];

    let husbandScore = 0;
    let wifeScore    = 0;

    sessionLogs.forEach(log => {
        const text = (log.input || '').toLowerCase();
        husbandWords.forEach(w => { if (text.includes(w)) husbandScore++; });
        wifeWords.forEach(w   => { if (text.includes(w)) wifeScore++;    });
    });

    if (wifeScore > husbandScore)   return 'wife';
    if (husbandScore > wifeScore)   return 'husband';
    return 'unknown';
}

// ─── 3. detectConflict ────────────────────────────────────────
// 충돌 단어 감지 (한/베 키워드 최소 정의)
// conflict.js의 detectConflicts()와 역할이 다름:
//   - conflict.js: DB 딕셔너리 전체 매칭 (UI 배지용)
//   - 이 함수: MindWorld 내부 상태 전이용 boolean 반환
const CONFLICT_KEYWORDS = ['싫어', '짜증', '됐어', '몰라', 'thôi', 'chán', 'ghét', 'kệ'];

function detectConflict(text) {
    if (!text) return false;
    const lower = text.toLowerCase();
    return CONFLICT_KEYWORDS.some(k => lower.includes(k));
}

// ─── 4. nextIntentState ───────────────────────────────────────
// 5상태 전이 머신: CALM → TENSE → CONFLICT → RECOVERY → STABLE
function nextIntentState({ currentState, emotionScore, conflictDetected, shortSentence }) {
    const isHigh    = emotionScore > 0.6;
    const isLow     = emotionScore < 0.3;
    const hasConf   = conflictDetected;

    switch (currentState) {
        case 'CALM':
            if (hasConf || isHigh) return 'TENSE';
            return 'CALM';

        case 'TENSE':
            if (hasConf && isHigh) return 'CONFLICT';
            if (isLow && !hasConf) return 'CALM';
            return 'TENSE';

        case 'CONFLICT':
            if (isLow && !hasConf) return 'RECOVERY';
            return 'CONFLICT';

        case 'RECOVERY':
            // RECOVERY는 calmStreak 카운트만 유지, 전이는 evaluateRisk에서 결정
            if (hasConf || isHigh) return 'CONFLICT';
            return 'RECOVERY';

        case 'STABLE':
            if (hasConf || isHigh) return 'TENSE';
            return 'STABLE';

        default:
            return 'CALM';
    }
}

// ─── 5. calculateCAS ─────────────────────────────────────────
// 갈등 누적 점수 (최근 5개 슬라이딩 윈도우)
function calculateCAS(state) {
    const recent = state.recentEmotionScores.slice(-5);
    const avgEmotion = recent.length
        ? recent.reduce((a, b) => a + b, 0) / recent.length
        : 0;

    const cas = (state.conflictStateEntries * 2) + (avgEmotion * 3) + state.conflictCount;
    return Math.round(Math.min(cas, 10) * 10) / 10;
}

// ─── 6. calculateRRP ─────────────────────────────────────────
// 관계 리스크 확률 (바이어스 -2.0 고정 → 일상 대화 0.25~0.4 수준)
function calculateRRP({ emotionScore, cas, role }) {
    const roleWeight = role === 'wife' ? 0.6 : role === 'husband' ? 0.2 : 0.4;
    const z = (emotionScore * 4) + (cas * 0.5) + roleWeight - 2.0;  // ✅ 바이어스 -2.0
    const rrp = 1 / (1 + Math.exp(-z));
    return Math.round(rrp * 100) / 100;
}

// ─── 7. evaluateRisk ─────────────────────────────────────────
// Decision Layer → level / gemini 전환 여부 / softTone 여부
function evaluateRisk(rrp) {
    if (rrp > 0.75) {
        return { level: 'HIGH',   gemini: true,  softTone: true  };
    } else if (rrp > 0.5) {
        return { level: 'MEDIUM', gemini: false, softTone: true  };
    } else {
        return { level: 'LOW',    gemini: false, softTone: false };
    }
}

// ─── 8. updateSession ────────────────────────────────────────
// 매 턴 세션 상태 갱신 (engine.js에서 호출)
function updateSession({ emotionScore, newIntentState, conflictDetected }) {
    // 슬라이딩 윈도우 (최대 5개)
    sessionState.recentEmotionScores.push(emotionScore);
    if (sessionState.recentEmotionScores.length > 5) {
        sessionState.recentEmotionScores.shift();
    }

    // CONFLICT 상태 진입 횟수
    if (newIntentState === 'CONFLICT') {
        sessionState.conflictStateEntries++;
    }

    // 충돌 감지 카운트
    if (conflictDetected) {
        sessionState.conflictCount++;
        sessionState.calmStreak = 0;
    } else {
        // RECOVERY 상태일 때는 calmStreak 증가만, 리셋 없음
        if (newIntentState !== 'RECOVERY') {
            sessionState.calmStreak++;
        }
    }

    sessionState.intentState = newIntentState;
}

// ─── 9. runMindWorld ─────────────────────────────────────────
// 통합 실행 함수 (engine.js에서 단일 호출)
// 반환: { level, gemini, softTone, rrp, cas, intentState }
function runMindWorld({ rawScore, inputText, sessionLogs }) {
    // ① 감정 정규화
    const emotionScore = normalizeEmotion(rawScore);

    // ② 충돌 감지
    const conflictDetected = detectConflict(inputText);

    // ③ 역할 감지 (10턴마다 갱신, 첫 턴은 unknown)
    if (!sessionLogs || sessionLogs.length % 10 === 0) {
        sessionState.role = detectRole(sessionLogs);
    }

    // ④ 상태 전이
    const shortSentence = inputText && inputText.length < 5;
    const newIntentState = nextIntentState({
        currentState: sessionState.intentState,
        emotionScore,
        conflictDetected,
        shortSentence
    });

    // ⑤ 세션 업데이트
    updateSession({ emotionScore, newIntentState, conflictDetected });

    // ⑥ CAS / RRP 계산
    const cas = calculateCAS(sessionState);
    const rrp = calculateRRP({ emotionScore, cas, role: sessionState.role });

    // ⑦ 리스크 판단
    const risk = evaluateRisk(rrp);

    return {
        ...risk,
        rrp,
        cas,
        intentState: newIntentState,
        role: sessionState.role
    };
}