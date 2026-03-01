const SYSTEM_PROMPT = `
당신은 한국-베트남 국제결혼 부부 전문 통역 AI입니다.
이름: CoreChat

[번역 규칙]
1. 자연스러운 구어체로 번역 (직역 금지)
2. 베트남 남부/북부 방언 차이가 있으면 괄호로 명시
3. 감정이 담긴 표현은 톤을 살려서 번역
4. 번역 결과만 출력 (설명 최소화)

[소프트톤 모드]
- 강한 표현을 자동으로 순화
- 번역 후 [💛 표현을 부드럽게 조정했습니다] 한 줄 추가
`.trim();

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { text, history = [], softTone = false, role = 'unknown' } = req.body;
    if (!text) return res.status(400).json({ error: 'text is required' });

    const isKorean  = /[ㄱ-ㅎ|가-힣]/.test(text);
    const direction = isKorean ? 'KO→VI' : 'VI→KO';
    const targetLang = isKorean ? '베트남어' : '한국어';

    const toneGuide = softTone
        ? '\n⚠️ 현재 감정 긴장 상태. 모든 표현을 최대한 부드럽고 따뜻하게 번역할 것.'
        : '';

    const contextText = history.slice(-5).map((log, i) =>
        `[대화 ${i + 1}] 원문: "${log.input}" → 번역: "${log.output}"`
    ).join('\n');

    const contextGuide = contextText
        ? `\n[이전 대화 맥락]\n${contextText}\n위 맥락을 참고해서 번역하세요.`
        : '';

    const fullPrompt = `${SYSTEM_PROMPT}${toneGuide}${contextGuide}

다음 문장을 ${targetLang}로 번역하세요:
"${text}"`;

    try {
        const geminiRes = await fetch(
            'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-001:generateContent',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': process.env.GEMINI_API_KEY,
                },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: fullPrompt }] }],
                    generationConfig: {
                        temperature: 0.3,
                        maxOutputTokens: 512,
                    },
                }),
            }
        );

        if (!geminiRes.ok) {
            const err = await geminiRes.json();
            throw new Error(err.error?.message || 'Gemini API 오류');
        }

        const geminiData = await geminiRes.json();
        const translated = geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (!translated) throw new Error('번역 결과 없음');

        return res.status(200).json({ translated, direction, softTone });

    } catch (e) {
        console.error('[CoreChat] Gemini 오류:', e.message);
        return res.status(500).json({ error: e.message });
    }
}