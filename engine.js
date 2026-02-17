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

// engine.js 내의 handleSend 함수 중 일부만 수정하세요
async function handleSend() {
    const text = input.value.trim();
    if (!text) return;
    
    input.value = '';
    header.classList.remove('glow-active');

    const tempId = Date.now();
    const isKorean = /[ㄱ-ㅎ|가-힣]/.test(text);
    
    // 한국어면 왼쪽(Left), 베트남어면 오른쪽(Right) 배치
    const boxClass = isKorean ? 'msg-left' : 'msg-right';
    
    const div = document.createElement('div');
    div.className = `msg-box ${boxClass}`;
    div.innerHTML = `<div class="trans-text" id="t-${tempId}">...</div><div class="origin-text">${text}</div>`;
    history.appendChild(div);
    
    // ... 후략 (fetch 로직은 동일)

    
    // 자동 스크롤
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });

// ... (위쪽 코드는 동일하게 유지하시고 try-catch 부분만 확인하세요)

    try {
        const target = /[ㄱ-ㅎ|가-힣]/.test(text) ? 'VI' : 'KO';
        const res = await fetch(`/api/translate?text=${encodeURIComponent(text)}&target=${target}`);
        const data = await res.json();
        
        if (res.ok && data.translations) {
            let result = data.translations[0].text;

            // 사장님의 남부 방언 필터
            if (target === 'VI') {
                Object.keys(DICT).forEach(k => {
                    result = result.replace(new RegExp(k, "gi"), DICT[k]);
                });
            }
            document.getElementById(`t-${tempId}`).innerText = result;
        } else {
            // 여기서 DeepL이 보낸 진짜 에러(키 오류, 한도 초과 등)를 보여줍니다.
            throw new Error(data.details || data.error || '알 수 없는 응답');
        }
    } catch (e) {
        document.getElementById(`t-${tempId}`).innerText = "엔진 오류: " + e.message;
    }
// ...
}

// 이벤트 연결
sendBtn.onclick = (e) => {
    e.preventDefault();
    handleSend();
};

input.onkeypress = (e) => {
    if (e.key === 'Enter') handleSend();
};


