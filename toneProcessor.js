// toneProcessor.js

export function applyTone({ text = '', rrp = 0, intentState = 'CALM' }) {

    // LOW → 그대로
    if (rrp < 0.3 && intentState === 'CALM') {
        return text;
    }

    // MEDIUM → 부드럽게
    if (rrp < 0.7) {
        return softenText(text);
    }

    // HIGH → 완충
    return cushionText(text);
}


// ─────────────────────────
// 부드럽게
// ─────────────────────────
function softenText(text) {
    return text
        .replace(/야/g, '요')
        .replace(/해라/g, '해주시면 좋겠어요')
        .replace(/왜/g, '혹시 왜')
        .replace(/뭐야/g, '무슨 상황인지 궁금해요');
}


// ─────────────────────────
// 완충 (갈등 완화)
// ─────────────────────────
function cushionText(text) {
    return `혹시 오해가 있을 수도 있어서 조심스럽게 말씀드리면, ${softenText(text)}`;
}