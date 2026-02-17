const input = document.getElementById('userInput');
const history = document.getElementById('chat-history');
const header = document.getElementById('header');
const modal = document.getElementById('modal-overlay');
const sendBtn = document.getElementById('send-btn');
const modalBody = document.getElementById('modal-body');

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

        if (target === 'VI') {
            const DICT = { "ngô": "bắp", "thìa": "muỗng", "bố": "ba", "rượu": "vô" };
            Object.keys(DICT).forEach(k => {
                result = result.replace(new RegExp(k, "gi"), DICT[k]);
            });
        }
        
        const finalResult = result;
        document.getElementById(`t-${tempId}`).innerText = finalResult;

        pairDiv.onclick = () => {
            const oriWords = text.split(/\s+/);
            const transWords = finalResult.split(/\s+/);
            let html = '';
            const max = Math.max(oriWords.length, transWords.length);

            for(let i=0; i<max; i++) {
                const o = oriWords[i] ? oriWords[i].replace(/[.,!?]/g, '') : "";
                const t = transWords[i] ? transWords[i].replace(/[.,!?]/g, '') : "";
                if(!o && !t) continue;
                html += `
                    <div class="analysis-card">
                        <div class="card-main">
                            <span class="word-front">${t}</span>
                            <span class="word-back">${o}</span>
                        </div>
                    </div>`;
            }
            modalBody.innerHTML = html;
            modal.style.display = 'flex';
        };
    } catch (e) {
        document.getElementById(`t-${tempId}`).innerText = "연결 오류";
    }
}

sendBtn.onclick = handleSend;
input.onkeypress = (e) => { if(e.key === 'Enter') handleSend(); };
document.getElementById('modal-close').onclick = () => modal.style.display = 'none';
window.onclick = (e) => { if(e.target == modal) modal.style.display = 'none'; };

document.getElementById('share-btn').onclick = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.innerText = 'URL 복사 완료!';
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2000);
    });
};
