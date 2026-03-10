// ============================================================
// BRAINPOOL | CoreRing translate.js v2.1
// DB 우선 조회 → 미스 시 DeepL 호출
// v2.1: ES module (import) 방식
// ============================================================

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');

    const { text, target } = req.query;
    const KEY = process.env.DEEPL_API_KEY;

    if (!text) return res.status(400).json({ error: '텍스트 누락' });

    const clean = text.trim().toLowerCase();
    const isSingleWord = !clean.includes(' ');

    // ── ① DB 우선 조회 ───────────────────────────────────────
    if (isSingleWord) {
        try {
            if (target === 'KO') {
                // VI→KO: standard_word 또는 southern_word 매칭
                const { data: rows } = await supabase
                    .from('tp_translations')
                    .select('standard_word, southern_word, meaning_ko')
                    .or(`standard_word.ilike.${clean},southern_word.ilike.${clean}`)
                    .limit(1);

                if (rows && rows.length > 0 && rows[0].meaning_ko) {
                    console.log(`[translate] DB hit VI→KO: "${text}" → "${rows[0].meaning_ko}"`);
                    return res.status(200).json({
                        translations: [{ text: rows[0].meaning_ko }],
                        source: 'db',
                    });
                }
            } else {
                // KO→VI: meaning_ko 역방향 매칭
                const { data: rows } = await supabase
                    .from('tp_translations')
                    .select('standard_word, southern_word')
                    .ilike('meaning_ko', clean)
                    .limit(1);

                if (rows && rows.length > 0 && rows[0].standard_word) {
                    console.log(`[translate] DB hit KO→VI: "${text}" → "${rows[0].standard_word}"`);
                    return res.status(200).json({
                        translations: [{ text: rows[0].standard_word }],
                        source: 'db',
                    });
                }
            }
        } catch (dbErr) {
            console.error('[translate] DB lookup error, fallback to DeepL:', dbErr.message);
        }
    }

    // ── ② DeepL fallback ─────────────────────────────────────
    try {
        const response = await fetch('https://api-free.deepl.com/v2/translate', {
            method: 'POST',
            headers: {
                'Authorization': `DeepL-Auth-Key ${KEY}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({ text, target_lang: target })
        });
        const data = await response.json();
        return res.status(200).json({ ...data, source: 'deepl' });
    } catch (error) {
        return res.status(500).json({ error: 'DeepL 통신 실패' });
    }
}