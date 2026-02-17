let CORE_DICTIONARY = [];
const input = document.getElementById('userInput'), header = document.getElementById('header');
const history = document.getElementById('chat-history'), modal = document.getElementById('modal-overlay');

// 1. 사전 데이터 로드
async function initEngine() {
    try {
        const res = await fetch('/api/get-sheet-dictionary'); 
        CORE_DICTIONARY = await res.json();
    } catch (e) { console.error("DB 로드 실패"); }
}
initEngine();

// 2. 심장 박동 트리거
input.addEventListener('input', () => {
    input.value.length > 0 ? header.classList.add('glow-active') : header.classList.remove('glow-active');
});

// 3. 번역 및 덩어리 분석
async function handleSend() {
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    header.classList.remove('glow-active');

    const isKorean = /[ㄱ-ㅎ|가-힣]/.test(text);
    const tempId = Date.now();
    const pairDiv = document.createElement('div');
    pairDiv.className = isKorean ? 'msg-pair pair-left' : 'msg-pair pair-right';
    pairDiv.innerHTML = `<div class="box-top" id="t-${tempId}">...</div><div class="box-bottom">${text}</div>`;
    history.appendChild(pairDiv);
    pairDiv.scrollIntoView({ behavior: 'smooth' });

    try {
        const target = isKorean ? 'VI' : 'KO';
        const res = await fetch(`/api/translate?text=${encodeURIComponent(text)}&target=${target}`);
        const data = await res.json();
        let result = data.translations[0].text;

        // 남부어 치환 로직
        CORE_DICTIONARY.forEach(item => {
            if (item.standard && result.includes(item.standard)) {
                result = result.replace(new RegExp(item.standard, 'gi'), item.southern);
            }
        });

        document.getElementById(`t-${tempId}`).innerText = result;

        // 덩어리 분석창
        pairDiv.onclick = () => {
            let coreHtml = '';
            CORE_DICTIONARY.forEach(item => {
                if (result.includes(item.southern)) {
                    coreHtml += `<div class="core-chip"><span class="chip-v">${item.southern}</span><span class="chip-k">${item.meaning}</span></div>`;
                }
            });
            document.getElementById('modal-body').innerHTML = `
                <div class="full-sentence-card"><span class="full-target">${result}</span><span class="full-origin">${text}</span></div>
                <div class="core-elements">${coreHtml}</div>`;
            modal.style.display = 'flex';
        };
    } catch (e) { document.getElementById(`t-${tempId}`).innerText = "연결 오류"; }
}

document.getElementById('send-btn').onclick = handleSend;
input.onkeypress = (e) => { if(e.key === 'Enter') handleSend(); };
document.getElementById('modal-close').onclick = () => modal.style.display = 'none';
