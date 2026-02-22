// conflict.js
// 충돌 단어 감지 - CONFLICT_DICTIONARY 주입 방식

export function detectConflicts(text, conflictDictionary) {
    if (!text || !conflictDictionary) return [];

    return conflictDictionary.filter(item =>
        text.toLowerCase().includes(item.word.toLowerCase())
    );
}