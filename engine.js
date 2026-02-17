const KEY = 'b7d91801-1316-448a-9896-dea29a271183:fx';
const DICT = { "ngô": "bắp", "thìa": "muỗng", "bố": "ba", "rượu": "vô" };

const input = document.getElementById('userInput');
const header = document.getElementById('header');
const history = document.getElementById('chat-history');

input.oninput = () => {
    if(input.value.length > 0) header.classList.add('glow-active');
    else header.classList.remove('glow-active');
};

async function handleSend() {
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    header.classList.remove('glow-active');

    const tempId = Date.now();
    const div = document.createElement('div');
    div.className = 'msg-box';
    div.innerHTML = `<div class="trans-text" id="t-${tempId}">분석 중...</div><div class="origin-text">${text}</div>`;
    history.appendChild(div);
    history.scrollTop = history.scrollHeight;

    try {
        const target = /[ㄱ-ㅎ|가-힣]/.test(text) ? 'VI' : 'KO';
        
        // CORS 우회를 위한 프록시 서버 경유 방식
        const url = `https://api.allorigins.win/get?url=${encodeURIComponent(
            `https://api-free.deepl.com/v2/translate?auth_key=${KEY}&text=${encodeURIComponent(text)}&target_lang=${target}`
        )}`;
        
        const res = await fetch(url);
        const proxyData = await res.json();
        const data = JSON.parse(proxyData.contents);
        
        let result = data.translations[0].text;

        // 사장님의 코어: 남부 방언 치환
        if (target === 'VI') {
            Object.keys(DICT).forEach(k => {
                result = result.replace(new RegExp(k, "gi"), DICT[k]);
            });
        }
        document.getElementById(`t-${tempId}`).innerText = result;
    } catch (e) {
        document.getElementById(`t-${tempId}`).innerText = "연결 통로 재설정 필요";
        console.error(e);
    }
}

document.getElementById('send-btn').onclick = handleSend;
input.onkeypress = (e) => { if(e.key === 'Enter') handleSend(); };