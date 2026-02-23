// ============================================================
// BRAINPOOL | CoreRing pipeline.js v1.0
// 자동 데이터셋 파이프라인
// - 번역 결과를 tp_translations에 pending으로 자동 저장
// - 중복은 RPC 함수(auto_save_translation)에서 서버측 처리
// - 실패해도 번역 UI에 영향 없음 (fire-and-forget)
// ============================================================

const PIPELINE_ENDPOINT = '/api/pipeline'; // Vercel API Route

/**
 * 번역 완료 후 자동 호출
 * @param {string} inputText   - 사용자 입력 원문
 * @param {string} outputText  - 번역 결과
 * @param {boolean} isKorean   - true: KO→VI, false: VI→KO
 */
async function autoSaveToDataset({ inputText, outputText, isKorean }) {
    try {
        const korean     = isKorean ? inputText  : outputText;
        const vietnamese = isKorean ? outputText : inputText;
        const direction  = isKorean ? 'KO→VI'   : 'VI→KO';

        // 너무 짧거나 긴 입력 필터 (노이즈 방지)
        if (!korean || !vietnamese) return;
        if (korean.trim().length < 1 || korean.trim().length > 200) return;
        if (vietnamese.trim().length < 1 || vietnamese.trim().length > 200) return;

        const res = await fetch(PIPELINE_ENDPOINT, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ korean, vietnamese, direction })
        });

        const data = await res.json();

        if (data.saved) {
            console.debug('[pipeline] 신규 저장 완료:', data.id);
        } else {
            console.debug('[pipeline] 중복 스킵:', data.reason);
        }
    } catch (e) {
        // 저장 실패해도 번역 UI에 영향 없음
        console.debug('[pipeline] 저장 실패 (무시):', e.message);
    }
}