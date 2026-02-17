const KEY = 'b7d91801-1316-448a-9896-dea29a271183:fx';
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
    div.innerHTML = `<div class="trans-text" id="t-${tempId}">심장 박동 중...</div><div class="origin-text">${text}</div>`;
    history.appendChild(div);
    history.scrollTop = history.scrollHeight;

    try {
        const target = /[ㄱ-ㅎ|가-힣]/.test(text) ? 'VI' : 'KO';
        
        // 가장 직관적인 데이터 전송 방식 (POST)
        const response = await fetch(`https://api-free.deepl.com/v2/translate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `auth_key=${KEY}&text=${encodeURIComponent(text)}&target_lang=${target}`
        });

        const data = await response.json();
        let result = data.translations[0].text;

        // 사장님의 고집: 남부 방언 필터
        if (target === 'VI') {
            Object.keys(DICT).forEach(k => {
                const regex = new RegExp(`\\b${k}\\b|${k}`, "gi");
                result = result.replace(regex, DICT[k]);
            });
        }
        
        document.getElementById(`t-${tempId}`).innerText = result;

    } catch (e) {
        // 만약 여기서도 Failed가 뜨면, 그건 브라우저의 'CORS' 정책 때문입니다.
        // 그 경우, 제가 알려드리는 '서버 우회용 버튼'을 하나 더 만들어야 합니다.
        document.getElementById(`t-${tempId}`).innerText = "보안 장벽 발생 - 우회 경로 준비 중";
    }
}

document.getElementById('send-btn').onclick = handleSend;
input.onkeypress = (e) => { if(e.key === 'Enter') handleSend(); };
