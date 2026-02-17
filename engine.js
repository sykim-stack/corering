const MASTER_DICT = {
    "bắp": { ko: "옥수수", note: "남부 방언. 식당에서 'ngô' 대신 사용해 보세요." },
    "muỗng": { ko: "숟가락", note: "남부 표현. 현지인들이 가장 많이 쓰는 단어입니다." },
    "tôi": { ko: "나", note: "가장 정중하고 표준적인 1인칭 표현입니다." },
    "vô": { ko: "건배", note: "남부 술자리 필수 단어입니다." },
    "옥수수": { vi: "bắp", note: "남부 현지 표현 'bắp'으로 변환되었습니다." }
};
const input = document.getElementById('userInput'), history = document.getElementById('chat-history');
const header = document.getElementById('header'), modal = document.getElementById('modal-overlay');
input.addEventListener('input', () => { input.value.length > 0 ? header.classList.add('glow-active') : header.classList.remove('glow-active'); });
async function handleSend() {
    const text = input.value.trim(); if (!text) return;
    input.value = ''; header.classList.remove('glow-active');
    const tempId = Date.now(), pairDiv = document.createElement('div');
    pairDiv.className = 'msg-pair';
    pairDiv.innerHTML = `<div class="msg-box box-left">${text}</div><div class="msg-box box-right" id="t-${tempId}">...</div>`;
    history.appendChild(pairDiv); pairDiv.scrollIntoView({ behavior: 'smooth' });
    try {
        const isKorean = /[ㄱ-ㅎ|가-힣]/.test(text), target = isKorean ? 'VI' : 'KO';
        const res = await fetch(`/api/translate?text=${encodeURIComponent(text)}&target=${target}`);
        const data = await res.json(); let result = data.translations[0].text;
        if (target === 'VI') {
            const DICT = { "ngô": "bắp", "thìa": "muỗng", "bố": "ba", "rượu": "vô" };
            Object.keys(DICT).forEach(k => { result = result.replace(new RegExp(k, "gi"), DICT[k]); });
        }
        document.getElementById(`t-${tempId}`).innerText = result;
        pairDiv.onclick = () => {
            const oriWords = text.split(' '), transWords = result.split(' '), isKO = /[ㄱ-ㅎ|가-힣]/.test(text);
            let html = ''; const max = Math.max(oriWords.length, transWords.length);
            for(let i=0; i<max; i++) {
                const o = oriWords[i] || "", t = transWords[i] || "";
                const info = MASTER_DICT[o.toLowerCase().replace(/[.,!?]/g,'')] || MASTER_DICT[t.toLowerCase().replace(/[.,!?]/g,'')] || { note: "실전 문맥 최적화 번역입니다." };
                html += `<div class="analysis-card"><div class="card-main"><span class="word-front">${isKO ? t : o}</span><span style="color:var(--gold);opacity:0.3;">|</span><span class="word-back">${isKO ? o : t}</span></div><div class="word-usage-box">${info.note}</div></div>`;
            }
            document.getElementById('modal-body').innerHTML = html; modal.style.display = 'flex';
        };
    } catch (e) { document.getElementById(`t-${tempId}`).innerText = "연결 오류"; }
}
document.getElementById('send-btn').onclick = handleSend;
input.onkeypress = (e) => { if(e.key === 'Enter') handleSend(); };
document.getElementById('modal-close').onclick = () => modal.style.display = 'none';
document.getElementById('share-btn').onclick = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
        const toast = document.createElement('div'); toast.className = 'toast'; toast.innerText = 'URL 복사 완료!';
        document.body.appendChild(toast); setTimeout(() => toast.remove(), 2000);
    });
};
