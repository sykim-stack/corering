export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    const { text, target } = req.query;
    
    // 사장님이 방금 주신 진짜 연료(Key)입니다.
    const KEY = 'b7d91801-1316-448a-9896-dea29a271183:fx';

    if (!text || !target) {
        return res.status(400).json({ error: '데이터가 비어있습니다.' });
    }

    try {
        const response = await fetch('https://api-free.deepl.com/v2/translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `auth_key=${KEY}&text=${encodeURIComponent(text)}&target_lang=${target}`
        });

        const data = await response.json();

        if (data.translations && data.translations.length > 0) {
            res.status(200).json(data);
        } else {
            // 키가 잘못되었거나 한도가 초과했을 경우 메시지 출력
            res.status(500).json({ error: data.message || 'DeepL 응답 거부' });
        }
    } catch (error) {
        res.status(500).json({ error: '서버 터널 통과 실패' });
    }
}
