// ============================================================
// BRAINPOOL | CoreRing dialect.js v1.0
// 방언 감지 - 북부/남부 판별
// ============================================================

const dialectRules = [
    { word: 'bố',   dialect: 'north' },
    { word: 'mẹ',   dialect: 'north' },
    { word: 'không', dialect: 'north' },
    { word: 'ạ',    dialect: 'north' },
    { word: 'nhé',  dialect: 'north' },
    { word: 'ba',   dialect: 'south' },
    { word: 'má',   dialect: 'south' },
    { word: 'hông', dialect: 'south' },
    { word: 'nha',  dialect: 'south' },
    { word: 'vậy',  dialect: 'south' },
    { word: 'hen',  dialect: 'south' },
    { word: 'dzậy', dialect: 'south' },
];

function detectDialectScore(text) {
    if (!text) return 'neutral';
    let score = { north: 0, south: 0 };
    const lowerText = text.toLowerCase();
    dialectRules.forEach(r => {
        if (lowerText.includes(r.word)) score[r.dialect]++;
    });
    if (score.north > score.south) return 'north';
    if (score.south > score.north) return 'south';
    return 'neutral';
}

function resolveDialect({ detectedDialect, userLocale }) {
    if (userLocale === 'vi_north') return 'north';
    if (userLocale === 'vi_south') return 'south';
    return detectedDialect || 'neutral';
}