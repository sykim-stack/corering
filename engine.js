const DICT = { "ngô": "bắp", "thìa": "muỗng", "bố": "ba", "rượu": "vô" };

const input = document.getElementById('userInput');
const sendBtn = document.getElementById('send-btn');
const history = document.getElementById('chat-history');

async function handleSend() {
    const text = input.value.trim();
    if (!text) return;
    
    // 입력창 비우기
    input.value = '';

    // 화면에 내 말 표시
    const tempId = Date.now();
    const div = document.createElement('div');
    div.className = 'msg-box';
    div.innerHTML = `<div class="trans-text" id="t-${tempId}">...</div><div class="origin-text">${text}</div>`;
    history.appendChild(div);
    history.scrollIntoView({ behavior: 'smooth', block: 'end' });

    try {
        const target = /[ㄱ-ㅎ|가-힣]/.test(text) ? 'VI' : 'KO';
        
        // 절대 경로로 서버에 요청
        const res = await fetch(`/api/translate?text=${encodeURIComponent(text)}&target=${target}`);
        const data = await res.json();
        
        if (data.translations && data.translations[0]) {
            let result = data.translations[0].text;

            // 남부 방언 필터
            if (target === 'VI') {
                Object.keys(DICT).forEach(k => {
                    result = result.replace(new RegExp(k, "gi"), DICT[k]);
                });
            }
            document.getElementById(`t-${tempId}`).innerText = result;
        } else {
            throw new Error("응답 형식 오류");
        }
    } catch (e) {
        document.getElementById(`t-${tempId}`).innerText = "연결 실패: " + e.message;
    }
}

// 버튼 클릭 이벤트 바인딩
sendBtn.addEventListener('click', (e) => {
    e.preventDefault();
    handleSend();
});

// 엔터키 이벤트 바인딩
input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        handleSend();
    }
});
