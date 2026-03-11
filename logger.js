// ============================================================
// BRAINPOOL | CoreRing logger.js v1.1
// 번역 로그 저장 - corelink API 호출
// 변경: intent, intent_conf 컬럼 추가 (v1.1)
// ============================================================

async function saveTranslationLog({
    inputText, outputText, direction,
    detectedDialect, finalDialect,
    emotionScore, sessionId, conflictCount,
    intent, intentConf
}) {
    try {
        await fetch('/api/corering?action=corelink', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type:             'translate',
                input:            inputText,
                standard_vi:      outputText,
                direction,
                detected_dialect: detectedDialect,
                final_dialect:    finalDialect,
                emotion_score:    emotionScore,
                session_id:       sessionId,
                is_southern:      finalDialect === 'south',
                conflict_count:   conflictCount,
                intent:           intent     || 'NEUTRAL',
                intent_conf:      intentConf || 'inferred',
                timestamp:        Date.now()
            })
        });
    } catch (e) {
        console.error('Log Save Error:', e);
    }
}