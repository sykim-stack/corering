const CONFIG = {
    DEEPL_KEY: 'b7d91801-1316-448a-9896-dea29a271183:fx'
};

const SOUTHERN_DICT = { 
    "ngô": "bắp", 
    "thìa": "muỗng", 
    "bố": "ba", 
    "rượu": "vô" 
};

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
    div.innerHTML = `<div class="trans-text" id="t-${tempId}">...</div><div class="origin-text">${text}</div>`;
    history.appendChild(div);
    history.scrollTop = history.scrollHeight;

    try {
        const targetLang = /[ㄱ-ㅎ|가-힣]/.test(text) ? 'VI' : 'KO';
        
        // [보정 포인트] URLSearchParams 대신 직접 URL 파라미터로 전송 (가장 확실한 우회법)
        const params = new URLSearchParams({
            auth_key: CONFIG.DEEPL_KEY,
            text: text,
            target_lang: targetLang
        });

        const res = await fetch(`https://api-free.deepl.com/v2/translate?${params.toString()}`, {
            method: 'GET' // 실전 배포 환경에서는 GET 방식이 가장 트러블이 적습니다.
        });

        if (!res.ok) {
            const errorMsg = await res.text();
            throw new Error(`Status: ${res.status}`);
        }

        const data = await res.json();
        let result = data.translations[0].text;

        // 남부 방언 필터
        if (targetLang === 'VI') {
            Object.keys(SOUTHERN_DICT).forEach(key => {
                result = result.replace(new RegExp(key, "gi"), SOUTHERN_DICT[key]);
            });
        }

        document.getElementById(`t-${tempId}`).innerText = result;
    } catch (e) {
        // 에러 원인을 구체적으로 표시합니다.
        document.getElementById(`t-${tempId}`).innerText = `[연결 확인: ${e.message}]`;
    }
}

document.getElementById('send-btn').onclick = handleSend;
input.onkeypress = (e) => { if(e.key === 'Enter') handleSend(); };