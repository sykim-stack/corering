// ============================================================
// BRAINPOOL | CoreRing pipeline.js v2.1
// 자동 데이터셋 파이프라인 - 저장 조건 강화
// v2.1: 긴 문장 차단 (단어 3개 이하만), 한국어 혼입 차단
// ============================================================

const PIPELINE_ENDPOINT = '/api/pipeline';

async function autoSaveToDataset({ inputText, outputText, isKorean }) {
    try {
        // KO→VI: input=한국어, output=베트남어
        // VI→KO: input=베트남어, output=한국어
        const standard_word = isKorean ? outputText : inputText;
        const meaning_ko    = isKorean ? inputText  : outputText;

        if (!standard_word || !meaning_ko) return;

        const sw = standard_word.trim();
        const mk = meaning_ko.trim();

        // ── 저장 조건 필터 ────────────────────────────────────

        // 1. 길이 기본 체크
        if (sw.length < 1 || sw.length > 100) return;
        if (mk.length < 1 || mk.length > 100) return;

        // 2. 단어 3개 이하만 저장 (긴 문장 차단)
        const wordCount = sw.split(/\s+/).length;
        if (wordCount > 3) return;

        // 3. standard_word에 한국어 혼입 차단
        if (/[ㄱ-ㅎ가-힣]/.test(sw)) return;

        // 4. meaning_ko에 베트남어 성조 문자 혼입 차단
        if (/[àáâãèéêìíòóôõùúýăđơưạảấầẩẫậắặẳẵẽẻếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỷỹỵ]/.test(mk)) return;

        // 5. 특수문자만 있는 경우 차단
        if (!/[a-zA-Z]/.test(sw)) return;

        // entry_type 판단
        const entry_type = wordCount > 1 ? 'phrase' : 'word';

        const res = await fetch(PIPELINE_ENDPOINT, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ standard_word: sw, meaning_ko: mk, entry_type })
        });

        const data = await res.json();

        if (data.saved) {
            console.debug('[pipeline] 신규 저장:', data.id, sw, '→', mk);
        } else {
            console.debug('[pipeline] 중복 스킵:', sw);
        }
    } catch (e) {
        console.debug('[pipeline] 저장 실패 (무시):', e.message);
    }
}