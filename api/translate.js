export default async function handler(req, res) {
    // CORS 보안 허용
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

    const { text, target } = req.query;
    const KEY = 'b7d91801-1316-448a-9896-dea29a271183:fx';

    if (!text) {
        return res.status(400).json({ error: '텍스트가 없습니다.' });
    }

    try {
        // DeepL API 호출 (가장 안정적인 GET 파라미터 방식)
        const deepLUrl = `https://api-free.deepl.com/v2/translate?auth_key=${KEY}&text=${encodeURIComponent(text)}&target_lang=${target}`;
        
        const response = await fetch(deepLUrl);
        const data = await response.json();

        // 번역 데이터가 정상적으로 오면 클라이언트에 전달
        if (data && data.translations) {
            return res.status(200).json(data);
        } else {
            return res.status(500).json({ error: 'DeepL 응답 구조 이상', details: data });
        }
    } catch (error) {
        return res.status(500).json({ error: '서버 내부 통신 실패', message: error.message });
    }
}
