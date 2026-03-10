export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    const { text, target } = req.query;
    const KEY = process.env.DEEPL_API_KEY; // ✅ 환경변수로 변경

    if (!text) return res.status(400).json({ error: '텍스트 누락' });

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
        return res.status(200).json(data);
    } catch (error) {
        return res.status(500).json({ error: 'DeepL 통신 실패' });
    }
}