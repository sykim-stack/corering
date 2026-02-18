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
        const { type, input, output, direction, word, meaning, original, translated, timestamp } = req.body;

        const { error } = await supabase
            .from('tb_trans_logs')
            .insert([{
                event_type: type,
                input_text: input || original || word || null,
                output_text: output || translated || meaning || null,
                direction: direction || null,
                created_at: new Date(timestamp).toISOString()
            }]);

        if (error) throw error;

        return res.status(200).json({ ok: true });
    } catch (e) {
        console.error('CORELINK error:', e);
        return res.status(500).json({ error: e.message });
    }
}