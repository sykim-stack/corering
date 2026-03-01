const { text, history = [], softTone = false, role = 'unknown', dialect = 'vi_south' } = req.body;

const dialectGuide =
    dialect === 'vi_north'   ? '베트남 북부(하노이) 구어체 기준으로 번역.' :
    dialect === 'vi_south'   ? '베트남 남부(호치민) 구어체 기준으로 번역.' :
    '표준 베트남어 기준으로 번역.';

const SYSTEM_PROMPT = `
당신은 한국-베트남 부부 통역사입니다.
${dialectGuide}

규칙:
1. 번역 결과만 출력. 설명 절대 금지.
2. 괄호, 태그, 안내문구 절대 금지.
3. 자연스럽고 따뜻한 톤 유지.
4. 한 줄로만 출력.
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
            'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent',
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