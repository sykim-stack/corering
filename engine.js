const DICT = { 
    "ngô": "bắp", "thìa": "muỗng", "bố": "ba", "rượu": "vô",
    "옥수수": "bắp", "bắp": "옥수수", "tối": "나", "tôi": "나", "나": "tôi"
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

    const tempId = Date.now();
    const pairDiv = document.createElement('div');
    pairDiv.className = 'msg-pair';
    pairDiv.innerHTML = `
        <div class="msg-box box-left">${text}</div>
        <div class="msg-box box-right" id="t-${tempId}">...</div>
    `;
    history.appendChild(pairDiv);
    pairDiv.scrollIntoView({ behavior: 'smooth' });

    try {
        const isKorean = /[ㄱ-ㅎ|가-힣]/.test(text);
        const target = isKorean ? 'VI' : 'KO';
        const res = await fetch(`/api/translate?text=${encodeURIComponent(text)}&target=${target}`);
        const data = await res.json();
        let result = data.translations[0].text;

        if (target === 'VI') {
            Object.keys(DICT).forEach(k => { result = result.replace(new RegExp(k, "gi"), DICT[k]); });
        }
        
        const finalResult = result;
        document.getElementById(`t-${tempId}`).innerText = finalResult;

        // [핵심] 1:1 단어 매칭 분석 레이어
        pairDiv.onclick = () => {
            const oriWords = text.split(' ');
            const transWords = finalResult.split(' ');
            let html = '';
            const max = Math.max(oriWords.length, transWords.length);

            for(let i=0; i<max; i++) {
                const o = oriWords[i] || "-";
                const t = transWords[i] || "-";
                html += `
                    <div class="analysis-item">
                        <div class="word-row">
                            <span>${o}</span><span class="arrow">→</span><span style="color:var(--gold)">${t}</span>
                        </div>
                        <div class="word-desc">${DICT[o.toLowerCase()] || DICT[t.toLowerCase()] ? 'CORE-RING 실전 방언 적용' : '문맥 최적화 표현'}</div>
                    </div>`;
            }
            document.getElementById('modal-body').innerHTML = html;
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
        toast.className = 'toast'; toast.innerText = 'URL 복사 완료!';
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2000);
    });
};
