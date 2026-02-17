const input = document.getElementById('userInput'), history = document.getElementById('chat-history');
const header = document.getElementById('header'), modal = document.getElementById('modal-overlay');

input.addEventListener('input', () => {
    input.value.length > 0 ? header.classList.add('glow-active') : header.classList.remove('glow-active');
});

async function handleSend() {
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    header.classList.remove('glow-active');

    const tempId = Date.now();
    const isKorean = /[ㄱ-ㅎ|가-힣]/.test(text);
    const pairDiv = document.createElement('div');

    // [정석 배치 판정] 한국어면 왼쪽 세트, 베트남어면 오른쪽 세트
    if (isKorean) {
        pairDiv.className = 'msg-pair pair-left';
        pairDiv.innerHTML = `<div class="box-top" id="t-${tempId}">...</div><div class="box-bottom">${text}</div>`;
    } else {
        pairDiv.className = 'msg-pair pair-right';
        pairDiv.innerHTML = `<div class="box-top" id="t-${tempId}">...</div><div class="box-bottom">${text}</div>`;
    }

    history.appendChild(pairDiv);
    pairDiv.scrollIntoView({ behavior: 'smooth' });

    try {
        const target = isKorean ? 'VI' : 'KO';
        const res = await fetch(`/api/translate?text=${encodeURIComponent(text)}&target=${target}`);
        const data = await res.json();
        let result = data.translations[0].text;

        if (target === 'VI') {
            const DICT = { "ngô": "bắp", "thìa": "muỗng", "bố": "ba", "rượu": "vô" };
            Object.keys(DICT).forEach(k => { result = result.replace(new RegExp(k, "gi"), DICT[k]); });
        }
        
        const finalResult = result;
        document.getElementById(`t-${tempId}`).innerText = finalResult;

        pairDiv.onclick = () => {
            const oriWords = text.split(/\s+/), transWords = finalResult.split(/\s+/);
            let html = '<div class="analysis-list">';
            const max = Math.max(oriWords.length, transWords.length);
            for(let i=0; i<max; i++) {
                const o = oriWords[i] ? oriWords[i].replace(/[.,!?]/g, '') : "";
                const t = transWords[i] ? transWords[i].replace(/[.,!?]/g, '') : "";
                if(!o && !t) continue;
                html += `<div class="analysis-card"><div class="card-main"><span class="word-front">${t}</span><span class="word-back">${o}</span></div></div>`;
            }
            document.getElementById('modal-body').innerHTML = html;
            modal.style.display = 'flex';
        };
    } catch (e) { document.getElementById(`t-${tempId}`).innerText = "오류"; }
}

document.getElementById('send-btn').onclick = handleSend;
input.onkeypress = (e) => { if(e.key === 'Enter') handleSend(); };
document.getElementById('modal-close').onclick = () => modal.style.display = 'none';
document.getElementById('share-btn').onclick = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
        const toast = document.createElement('div');
        toast.className = 'toast'; toast.innerText = 'URL 복사 완료!';
        document.body.appendChild(toast); setTimeout(() => toast.remove(), 2000);
    });
};
