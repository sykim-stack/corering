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
    div.innerHTML = `<div class="trans-text" id="t-${tempId}">데이터 터널 진입...</div><div class="origin-text">${text}</div>`;
    history.appendChild(div);
    history.scrollTop = history.scrollHeight;

    try {
        const target = /[ㄱ-ㅎ|가-힣]/.test(text) ? 'VI' : 'KO';
        
        // window.location.origin을 붙여서 현재 도메인의 api 폴더를 정확히 지목합니다.
        const apiUrl = `${window.location.origin}/api/translate?text=${encodeURIComponent(text)}&target=${target}`;
        
        const res = await fetch(apiUrl);
        
        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.error || '서버 응답 오류');
        }
        
        const data = await res.json();
        let result = data.translations[0].text;

        // 사장님의 코어: 남부 방언 필터
        if (target === 'VI') {
            Object.keys(DICT).forEach(k => {
                result = result.replace(new RegExp(k, "gi"), DICT[k]);
            });
        }
        document.getElementById(`t-${tempId}`).innerText = result;

    } catch (e) {
        // 에러가 발생하면 구체적으로 어떤 에러인지 화면에 찍어버립니다.
        document.getElementById(`t-${tempId}`).innerText = `터널 오류: ${e.message}`;
        console.error("Detailed Error:", e);
    }
}

document.getElementById('send-btn').onclick = handleSend;
input.onkeypress = (e) => { if(e.key === 'Enter') handleSend(); };
