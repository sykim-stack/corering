async function saveTranslationLog({
    inputText, outputText, direction,
    detectedDialect, finalDialect,
    emotionScore, riskScore, sessionId, conflictCount,  // ← riskScore 추가
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
                risk_score:       riskScore ?? null,    // ← 추가
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