import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { type, input, standard_vi, southern_vi, is_southern, timestamp } = req.body;

        if (type !== 'translate') {
            return res.status(200).json({ ok: true });
        }

        const { error } = await supabase
            .from('tb_trans_logs')
            .insert([{
                source_text: input || null,
                standard_vi: standard_vi || null,
                southern_vi: southern_vi || null,
                is_southern: is_southern || false,
                keywords: [],
                created_at: new Date(timestamp).toISOString()
            }]);

        if (error) throw error;

        return res.status(200).json({ ok: true });
    } catch (e) {
        console.error('CORELINK error:', e);
        return res.status(500).json({ error: e.message });
    }
}
