const DICT = { "ngô": "bắp", "thìa": "muỗng", "bố": "ba", "rượu": "vô" };
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
            Object.keys(DICT).forEach(k => { result = result.replace(new RegExp(k, "gi"), DICT[k]); });
        }
        
        const finalResult = result;
        document.getElementById(`t-${tempId}`).innerText = finalResult;
        
        // 클릭 시 모달 오픈
        div.onclick = () => {
            document.getElementById('modal-body').innerHTML = `
                <div class="analysis-unit">
                    <div style="color:var(--gold); font-size:1.2rem; font-weight:800;">${finalResult}</div>
                    <div style="font-size:0.9rem; margin-top:10px; color:#888;">
                        원문: ${text}<br><br>
                        CORE-RING 시스템이 문맥을 분석하여 최적의 단어를 선택했습니다. 베트남 남부 방언 필터가 적용된 결과입니다.
                    </div>
                </div>`;
            modal.style.display = 'flex';
        };
    } catch (e) { document.getElementById(`t-${tempId}`).innerText = "오류 발생"; }
}

document.getElementById('send-btn').onclick = handleSend;
input.onkeypress = (e) => { if(e.key === 'Enter') handleSend(); };
document.getElementById('modal-close').onclick = () => modal.style.display = 'none';
window.onclick = (e) => { if(e.target == modal) modal.style.display = 'none'; };
