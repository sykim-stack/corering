export default async function handler(req, res) {
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

        res.status(200).json(merged);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}