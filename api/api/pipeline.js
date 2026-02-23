// ============================================================
// BRAINPOOL | CoreRing api/pipeline.js v2.0
// 실제 컬럼명 기준 수정: standard_word, meaning_ko
// ============================================================

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { standard_word, meaning_ko, entry_type } = req.body;

    if (!standard_word || !meaning_ko) {
        return res.status(400).json({ error: 'Missing fields' });
    }

    const { data, error } = await supabase.rpc('auto_save_translation', {
        p_standard_word: standard_word,
        p_meaning_ko:    meaning_ko,
        p_entry_type:    entry_type || 'word'
    });

    if (error) {
        console.error('[pipeline] RPC 오류:', error.message);
        return res.status(500).json({ error: error.message });
    }

    return res.status(200).json(data);
}