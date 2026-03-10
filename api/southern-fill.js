// ============================================================
// BRAINPOOL | CoreRing api/southern-fill.js v1.0
// pending 단어들의 southern_word를 Gemini로 자동 채움
// 10개씩 배치 처리 → southern_word 업데이트 → status = 'approved'
// ============================================================

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BATCH_SIZE = 10;

async function askGeminiSouthern(words) {
    const wordList = words.map((w, i) => `${i + 1}. ${w}`).join('\n');

    const prompt = `
아래 베트남어 단어들의 남부(호치민) 방언 표현을 알려주세요.
북부(하노이) 표준어와 다르면 남부 표현으로, 같으면 그대로 반환하세요.

규칙:
1. 반드시 JSON 배열만 출력. 설명 절대 금지.
2. 순서 유지. 단어 수 동일하게.
3. 형식: ["남부표현1", "남부표현2", ...]

단어 목록:
${wordList}
`.trim();

    const geminiRes = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent',
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': process.env.GEMINI_API_KEY,
            },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.1,
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
    const raw = geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!raw) throw new Error('Gemini 응답 없음');

    // JSON 파싱 (```json 펜스 제거)
    const clean = raw.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // ① pending 데이터 조회 (southern_word = standard_word 인 것만)
        const { data: rows, error: fetchErr } = await supabase
            .from('tp_translations')
            .select('id, standard_word')
            .eq('status', 'pending')
            .eq('source', 'auto')
            .filter('southern_word', 'eq', supabase.raw('standard_word'))
            .limit(50);

        if (fetchErr) throw new Error(fetchErr.message);
        if (!rows || rows.length === 0) {
            return res.status(200).json({ message: '처리할 데이터 없음', updated: 0 });
        }

        let totalUpdated = 0;
        const errors     = [];

        // ② 10개씩 배치 처리
        for (let i = 0; i < rows.length; i += BATCH_SIZE) {
            const batch = rows.slice(i, i + BATCH_SIZE);
            const words = batch.map(r => r.standard_word);

            try {
                const southernWords = await askGeminiSouthern(words);

                // ③ 각 단어 업데이트
                for (let j = 0; j < batch.length; j++) {
                    const southernWord = southernWords[j] || batch[j].standard_word;

                    const { error: updateErr } = await supabase
                        .from('tp_translations')
                        .update({
                            southern_word: southernWord.trim(),
                            status:        'approved',
                        })
                        .eq('id', batch[j].id);

                    if (updateErr) {
                        errors.push({ id: batch[j].id, error: updateErr.message });
                    } else {
                        totalUpdated++;
                    }
                }

                console.log(`[southern-fill] 배치 ${i / BATCH_SIZE + 1} 완료: ${batch.length}개`);

                // Gemini rate limit 방지 (배치 간 0.5초 대기)
                if (i + BATCH_SIZE < rows.length) {
                    await new Promise(r => setTimeout(r, 500));
                }

            } catch (batchErr) {
                console.error(`[southern-fill] 배치 ${i / BATCH_SIZE + 1} 오류:`, batchErr.message);
                errors.push({ batch: i / BATCH_SIZE + 1, error: batchErr.message });
            }
        }

        return res.status(200).json({
            message:      '완료',
            total:        rows.length,
            updated:      totalUpdated,
            errors:       errors.length > 0 ? errors : undefined,
        });

    } catch (e) {
        console.error('[southern-fill] 오류:', e.message);
        return res.status(500).json({ error: e.message });
    }
}