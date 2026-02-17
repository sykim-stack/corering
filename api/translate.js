export default async function handler(req, res) {
    // 1. 보안 통행증 허용 (CORS 해결)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

    const { text, target } = req.query;
    const KEY = 'b7d91801-1316-448a-9896-dea29a271183:fx';

    if (!text || !target) {
        return res.status(400).json({ error: '데이터가 비어있습니다.' });
    }

    try {
        // 2. DeepL에 '정중하게' POST 방식으로 요청 (가장 확실한 방법)
        const response = await fetch('https://api-free.deepl.com/v2/translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `auth_key=${KEY}&text=${encodeURIComponent(text)}&target_lang=${target}`
        });

        const data = await response.json();

        // 3. 데이터가 제대로 왔는지 검증
        if (data.translations && data.translations.length > 0) {
            res.status(200).json(data);
        } else {
            console.error('DeepL 응답 오류:', data);
            res.status(500).json({ error: '번역 데이터 형식이 잘못되었습니다.' });
        }
    } catch (error) {
        res.status(500).json({ error: '서버 내부 통신 실패' });
    }
}
