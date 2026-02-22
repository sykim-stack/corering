// ============================================================
// BRAINPOOL | CoreRing conflict.js v1.0
// 충돌 단어 감지 - DB 딕셔너리 전체 매칭 (UI 배지용)
// MindWorld의 detectConflict()와 역할 다름:
//   - 이 파일: CONFLICT_DICTIONARY(DB) 기반, 배지/모달 표시용
//   - mindworld.js detectConflict(): 키워드 기반, 상태 전이용
// ============================================================

function detectConflicts(text, conflictDictionary) {
    if (!text || !conflictDictionary) return [];
    return conflictDictionary.filter(item =>
        text.toLowerCase().includes(item.word.toLowerCase())
    );
}