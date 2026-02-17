const DICT = { "ngô": "bắp", "thìa": "muỗng", "bố": "ba", "rượu": "vô" };

const input = document.getElementById('userInput');
const sendBtn = document.getElementById('send-btn');
const history = document.getElementById('chat-history');
const header = document.getElementById('header');

// 입력창 모스부호 애니메이션
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
    
    // 자동 스크롤
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });

    try {
        const target = /[ㄱ-ㅎ|가-힣]/.test(text) ? 'VI' : 'KO';
        
        // Vercel 서버리스 함수 호출
        const res = await fetch(`/api/translate?text=${encodeURIComponent(text)}&target=${target}`);
        
        if (!res.ok) {
            const errorInfo = await res.json();
            throw new Error(errorInfo.error || '서버 응답 불안정');
        }

        const data = await res.json();
        
        if (data.translations && data.translations[0]) {
            let result = data.translations[0].text;

            // 사장님의 코어 로직: 남부 방언 치환
            if (target === 'VI') {
                Object.keys(DICT).forEach(k => {
                    const regex = new RegExp(k, "gi");
                    result = result.replace(regex, DICT[k]);
                });
            }
            document.getElementById(`t-${tempId}`).innerText = result;
        } else {
            throw new Error('데이터 구조 불일치');
        }
    } catch (e) {
        document.getElementById(`t-${tempId}`).innerText = "엔진 오류: " + e.message;
    }
}

// 이벤트 연결
sendBtn.onclick = (e) => {
    e.preventDefault();
    handleSend();
};

input.onkeypress = (e) => {
    if (e.key === 'Enter') handleSend();
};
