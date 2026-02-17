export default async function handler(req, res) {
    // CORS 허용
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    const { text, target } = req.query;
    const KEY = 'b7d91801-1316-448a-9896-dea29a271183:fx';

    if (!text) return res.status(400).json({ error: '텍스트가 없습니다.' });

    try {
        // DeepL API 호출 (URL 파라미터 방식으로 변경하여 가장 확실하게 전달)
        const deepLUrl = `https://api-free.deepl.com/v2/translate?auth_key=${KEY}&text=${encodeURIComponent(text)}&target_lang=${target}`;
        
        const response = await fetch(deepLUrl, { method: 'GET' });
        const data = await response.json();

        // 성공 응답
        if (data.translations) {
            return res.status(200).json(data);
        } else {
            // DeepL이 에러 메시지를 보냈을 경우
            return res.status(500).json({ error: 'DeepL 응답 오류', details: data });
        }
    } catch (error) {
        return res.status(500).json({ error: '서버 내부 오류', message: error.message });
    }
}
