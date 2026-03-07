// ─── CHAT 모드 처리 ───────────────────────────────────────────
async function handleChatMode(text, mw, tempId, pairDiv, isKorean, isLeft) {
    try {
        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text,
                history:  sessionLogs.slice(-5),
                softTone: mw.softTone,
                role:     mw.role,
                dialect:  userLocale || 'vi_south',
            }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '번역 오류');

        const translated = data.translated;

        let topHtml = translated;
        if (mw.level === 'HIGH') {
            topHtml += ' <span class="conflict-badge risk-badge">🔴 갈등 감지</span>';
        } else if (mw.level === 'MEDIUM') {
            topHtml += ' <span class="conflict-badge risk-badge risk-medium">🟡 주의</span>';
        }
        if (data.softTone) {
            topHtml += ' <span class="conflict-badge" style="background:rgba(240,180,41,0.15);color:#f0b429;">💛 순화됨</span>';
        }

        document.getElementById(`t-${tempId}`).innerHTML = topHtml;

        try { await navigator.clipboard.writeText(translated); } catch {}

        saveChatLog({
            original:   text,
            translated,
            topHtml,
            isKorean,
            isLeft,
            checkText:  translated,
            firstLang,
            mode:       'CHAT',
            timestamp:  Date.now(),
        });

        sessionLogs.push({ input: text, output: translated, timestamp: Date.now() });

        // corechat 로그 저장
        fetch('/api/corechat-log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                source_locale:    isKorean ? 'ko' : 'vi',
                target_locale:    isKorean ? 'vi' : 'ko',
                input_text:       text,
                output_text:      translated,
                engine_used:      'gemini',
                emotion_score:    mw?.rrp ?? null,
                conflict_detected: mw?.level === 'HIGH',
            }),
        }).catch(() => {});

        pairDiv.onclick = () => {
            showModal(text, translated, isKorean, isKorean ? translated : text);
        };

    } catch (e) {
        document.getElementById(`t-${tempId}`).innerText = '번역 오류';
        console.error('[CoreChat]', e);
    }
}