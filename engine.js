let CORE_DICTIONARY = [];

async function initEngine() {
    try {
        const res = await fetch('/api/get-sheet-dictionary'); 
        CORE_DICTIONARY = await res.json(); 
        console.log("🚀 CORE-RING 엔진 가동");
    } catch (e) { console.error("데이터 로드 실패"); }
}
initEngine();

const input = document.getElementById('userInput'), history = document.getElementById('chat-history');
const modal = document.getElementById('modal-overlay'), modalBody = document.getElementById('modal-body');

async function handleSend() {
    const text = input.value.trim();
    if (!text) return;
    input.value = '';

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

        // 사전시트 기반 남부어 치환
        CORE_DICTIONARY.forEach(item => {
            if (item.standard && result.includes(item.standard)) {
                result = result.replace(new RegExp(item.standard, 'gi'), item.southern);
            }
        });

        const finalResult = result;
        document.getElementById(`t-${tempId}`).innerText = finalResult;

        // 분석창: 군더더기 없이 데이터만 노출
        pairDiv.onclick = () => {
            let coreHtml = '';
            CORE_DICTIONARY.forEach(item => {
                if (finalResult.includes(item.southern)) {
                    coreHtml += `
                        <div class="core-chip">
                            <span class="chip-v">${item.southern}</span>
                            <span class="chip-k">${item.meaning}</span>
                        </div>`;
                }
            });

            modalBody.innerHTML = `
                <div class="full-sentence-card">
                    <span class="full-target">${finalResult}</span>
                    <span class="full-origin">${text}</span>
                </div>
                <div class="core-elements">${coreHtml}</div>
            `;
            modal.style.display = 'flex';
        };
    } catch (e) { document.getElementById(`t-${tempId}`).innerText = "연결 오류"; }
}

document.getElementById('send-btn').onclick = handleSend;
input.onkeypress = (e) => { if(e.key === 'Enter') handleSend(); };
document.getElementById('modal-close').onclick = () => modal.style.display = 'none';
window.onclick = (e) => { if(e.target == modal) modal.style.display = 'none'; };
