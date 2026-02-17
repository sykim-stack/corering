async function handleSend() {
    const text = input.value.trim();
    if (!text) return;
    input.value = '';

    const isKorean = /[ㄱ-ㅎ|가-힣]/.test(text);
    const tempId = Date.now();
    const pairDiv = document.createElement('div');

    // [정석] 입력 언어에 따라 좌우 배치 및 상하 크기 차등
    pairDiv.className = isKorean ? 'msg-pair pair-left' : 'msg-pair pair-right';
    
    // 한국어 입력 시: 위(베트남어-크게), 아래(한국어-작게)
    // 베트남어 입력 시: 위(한국어-크게), 아래(베트남어-작게)
    pairDiv.innerHTML = `
        <div class="box-top" id="t-${tempId}">...</div>
        <div class="box-bottom">${text}</div>
    `;
    
    history.appendChild(pairDiv);
    pairDiv.scrollIntoView({ behavior: 'smooth' });

    try {
        const target = isKorean ? 'VI' : 'KO';
        const res = await fetch(`/api/translate?text=${encodeURIComponent(text)}&target=${target}`);
        const data = await res.json();
        let result = data.translations[0].text;

        // 사전시트 남부어 치환 (500개 DB 활용)
        CORE_DICTIONARY.forEach(item => {
            if (item.standard && result.includes(item.standard)) {
                result = result.replace(new RegExp(item.standard, 'gi'), item.southern);
            }
        });

        const finalResult = result;
        document.getElementById(`t-${tempId}`).innerText = finalResult;

        // [분석창 로직] 단어 쪼개기 금지 -> 의미 있는 덩어리 매칭
        pairDiv.onclick = () => {
            let coreHtml = '';
            
            // 1. 먼저 DB에서 숙어가 있는지 검색 (가장 중요한 덩어리)
            CORE_DICTIONARY.forEach(item => {
                if (finalResult.includes(item.southern)) {
                    coreHtml += `
                        <div class="core-chip">
                            <span class="chip-v">${item.southern}</span>
                            <span class="chip-k">${item.meaning}</span>
                        </div>`;
                }
            });

            // 2. 만약 DB에 없는 일반 문장이라면 전체 대조만 깔끔하게
            modalBody.innerHTML = `
                <div class="full-sentence-card">
                    <span class="full-target">${finalResult}</span>
                    <span class="full-origin" style="font-size:1rem; opacity:0.6;">${text}</span>
                </div>
                <div class="core-elements">
                    ${coreHtml || '<p style="color:#555">통문장 분석 완료</p>'}
                </div>
            `;
            modal.style.display = 'flex';
        };
    } catch (e) { document.getElementById(`t-${tempId}`).innerText = "오류"; }
}
