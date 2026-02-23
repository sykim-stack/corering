// ============================================================
// BRAINPOOL | CoreRing api/pipeline.js
// Vercel Serverless Function
// auto_save_translation RPC 호출
// ============================================================

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY  // service_role 키 (RLS 우회)
);

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { korean, vietnamese, direction } = req.body;

    if (!korean || !vietnamese || !direction) {
        return res.status(400).json({ error: 'Missing fields' });
    }

    const { data, error } = await supabase.rpc('auto_save_translation', {
        p_korean:      korean,
        p_vietnamese:  vietnamese,
        p_direction:   direction
    });

    if (error) {
        console.error('[pipeline] RPC 오류:', error.message);
        return res.status(500).json({ error: error.message });
    }

    return res.status(200).json(data);
}