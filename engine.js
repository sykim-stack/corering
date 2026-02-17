// 차별화의 핵심: 남부 방언 사전
const SOUTH_FILTER = { "ngô": "bắp", "thìa": "muỗng", "bố": "ba", "rượu": "vô" };

async function handleSend() {
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    
    const tempId = Date.now();
    const isKorean = /[ㄱ-ㅎ|가-힣]/.test(text);

    const pairDiv = document.createElement('div');
    pairDiv.className = 'msg-pair';
    pairDiv.innerHTML = `
        <div class="box-top">${text}</div>
        <div class="box-bottom" id="t-${tempId}">...</div>
    `;
    history.appendChild(pairDiv);
    pairDiv.scrollIntoView({ behavior: 'smooth' });

    try {
        const target = isKorean ? 'VI' : 'KO';
        const res = await fetch(`/api/translate?text=${encodeURIComponent(text)}&target=${target}`);
        const data = await res.json();
        let result = data.translations[0].text;

        // [차별화 포인트 1] 방언 강제 주입
        if (target === 'VI') {
            Object.keys(SOUTH_FILTER).forEach(k => {
                result = result.replace(new RegExp(k, "gi"), SOUTH_FILTER[k]);
            });
        }
        
        document.getElementById(`t-${tempId}`).innerText = result;

        // [차별화 포인트 2] 클릭 시 1:1 매칭 칩 노출
        pairDiv.onclick = () => {
            const oriWords = text.split(' ');
            const transWords = result.split(' ');
            let html = '<div class="analysis-list">';
            const max = Math.max(oriWords.length, transWords.length);

            for(let i=0; i<max; i++) {
                const o = oriWords[i] ? oriWords[i].replace(/[.,!?]/g, '') : "";
                const t = transWords[i] ? transWords[i].replace(/[.,!?]/g, '') : "";
                if(!o && !t) continue;

                // 한국어 입력 시: 베트남어(t)가 위, 한국어(o)가 아래
                // 베트남어 입력 시: 한국어(t)가 위, 베트남어(o)가 아래
                html += `
                    <div class="analysis-card">
                        <div class="card-main">
                            <span class="word-front">${t}</span>
                            <span class="word-back">${o}</span>
                        </div>
                    </div>`;
            }
            html += '</div>';
            document.getElementById('modal-body').innerHTML = html;
            document.getElementById('modal-overlay').style.display = 'flex';
        };
    } catch (e) { document.getElementById(`t-${tempId}`).innerText = "오류"; }
}
