// ============================================================
// BRAINPOOL | CoreRing logger.js v1.0
// 번역 로그 저장 - corelink API 호출
// ============================================================

async function saveTranslationLog({
    inputText, outputText, direction,
    detectedDialect, finalDialect,
    emotionScore, sessionId, conflictCount
}) {
    try {
        await fetch('/api/corelink', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'translate',
                input: inputText,
                standard_vi: outputText,
                direction,
                detected_dialect: detectedDialect,
                final_dialect: finalDialect,
                emotion_score: emotionScore,
                session_id: sessionId,
                is_southern: finalDialect === 'south',
                timestamp: Date.now()
            })
        });
    } catch (e) {
        console.error('Log Save Error:', e);
    }
}