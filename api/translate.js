// 코드 맨 위와 맨 아래에 종료 로직을 명확히 합니다.
export default async function handler(req, res) {
    // 타임아웃 방지: 10초 넘으면 강제 종료
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
        const { text, target } = req.query;
        const KEY = 'b7d91801-1316-448a-9896-dea29a271183:fx';

        const response = await fetch('https://api-free.deepl.com/v2/translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `auth_key=${KEY}&text=${encodeURIComponent(text)}&target_lang=${target}`,
            signal: controller.signal
        });

        const data = await response.json();
        clearTimeout(timeout);
        return res.status(200).json(data); // return을 붙여 확실히 끝냅니다.

    } catch (error) {
        clearTimeout(timeout);
        return res.status(500).json({ error: '터널 정체 또는 키 오류' });
    }
}
