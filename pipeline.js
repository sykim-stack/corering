// ============================================================
// BRAINPOOL | CoreRing pipeline.js v2.0
// 자동 데이터셋 파이프라인 - 실제 컬럼명 기준
// standard_word (베트남어), meaning_ko (한국어)
// ============================================================

const PIPELINE_ENDPOINT = '/api/pipeline';

async function autoSaveToDataset({ inputText, outputText, isKorean }) {
    try {
        // KO→VI: input=한국어, output=베트남어
        // VI→KO: input=베트남어, output=한국어
        const standard_word = isKorean ? outputText : inputText;
        const meaning_ko    = isKorean ? inputText  : outputText;

        if (!standard_word || !meaning_ko) return;
        if (standard_word.trim().length < 1 || standard_word.trim().length > 200) return;
        if (meaning_ko.trim().length < 1    || meaning_ko.trim().length > 200)    return;

        // 문장인지 단어인지 판단 (공백 2개 이상이면 phrase)
        const entry_type = standard_word.trim().split(/\s+/).length > 2 ? 'phrase' : 'word';

        const res = await fetch(PIPELINE_ENDPOINT, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ standard_word, meaning_ko, entry_type })
        });

        const data = await res.json();

        if (data.saved) {
            console.debug('[pipeline] 신규 저장:', data.id);
        } else {
            console.debug('[pipeline] 중복 스킵');
        }
    } catch (e) {
        console.debug('[pipeline] 저장 실패 (무시):', e.message);
    }
}