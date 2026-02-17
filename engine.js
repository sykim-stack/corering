const DICT = { 
    "bắp": { mean: "옥수수", usage: "남부 방언. 북부(ngô)보다 실전에서 더 많이 쓰임." },
    "muỗng": { mean: "숟가락", usage: "남부 방언. 식당에서 'thìa' 대신 사용하세요." },
    "ba": { mean: "아빠", usage: "남부 가족 호칭. 친근함의 표시입니다." },
    "vô": { mean: "건배 / 들어가다", usage: "회식 자리 필수 단어. '못 하이 바 보!' (1,2,3 샷!)" }
};

const input = document.getElementById('userInput');
const history = document.getElementById('chat-history');
const header = document.getElementById('header');
const modal = document.getElementById('modal-overlay');

input.addEventListener('input', () => {
    input.value.length > 0 ? header.classList.add('glow-active') : header.classList.remove('glow-active');
});

async function handleSend() {
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    header.classList.remove('glow-active');

    const isKorean = /[ㄱ-ㅎ|가-힣]/.test(text);
    const boxClass = isKorean ? 'msg-left' : 'msg-right';
    const tempId = Date.now();

    const div = document.createElement('div');
    div.className = `msg-box ${boxClass}`;
    div.innerHTML = `<div class="trans-text" id="t-${tempId}">...</div><div class="origin-text">${text}</div>`;
    history.appendChild(div);
    div.scrollIntoView({ behavior: 'smooth' });

    try {
        const target = isKorean ? 'VI' : 'KO';
        const res = await fetch(`/api/translate?text=${encodeURIComponent(text)}&target=${target}`);
        const data = await res.json();
        let result = data.translations[0].text;

        if (target === 'VI') {
            Object.keys(DICT).forEach(k => { result = result.replace(new RegExp(k, "gi"), k); });
        }
        
        const finalResult = result;
        document.getElementById(`t-${tempId}`).innerText = finalResult;

        div.onclick = () => {
            const words = finalResult.split(' ');
            let analysisHTML = '<div class="analysis-list">';
            words.forEach(w => {
                const clean = w.toLowerCase().replace(/[.,!?]/g, '');
                const info = DICT[clean] || { mean: "일반 표현", usage: "문맥에 따른 표준 번역입니다." };
                analysisHTML += `
                    <div class="word-item">
                        <div class="word-top"><span class="word-origin">${clean}</span><span class="word-mean">${info.mean}</span></div>
                        <div class="word-usage">${info.usage}</div>
                    </div>`;
            });
            analysisHTML += '</div>';
            document.getElementById('modal-body').innerHTML = analysisHTML;
            modal.style.display = 'flex';
        };
    } catch (e) { document.getElementById(`t-${tempId}`).innerText = "연결 오류"; }
}

document.getElementById('send-btn').onclick = handleSend;
input.onkeypress = (e) => { if(e.key === 'Enter') handleSend(); };
document.getElementById('modal-close').onclick = () => modal.style.display = 'none';

document.getElementById('share-btn').onclick = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.innerText = 'URL 복사 완료! 친구에게 공유하세요.';
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2000);
    });
};
