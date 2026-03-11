// ============================================================
// BRAINPOOL | CoreRing api/pipeline.js v1.0
// 자동 데이터셋 파이프라인 - RPC 트랜잭션 처리
// ============================================================

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { standard_word, meaning_ko, entry_type } = req.body;

    // 입력값 검증
    if (!standard_word || !meaning_ko) {
        return res.status(400).json({ error: '필수값 누락' });
    }
    if (standard_word.trim().length < 1 || standard_word.trim().length > 100) {
        return res.status(400).json({ error: 'standard_word 길이 오류' });
    }
    if (meaning_ko.trim().length < 1 || meaning_ko.trim().length > 100) {
        return res.status(400).json({ error: 'meaning_ko 길이 오류' });
    }

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