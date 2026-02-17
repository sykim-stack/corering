const KEY = 'b7d91801-1316-448a-9896-dea29a271183:fx';
const DICT = { "ngô": "bắp", "thìa": "muỗng", "bố": "ba", "rượu": "vô" };

const input = document.getElementById('userInput');
const header = document.getElementById('header');
const history = document.getElementById('chat-history');

async function handleSend() {
    const text = input.value.trim();
    if (!text) return;
    input.value = '';

    const tempId = Date.now();
    const div = document.createElement('div');
    div.className = 'msg-box';
    div.innerHTML = `<div class="trans-text" id="t-${tempId}">연결 중...</div><div class="origin-text">${text}</div>`;
    history.appendChild(div);
    history.scrollTop = history.scrollHeight;

    try {
        const target = /[ㄱ-ㅎ|가-힣]/.test(text) ? 'VI' : 'KO';
        
        // 브라우저 검열을 피하기 위한 우회 통로(Proxy) 적용
        const apiAddr = `https://api-free.deepl.com/v2/translate?auth_key=${KEY}&text=${encodeURIComponent(text)}&target_lang=${target}`;
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(apiAddr)}`;
        
        const res = await fetch(proxyUrl);
        if (!res.ok) throw new Error();
        
        const json = await res.json();
        const data = JSON.parse(json.contents); // 우회 통로를 거치면 데이터를 한 번 더 열어야 합니다.
        
        let result = data.translations[0].text;

        // 사장님의 코어: 남부 방언 적용
        if (target === 'VI') {
            Object.keys(DICT).forEach(k => {
                result = result.replace(new RegExp(k, "gi"), DICT[k]);
            });
        }
        document.getElementById(`t-${tempId}`).innerText = result;

    } catch (e) {
        document.getElementById(`t-${tempId}`).innerText = "통로 차단됨 (Key 또는 서버 확인)";
    }
}

document.getElementById('send-btn').onclick = handleSend;
input.onkeypress = (e) => { if(e.key === 'Enter') handleSend(); };
