// ============================================================
// BRAINPOOL | CoreRing conflict.js v1.1
// 충돌 단어 감지 - DB 딕셔너리 전체 매칭 (UI 배지용)
// MindWorld의 detectConflict()와 역할 다름:
//   - 이 파일: CONFLICT_DICTIONARY(DB) 기반, 배지/모달 표시용
//   - mindworld.js detectConflict(): 키워드 기반, 상태 전이용
//
// v1.1 수정사항:
//   - 단어 경계 매칭 추가 (부분 문자열 오탐 방지)
//   - severity 기반 정렬 (high 우선)
// ============================================================

function detectConflicts(text, conflictDictionary) {
    if (!text || !conflictDictionary) return [];

    const cleanText = text.toLowerCase();

    const matched = conflictDictionary.filter(item => {
        if (!item.word) return false;
        const word = item.word.toLowerCase();
        // 단어 경계 체크: 앞뒤가 공백/문장부호/문자열 끝이어야 매칭
        const regex = new RegExp('(^|[\\s.,!?])' + word + '($|[\\s.,!?])', 'i');
        return regex.test(cleanText);
    });

    // severity 순 정렬: high → medium → low
    const order = { high: 0, medium: 1, low: 2 };
    matched.sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9));

    return matched;
}