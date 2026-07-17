async function onSendMessage(userInput) {
    // 1. 기존 CoreChat 실행 (답변 받기)
    const chatResponse = await fetch('/api/chat', { /* ...기존 설정... */ });
    const chatData = await chatResponse.json();

    // 2. [Phase 0] MindWorld 레이어 작동 (Overlay)
    const mindResponse = await fetch('/api/mindworld', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            project_id: 'hajun-v2', 
            content: userInput 
        })
    });
    const mindData = await mindResponse.json();

    // 3. UI 업데이트 (CoreRing)
    updateMindStatusUI(mindData);
    
    // 4. 관제 로그 기록 (Decision Flow)
    if (typeof logDecisionFlow === 'function') {
        logDecisionFlow(userInput, mindData, chatData.reply);
    }
}

function updateMindStatusUI(data) {
    const statusEl = document.getElementById('mind-status-bar');
    if (statusEl) {
        statusEl.innerHTML = `
            <span>📍 상태: <b>${data.state}</b></span> | 
            <span>🚀 다음 행동: <b>${data.next_action}</b></span>
        `;
    }
}