// logger.js
// corelink API Route 통해서 저장 (키 노출 없음)

export async function saveTranslationLog({
    inputText,
    outputText,
    direction,
    detectedDialect,
    finalDialect,
    emotionScore,
    sessionId,
    conflictCount = 0
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
                is_southern: finalDialect === 'south'
            })
        });
    } catch (e) {
        console.error('Log Save Error:', e);
    }
}