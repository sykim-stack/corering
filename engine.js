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
    div.innerHTML = `<div class="trans-text" id="t-${tempId}">지하 터널 통과 중...</div><div class="origin-text">${text}</div>`;
    history.appendChild(div);
    history.scrollTop = history.scrollHeight;

    try {
        const target = /[ㄱ-ㅎ|가-힣]/.test(text) ? 'VI' : 'KO';
        
        // 이제 DeepL 주소가 아니라, 우리가 만든 내부 API 경로(/api/translate)로 보냅니다.
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
        document.getElementById(`t-${tempId}`).innerText = "터널 붕괴: 서버 설정을 확인하세요.";
    }
}

document.getElementById('send-btn').onclick = handleSend;
input.onkeypress = (e) => { if(e.key === 'Enter') handleSend(); };
