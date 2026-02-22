// dialect.js
// 순수 로직 엔진 - DB 없음, 세션 없음

const dialectRules = [
    { word: 'bố', dialect: 'north' },
    { word: 'mẹ', dialect: 'north' },
    { word: 'không', dialect: 'north' },
    { word: 'ạ', dialect: 'north' },
    { word: 'nhé', dialect: 'north' },
    { word: 'ba', dialect: 'south' },
    { word: 'má', dialect: 'south' },
    { word: 'hông', dialect: 'south' },
    { word: 'nha', dialect: 'south' },
    { word: 'vậy', dialect: 'south' },
    { word: 'hen', dialect: 'south' },
    { word: 'dzậy', dialect: 'south' },
];

export function detectDialectScore(text) {
    if (!text) return 'neutral';

    let score = { north: 0, south: 0 };
    const lowerText = text.toLowerCase();

    dialectRules.forEach(r => {
        if (lowerText.includes(r.word)) {
            score[r.dialect]++;
        }
    });

    if (score.north > score.south) return 'north';
    if (score.south > score.north) return 'south';
    return 'neutral';
}

export function resolveDialect({ detectedDialect, userLocale }) {
    // 회원: profiles.vi_locale 우선
    if (userLocale === 'vi_north') return 'north';
    if (userLocale === 'vi_south') return 'south';

    // 비회원: 감지 결과 사용
    return detectedDialect || 'neutral';
}