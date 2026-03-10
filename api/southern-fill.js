// ============================================================
// BRAINPOOL | CoreRing api/southern-fill.js v1.2
// v1.2: 배치 대기시간 증가 (500ms→1500ms), 실패 배치 1회 재시도
// ============================================================

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BATCH_SIZE  = 10;
const BATCH_DELAY = 1500;  // 배치 간 대기 (ms)
const RETRY_DELAY = 3000;  // 재시도 대기 (ms)

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

    const clean = raw.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
}

async function processBatch(batch) {
    const words = batch.map(r => r.standard_word);

    // 1차 시도
    let southernWords;
    try {
        southernWords = await askGeminiSouthern(words);
    } catch (e) {
        // 실패 시 RETRY_DELAY 후 1회 재시도
        console.log(`[southern-fill] 재시도 대기 ${RETRY_DELAY}ms...`);
        await new Promise(r => setTimeout(r, RETRY_DELAY));
        southernWords = await askGeminiSouthern(words);  // 여기서도 실패하면 throw
    }

    const errors  = [];
    let   updated = 0;

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
            updated++;
        }
    }

    return { updated, errors };
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { data: rows, error: fetchErr } = await supabase
            .from('tp_translations')
            .select('id, standard_word, southern_word')
            .eq('status', 'pending')
            .eq('source', 'auto')
            .limit(50);

        if (fetchErr) throw new Error(fetchErr.message);
        if (!rows || rows.length === 0) {
            return res.status(200).json({ message: '처리할 데이터 없음', updated: 0 });
        }

        const targets = rows.filter(r => r.southern_word === r.standard_word);

        if (targets.length === 0) {
            return res.status(200).json({ message: '처리할 데이터 없음', updated: 0 });
        }

        let totalUpdated = 0;
        const allErrors  = [];

        for (let i = 0; i < targets.length; i += BATCH_SIZE) {
            const batch      = targets.slice(i, i + BATCH_SIZE);
            const batchNum   = Math.floor(i / BATCH_SIZE) + 1;

            try {
                const { updated, errors } = await processBatch(batch);
                totalUpdated += updated;
                if (errors.length > 0) allErrors.push(...errors);
                console.log(`[southern-fill] 배치 ${batchNum} 완료: ${updated}개`);
            } catch (e) {
                console.error(`[southern-fill] 배치 ${batchNum} 최종 실패:`, e.message);
                allErrors.push({ batch: batchNum, error: e.message });
            }

            // 다음 배치 전 대기
            if (i + BATCH_SIZE < targets.length) {
                await new Promise(r => setTimeout(r, BATCH_DELAY));
            }
        }

        return res.status(200).json({
            message: '완료',
            total:   targets.length,
            updated: totalUpdated,
            errors:  allErrors.length > 0 ? allErrors : undefined,
        });

    } catch (e) {
        console.error('[southern-fill] 오류:', e.message);
        return res.status(500).json({ error: e.message });
    }
}