export default async function handler(req, res) {
    const { text, target } = req.query;
    const KEY = 'b7d91801-1316-448a-9896-dea29a271183:fx';

    if (!text || !target) {
        return res.status(400).json({ error: '데이터 누락' });
    }

    try {
        const response = await fetch(`https://api-free.deepl.com/v2/translate?auth_key=${KEY}&text=${encodeURIComponent(text)}&target_lang=${target}`);
        const data = await response.json();
        
        // 브라우저에 데이터를 던져주기 위한 통행증 발급
        res.status(200).json(data);
    } catch (error) {
        res.status(500).json({ error: 'DeepL 통신 장애' });
    }
}
