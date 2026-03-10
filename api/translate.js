// ============================================================
// BRAINPOOL | CoreRing translate.js v2.0
// DB 우선 조회 → 미스 시 DeepL 호출
// v2.0: tp_translations DB 히트 시 DeepL 호출 생략
// ============================================================

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY  // RLS 우회용 service role
);

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');

    const { text, target } = req.query;
    const KEY = process.env.DEEPL_API_KEY;

    if (!text) return res.status(400).json({ error: '텍스트 누락' });

    const clean = text.trim().toLowerCase();

    // ── ① DB 우선 조회 ───────────────────────────────────────
    // 단어 단위 (공백 없는 단일 토큰)일 때만 DB 조회
    // 문장(공백 포함)은 DeepL로 바로 보냄
    const isSingleWord = !clean.includes(' ');

    if (isSingleWord) {
        try {
            const { data: rows } = await supabase
                .from('tp_translations')
                .select('standard_word, southern_word, meaning_ko, meaning_en, dialect')
                .or(`standard_word.ilike.${clean},southern_word.ilike.${clean}`)
                .limit(1);

            if (rows && rows.length > 0) {
                const row = rows[0];

                // KO→VI: meaning_ko로 들어온 경우는 standard_word 반환
                // VI→KO: standard_word/southern_word로 들어온 경우 meaning_ko 반환
                let translated = '';

                if (target === 'KO') {
                    // 베트남어 → 한국어
                    translated = row.meaning_ko || '';
                } else {
                    // 한국어 → 베트남어: meaning_ko로 역방향 조회
                    const { data: reverseRows } = await supabase
                        .from('tp_translations')
                        .select('standard_word, southern_word')
                        .ilike('meaning_ko', clean)
                        .limit(1);

                    if (reverseRows && reverseRows.length > 0) {
                        translated = reverseRows[0].standard_word || '';
                    }
                }

                if (translated) {
                    console.log(`[translate] DB hit: "${text}" → "${translated}"`);
                    // DeepL 호환 응답 구조 유지
                    return res.status(200).json({
                        translations: [{ text: translated }],
                        source: 'db',
                    });
                }
            }
        } catch (dbErr) {
            // DB 오류 시 DeepL fallback (서비스 중단 방지)
            console.error('[translate] DB lookup error, fallback to DeepL:', dbErr.message);
        }
    }

    // ── ② DeepL fallback ─────────────────────────────────────
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
        return res.status(200).json({ ...data, source: 'deepl' });
    } catch (error) {
        return res.status(500).json({ error: 'DeepL 통신 실패' });
    }
}
```

---

**동작 흐름**
```
입력: "ba" (단일 단어)
  ↓
DB 조회: tp_translations WHERE standard_word ILIKE 'ba'
  ↓ 히트
meaning_ko: "아빠" 반환 → DeepL 호출 없음
  ↓ 미스
DeepL 호출 → "그들" (기존 동작)
```
```
입력: "ba đang ở đâu" (문장)
  ↓
isSingleWord = false → 바로 DeepL