// ============================================================
// BRAINPOOL | CoreChat API v1.0
// Gemini 2.0 Flash 기반 멀티턴 번역 + 국제결혼 특화
//
// 기존 /api/translate.js (DeepL) 와 병행 운영
// engine.js에서 mode === 'CHAT' 일 때 이 API 호출
//
// POST /api/chat
// Body: { text, history, riskLevel, softTone, role }
// ============================================================

const SYSTEM_PROMPT = `
당신은 한국-베트남 국제결혼 부부 전문 통역 AI입니다.
이름: CoreChat

[핵심 역할]
- 한국어 ↔ 베트남어 실시간 통역
- 부부 간 감정을 정확하고 따뜻하게 전달
- 오해를 줄이고 신뢰를 높이는 방향으로 번역

[번역 규칙]
1. 자연스러운 구어체로 번역 (직역 금지)
2. 베트남 남부/북부 방언 차이가 있으면 괄호로 명시
   예: "ăn cơm chưa (북부) / ăn cơm chưa anh (남부)"
3. 감정이 담긴 표현은 톤을 살려서 번역
4. 오해를 유발할 수 있는 표현은 [주의: 이 표현은 ...] 형태로 한 줄 추가
5. 번역 결과만 출력 (설명 최소화)

[소프트톤 모드 - 갈등 감지 시]
- 강한 표현을 자동으로 순화
- "싫어" → "조금 힘들어요"
- "왜 그래" → "어떻게 된 거예요?"
- 번역 후 [💛 표현을 부드럽게 조정했습니다] 한 줄 추가

[출력 형식]
번역 결과 텍스트만 출력
필요시 한 줄 주석 추가 (최대 1줄)
`.trim();

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const {
        text,
        history    = [],   // 이전 대화 배열 [{input, output}]
        softTone   = false,
        role       = 'unknown', // husband | wife | unknown
    } = req.body;

    if (!text) {
        return res.status(400).json({ error: 'text is required' });
    }

    const isKorean = /[ㄱ-ㅎ|가-힣]/.test(text);
    const direction = isKorean ? 'KO→VI' : 'VI→KO';
    const targetLang = isKorean ? '베트남어' : '한국어';

    // ── 소프트톤 지시 추가 ──
    const toneGuide = softTone
        ? '\n⚠️ 현재 감정 긴장 상태. 모든 표현을 최대한 부드럽고 따뜻하게 번역할 것.'
        : '';

    // ── 역할 컨텍스트 ──
    const roleGuide = role === 'wife'
        ? '\n현재 사용자: 베트남 아내 (베트남어가 모국어)'
        : role === 'husband'
        ? '\n현재 사용자: 한국 남편 (한국어가 모국어)'
        : '';

    // ── 최근 5턴 맥락 구성 ──
    const contextText = history.slice(-5).map((log, i) =>
        `[대화 ${i + 1}] 원문: "${log.input}" → 번역: "${log.output}"`
    ).join('\n');

    const contextGuide = contextText
        ? `\n[이전 대화 맥락]\n${contextText}\n위 맥락을 참고해서 번역하세요.`
        : '';

    // ── 최종 프롬프트 ──
    const fullPrompt = `${SYSTEM_PROMPT}${toneGuide}${roleGuide}${contextGuide}

다음 문장을 ${targetLang}로 번역하세요:
"${text}"`;

    try {
        const geminiRes = await fetch(
           `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: fullPrompt }] }],
                    generationConfig: {
                        temperature:     0.3,  // 낮을수록 정확, 높을수록 자연스러움
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

        return res.status(200).json({
            translated,
            direction,
            engine: 'gemini-2.0-flash',
            softTone,
        });

    } catch (e) {
        console.error('[CoreChat] Gemini 오류:', e.message);
        return res.status(500).json({ error: e.message });
    }
}