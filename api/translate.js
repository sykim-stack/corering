export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    const { text, target } = req.query;
    // 사장님의 진짜 키 (마지막까지 보안 유지)
    const KEY = 'b7d91801-1316-448a-9896-dea29a271183:fx';

    if (!text) return res.status(400).json({ error: '텍스트 누락' });

    try {
        // DeepL Free API 전용 본체 요청
        const response = await fetch('https://api-free.deepl.com/v2/translate', {
            method: 'POST',
            headers: {
                'Authorization': `DeepL-Auth-Key ${KEY}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                text: text,
                target_lang: target
            })
        });

        const data = await response.json();

        // 성공 시 데이터 반환
        if (data && data.translations) {
            return res.status(200).json(data);
        } else {
            // 여기가 핵심: DeepL이 뱉는 에러를 그대로 전달해서 정체를 밝힙니다.
            return res.status(500).json({ error: 'DeepL 인증/한도 오류', details: data.message || data });
        }
    } catch (error) {
        return res.status(500).json({ error: '서버 내부 통신 실패', message: error.message });
    }
}
