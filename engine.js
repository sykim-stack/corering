let CORE_DICTIONARY = [];
const input = document.getElementById('userInput'), header = document.getElementById('header');
const history = document.getElementById('chat-history'), modal = document.getElementById('modal-overlay');

async function initEngine() {
    try {
        const res = await fetch('/api/get-sheet-dictionary'); 
        CORE_DICTIONARY = await res.json();
    } catch (e) { console.error("DB Load Failed"); }
}
initEngine();

// 심장 박동 트리거
input.addEventListener('input', () => {
    input.value.length > 0 ? header.classList.add('glow-active') : header.classList.remove('glow-active');
});

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

        // 남부어 치환
        CORE_DICTIONARY.forEach(item => {
            if (item.standard && result.includes(item.standard)) {
                result = result.replace(new RegExp(item.standard, 'gi'), item.southern);
            }
        });

        document.getElementById(`t-${tempId}`).innerText = result;

        // [학습 카드 생성] 사장님이 10번 넘게 말씀하신 그 UI
        pairDiv.onclick = () => {
            let chunkHtml = '';
            CORE_DICTIONARY.forEach(item => {
                if (result.includes(item.southern)) {
                    chunkHtml += `
                        <div class="chunk-card">
                            <span class="chunk-v">${item.southern}</span>
                            <span class="chunk-k">${item.meaning}</span>
                        </div>`;
                }
            });
            
            document.getElementById('modal-body').innerHTML = `
                <div>
                    <div style="font-size:1.5rem; font-weight:800; color:#fff; margin-bottom:5px;">${result}</div>
                    <div style="font-size:1.1rem; color:#666;">${text}</div>
                </div>
                <div style="height:1px; background:#222; margin:20px 0;"></div>
                <div class="chunk-grid">
                    ${chunkHtml || '<div style="color:#444; grid-column:span 2; text-align:center;">의미 덩어리 분석 중...</div>'}
                </div>`;
            modal.style.display = 'flex';
        };
    } catch (e) { document.getElementById(`t-${tempId}`).innerText = "ERROR"; }
}

document.getElementById('send-btn').onclick = handleSend;
input.onkeypress = (e) => { if(e.key === 'Enter') handleSend(); };
document.getElementById('modal-close').onclick = () => modal.style.display = 'none';
