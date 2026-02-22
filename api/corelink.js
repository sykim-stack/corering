export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

    try {
        const {
            type, input, standard_vi, southern_vi,
            is_southern, direction, emotion_score,
            session_id, timestamp,
            detected_dialect, final_dialect
        } = req.body;

        if (type !== 'translate') {
            return res.status(200).json({ ok: true });
        }

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
                    source_text: input || null,
                    standard_vi: standard_vi || null,
                    southern_vi: southern_vi || null,
                    is_southern: is_southern || false,
                    direction: direction || null,
                    emotion_score: emotion_score || 0,
                    session_id: session_id || null,
                    detected_dialect: detected_dialect || null,
                    final_dialect: final_dialect || null,
                    keywords: [],
                    created_at: timestamp ? new Date(timestamp).toISOString() : new Date().toISOString()
                })
            }
        );

        if (!response.ok) {
            const err = await response.text();
            throw new Error(err);
        }

        return res.status(200).json({ ok: true });
    } catch (e) {
        console.error('CORELINK error:', e);
        return res.status(500).json({ error: e.message });
    }
}