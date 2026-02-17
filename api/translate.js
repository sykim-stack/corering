export default async function handler(req, res) {
    const { text, target } = req.query;
    const KEY = 'b7d91801-1316-448a-9896-dea29a271183:fx';
    
    try {
        const response = await fetch(`https://api-free.deepl.com/v2/translate?auth_key=${KEY}&text=${encodeURIComponent(text)}&target_lang=${target}`);
        const data = await response.json();
        
        // 브라우저에게 "이건 안전한 서버 데이터야"라고 속여서 전달합니다.
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.status(200).json(data);
    } catch (error) {
        res.status(500).json({ error: '서버 터널 통과 실패' });
    }
}
