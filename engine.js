const DICT = { "ngô": "bắp", "thìa": "muỗng", "bố": "ba", "rượu": "vô" };
const input = document.getElementById('userInput');
const history = document.getElementById('chat-history');

async function handleSend() {
    const text = input.value.trim();
    if (!text) return;
    input.value = '';

    const tempId = Date.now();
    const div = document.createElement('div');
    div.className = 'msg-box';
    div.innerHTML = `<div class="trans-text" id="t-${tempId}">서버 우회 중...</div><div class="origin-text">${text}</div>`;
    history.appendChild(div);
    history.scrollTop = history.scrollHeight;

    try {
        const target = /[ㄱ-ㅎ|가-힣]/.test(text) ? 'VI' : 'KO';
        
        // 브라우저가 직접 가지 않고, 우리가 만든 /api/translate로 요청을 보냅니다.
        const res = await fetch(`/api/translate?text=${encodeURIComponent(text)}&target=${target}`);
        const data = await res.json();
        
        let result = data.translations[0].text;

        if (target === 'VI') {
            Object.keys(DICT).forEach(k => {
                result = result.replace(new RegExp(k, "gi"), DICT[k]);
            });
        }
        document.getElementById(`t-${tempId}`).innerText = result;
    } catch (e) {
        document.getElementById(`t-${tempId}`).innerText = "엔진 심장부 오류 (Vercel 설정 확인)";
    }
}

document.getElementById('send-btn').onclick = handleSend;
input.onkeypress = (e) => { if(e.key === 'Enter') handleSend(); };