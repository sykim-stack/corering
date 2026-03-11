// ============================================================
// BRAINPOOL | CoreRing — 통합 API v1.0
// 라우팅: /api/corering?action=xxx
//
// action 목록:
//   translate        ← translate.js
//   pipeline         ← pipeline.js
//   get-conflicts    ← get-conflicts.js
//   get-dictionary   ← get-sheet-dictionary.js
//   southern-fill    ← southern-fill.js
//   corelink         ← corelink.js (로그 저장)
// ============================================================

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ─────────────────────────────────────────────
// TRANSLATE
// ─────────────────────────────────────────────
async function handleTranslate(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');

    const { text, target } = req.query;
    const KEY = process.env.DEEPL_API_KEY;

    if (!text) return res.status(400).json({ error: '텍스트 누락' });

    const clean = text.trim().toLowerCase();
    const isSingleWord = !clean.includes(' ');

    if (isSingleWord) {
        try {
            if (target === 'KO') {
                const { data: rows } = await supabase
                    .from('tp_translations')
                    .select('standard_word, southern_word, meaning_ko')
                    .or(`standard_word.ilike.${clean},southern_word.ilike.${clean}`)
                    .limit(1);

                if (rows && rows.length > 0 && rows[0].meaning_ko) {
                    return res.status(200).json({
                        translations: [{ text: rows[0].meaning_ko }],
                        source: 'db',
                    });
                }
            } else {
                const { data: rows } = await supabase
                    .from('tp_translations')
                    .select('standard_word, southern_word')
                    .ilike('meaning_ko', clean)
                    .limit(1);

                if (rows && rows.length > 0 && rows[0].standard_word) {
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

// ─────────────────────────────────────────────
// PIPELINE
// ─────────────────────────────────────────────
async function handlePipeline(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { standard_word, meaning_ko, entry_type } = req.body;

    if (!standard_word || !meaning_ko) return res.status(400).json({ error: '필수값 누락' });
    if (standard_word.trim().length < 1 || standard_word.trim().length > 100)
        return res.status(400).json({ error: 'standard_word 길이 오류' });
    if (meaning_ko.trim().length < 1 || meaning_ko.trim().length > 100)
        return res.status(400).json({ error: 'meaning_ko 길이 오류' });

    try {
        const { data, error } = await supabase.rpc('approve_translation', {
            p_standard_word: standard_word.trim(),
            p_meaning_ko:    meaning_ko.trim(),
            p_entry_type:    entry_type || 'word'
        });

        if (error) throw new Error(error.message);
        return res.status(200).json(data);
    } catch (e) {
        console.error('[pipeline] 오류:', e.message);
        return res.status(500).json({ error: e.message });
    }
}

// ─────────────────────────────────────────────
// GET CONFLICTS
// ─────────────────────────────────────────────
async function handleGetConflicts(req, res) {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

    try {
        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/tp_conflicts?select=word,meaning_northern,meaning_southern,meaning_ko,severity,note`,
            {
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`
                }
            }
        );
        const data = await response.json();
        return res.status(200).json(data);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

// ─────────────────────────────────────────────
// GET DICTIONARY
// ─────────────────────────────────────────────
async function handleGetDictionary(req, res) {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

    try {
        const r1 = await fetch(
            `${SUPABASE_URL}/rest/v1/tp_translations?select=standard_word,southern_word,meaning_ko,part_of_speech&limit=10000`,
            { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
        );
        const translations = await r1.json();

        const r2 = await fetch(
            `${SUPABASE_URL}/rest/v1/tb_dictionary?select=standard_vi,southern_vi,meaning_kr,type&limit=10000`,
            { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
        );
        const dictionary = await r2.json();

        const merged = [
            ...translations.map(d => ({
                standard: d.standard_word?.toLowerCase(),
                southern: d.southern_word,
                meaning: d.meaning_ko,
                type: d.part_of_speech || '단어'
            })),
            ...dictionary.map(d => ({
                standard: d.standard_vi?.toLowerCase(),
                southern: d.southern_vi,
                meaning: d.meaning_kr,
                type: d.type || '단어'
            }))
        ];

        return res.status(200).json(merged);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

// ─────────────────────────────────────────────
// SOUTHERN FILL
// ─────────────────────────────────────────────
const BATCH_SIZE  = 10;
const BATCH_DELAY = 1500;
const RETRY_DELAY = 3000;

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
                generationConfig: { temperature: 0.1, maxOutputTokens: 512 },
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

    let southernWords;
    try {
        southernWords = await askGeminiSouthern(words);
    } catch (e) {
        await new Promise(r => setTimeout(r, RETRY_DELAY));
        southernWords = await askGeminiSouthern(words);
    }

    const errors  = [];
    let   updated = 0;

    for (let j = 0; j < batch.length; j++) {
        const southernWord = southernWords[j] || batch[j].standard_word;

        const { error: updateErr } = await supabase
            .from('tp_translations')
            .update({ southern_word: southernWord.trim(), status: 'approved' })
            .eq('id', batch[j].id);

        if (updateErr) errors.push({ id: batch[j].id, error: updateErr.message });
        else updated++;
    }

    return { updated, errors };
}

async function handleSouthernFill(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { data: rows, error: fetchErr } = await supabase
            .from('tp_translations')
            .select('id, standard_word, southern_word')
            .eq('status', 'pending')
            .eq('source', 'auto')
            .limit(50);

        if (fetchErr) throw new Error(fetchErr.message);
        if (!rows || rows.length === 0)
            return res.status(200).json({ message: '처리할 데이터 없음', updated: 0 });

        const targets = rows.filter(r => r.southern_word === r.standard_word);
        if (targets.length === 0)
            return res.status(200).json({ message: '처리할 데이터 없음', updated: 0 });

        let totalUpdated = 0;
        const allErrors  = [];

        for (let i = 0; i < targets.length; i += BATCH_SIZE) {
            const batch    = targets.slice(i, i + BATCH_SIZE);
            const batchNum = Math.floor(i / BATCH_SIZE) + 1;

            try {
                const { updated, errors } = await processBatch(batch);
                totalUpdated += updated;
                if (errors.length > 0) allErrors.push(...errors);
            } catch (e) {
                allErrors.push({ batch: batchNum, error: e.message });
            }

            if (i + BATCH_SIZE < targets.length)
                await new Promise(r => setTimeout(r, BATCH_DELAY));
        }

        return res.status(200).json({
            message: '완료',
            total:   targets.length,
            updated: totalUpdated,
            errors:  allErrors.length > 0 ? allErrors : undefined,
        });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
}

// ─────────────────────────────────────────────
// CORELINK (로그 저장)
// ─────────────────────────────────────────────
async function handleCorelink(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

    try {
        const {
            type, input, standard_vi, southern_vi,
            is_southern, direction, emotion_score,
            session_id, timestamp, detected_dialect, final_dialect
        } = req.body;

        if (type !== 'translate') return res.status(200).json({ ok: true });

        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/tb_trans_logs`,
            {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify({
                    source_text:      input || null,
                    standard_vi:      standard_vi || null,
                    southern_vi:      southern_vi || null,
                    is_southern:      is_southern || false,
                    direction:        direction || null,
                    emotion_score:    emotion_score || 0,
                    session_id:       session_id || null,
                    detected_dialect: detected_dialect || null,
                    final_dialect:    final_dialect || null,
                    keywords:         [],
                    created_at:       timestamp ? new Date(timestamp).toISOString() : new Date().toISOString()
                })
            }
        );

        if (!response.ok) throw new Error(await response.text());
        return res.status(200).json({ ok: true });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
}

// ─────────────────────────────────────────────
// MAIN ROUTER
// ─────────────────────────────────────────────
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const action = req.query.action || req.body?.action;

    switch (action) {
        case 'translate':      return handleTranslate(req, res);
        case 'pipeline':       return handlePipeline(req, res);
        case 'get-conflicts':  return handleGetConflicts(req, res);
        case 'get-dictionary': return handleGetDictionary(req, res);
        case 'southern-fill':  return handleSouthernFill(req, res);
        case 'corelink':       return handleCorelink(req, res);
        default:
            return res.status(400).json({ error: 'action 파라미터 필요 (translate | pipeline | get-conflicts | get-dictionary | southern-fill | corelink)' });
    }
}