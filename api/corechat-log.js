export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

    try {
        const {
            user_id,
            source_locale,
            target_locale,
            input_text,
            output_text,
            engine_used,
            emotion_score,
            conflict_detected
        } = req.body;

        if (!input_text || !output_text || !engine_used) {
            return res.status(400).json({ error: 'input_text, output_text, engine_used 필수' });
        }

        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/translation_logs?select=id`,
            {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal',
                    'Accept-Profile': 'corechat'
                },
                body: JSON.stringify({
                    user_id: user_id || null,
                    source_locale: source_locale || null,
                    target_locale: target_locale || null,
                    input_text,
                    output_text,
                    engine_used,
                    emotion_score: emotion_score ?? null,
                    conflict_detected: conflict_detected ?? false
                })
            }
        );

        if (!response.ok) {
            const err = await response.text();
            throw new Error(err);
        }

        return res.status(200).json({ ok: true });

    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
}