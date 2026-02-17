let CORE_DICTIONARY = [];

// [DB 연결] 사전시트 데이터 500개 동기화
async function initEngine() {
    try {
        const res = await fetch('/api/get-sheet-dictionary'); 
        CORE_DICTIONARY = await res.json(); 
        console.log("🚀 CORE-RING 엔진 가동: 500개 덩어리 사전 탑재");
    } catch (e) { 
        console.error("데이터 로드 실패");
        CORE_DICTIONARY = []; 
    }
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

    // [정석 배치] 좌우 80% 고정 & 말풍선 클래스
    pairDiv.className = isKorean ? 'msg-pair pair-left' : 'msg-pair pair-right';
    pairDiv.innerHTML = `<div class="box-top" id="t-${tempId}">...</div><div class="box-bottom">${text}</div>`;
    
    history.appendChild(pairDiv);
    pairDiv.scrollIntoView({ behavior: 'smooth' });

    try {
        const target = isKorean ? 'VI' : 'KO';
        const res = await fetch(`/api/translate?text=${encodeURIComponent(text)}&target=${target}`);
        const data = await res.json();
        let result = data.translations[0].text;

        // [사전시트 기반 남부어 강제 치환]
        CORE_DICTIONARY.forEach(item => {
            if (item.standard && result.includes(item.standard)) {
                result = result.replace(new RegExp(item.standard, 'gi'), item.southern);
            }
        });

        const finalResult = result;
        document.getElementById(`t-${tempId}`).innerText = finalResult;

        // [분석창 로직] 낱단어 쪼개기 삭제 -> 의미 있는 덩어리(Chunk) 매칭
        pairDiv.onclick = () => {
            let coreHtml = '';
            // 문장 전체에서 DB 숙어가 포함되어 있는지 덩어리로 검색
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
                <div class="core-elements">
                    ${coreHtml || '<p style="color:#555; font-size:0.9rem;">문맥 기반 실전 번역입니다.</p>'}
                </div>
            `;
            modal.style.display = 'flex';
        };
    } catch (e) { document.getElementById(`t-${tempId}`).innerText = "연결 오류"; }
}

document.getElementById('send-btn').onclick = handleSend;
input.onkeypress = (e) => { if(e.key === 'Enter') handleSend(); };
document.getElementById('modal-close').onclick = () => modal.style.display = 'none';
window.onclick = (e) => { if(e.target == modal) modal.style.display = 'none'; };
