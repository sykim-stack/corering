// ============================================================
// BRAINPOOL | CoreChat — 통합 API v2.1
// ============================================================

import { createClient } from '@supabase/supabase-js';

const supabaseService = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const supabaseAnon = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

// corechat 스키마 직접 fetch 헬퍼
async function corechatFetch(path, method = 'GET', body = null) {
    const url = `${process.env.SUPABASE_URL}/rest/v1/${path}`;
    const headers = {
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
    };
    const res = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : null,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(JSON.stringify(data));
    return data;
}

// ─────────────────────────────────────────────
// CHAT (Gemini 번역)
// ─────────────────────────────────────────────
async function handleChat(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { text, history = [], softTone = false, dialect = 'vi_south' } = req.body;
    if (!text) return res.status(400).json({ error: 'text is required' });

    const dialectGuide =
        dialect === 'vi_north' ? '베트남 북부(하노이) 구어체 기준으로 번역.' :
        dialect === 'vi_south' ? '베트남 남부(호치민) 구어체 기준으로 번역.' :
        '표준 베트남어 기준으로 번역.';

    const SYSTEM_PROMPT = `
당신은 한국-베트남 부부 통역사입니다.
${dialectGuide}
규칙:
1. 번역 결과만 출력. 설명 절대 금지.
2. 괄호, 태그, 안내문구 절대 금지.
3. 자연스럽고 따뜻한 톤 유지.
4. 한 줄로만 출력.
`.trim();

    const isKorean   = /[ㄱ-ㅎ|가-힣]/.test(text);
    const direction  = isKorean ? 'KO→VI' : 'VI→KO';
    const targetLang = isKorean ? '베트남어' : '한국어';

    const toneGuide = softTone
        ? '\n⚠️ 현재 감정 긴장 상태. 모든 표현을 최대한 부드럽고 따뜻하게 번역할 것.'
        : '';

    const contextText = history.slice(-5).map((log, i) =>
        `[대화 ${i + 1}] 원문: "${log.input}" → 번역: "${log.output}"`
    ).join('\n');

    const contextGuide = contextText
        ? `\n[이전 대화 맥락]\n${contextText}\n위 맥락을 참고해서 번역하세요.`
        : '';

    const fullPrompt = `${SYSTEM_PROMPT}${toneGuide}${contextGuide}\n\n다음 문장을 ${targetLang}로 번역하세요:\n"${text}"`;

    try {
        const geminiRes = await fetch(
            'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': process.env.GEMINI_API_KEY,
                },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: fullPrompt }] }],
                    generationConfig: { temperature: 0.3, maxOutputTokens: 512 },
                }),
            }
        );
        if (!geminiRes.ok) {
            const err = await geminiRes.json();
            throw new Error(err.error?.message || 'Gemini API 오류');
        }
        const geminiData = await geminiRes.json();
        const translated = geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (!translated) throw new Error('번역 결과 없음');
        return res.status(200).json({ translated, direction, softTone });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
}

// ─────────────────────────────────────────────
// LOG
// ─────────────────────────────────────────────
async function handleLog(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    try {
        const {
            user_id, source_locale, target_locale,
            input_text, output_text, engine_used,
            emotion_score, conflict_detected
        } = req.body;
        if (!input_text || !output_text || !engine_used)
            return res.status(400).json({ error: 'input_text, output_text, engine_used 필수' });
        const response = await fetch(
            `${process.env.SUPABASE_URL}/rest/v1/translation_logs`,
            {
                method: 'POST',
                headers: {
                    'apikey': process.env.SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal',
                    'Accept-Profile': 'corechat',
                    'Content-Profile': 'corechat',
                },
                body: JSON.stringify({
                    user_id: user_id || null,
                    source_locale: source_locale || null,
                    target_locale: target_locale || null,
                    input_text, output_text, engine_used,
                    emotion_score: emotion_score ?? null,
                    conflict_detected: conflict_detected ?? false
                })
            }
        );
        if (!response.ok) throw new Error(await response.text());
        return res.status(200).json({ ok: true });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
}

// ─────────────────────────────────────────────
// CREATE ROOM (연쇄: CoreID → 방 → 집)
// ─────────────────────────────────────────────
async function handleCreateRoom(req, res) {
    if (req.method !== 'POST') return res.status(405).end();

    const { device_id, room_type = 'dm' } = req.body;
    if (!device_id) return res.status(400).json({ error: 'device_id 필수' });

    // ── Step 1: CoreID 확정 (public.core_users) ──
    let coreUser;
    try {
        const { data: existing, error: findErr } = await supabaseService
            .from('core_users')
            .select('*')
            .eq('device_id', device_id)
            .limit(1);

        if (findErr) throw new Error('core_users 조회 실패: ' + findErr.message);

        if (existing && existing.length > 0) {
            coreUser = existing[0];
        } else {
            const coreId = 'core_user_' + Math.random().toString(36).slice(2, 8).toUpperCase();
            const { data: created, error: createErr } = await supabaseService
                .from('core_users')
                .insert({ core_id: coreId, device_id })
                .select()
                .single();

            if (createErr) throw new Error('core_users 생성 실패: ' + createErr.message);
            coreUser = created;
        }
    } catch (e) {
        // Step 1 실패 → 즉시 종료, Step 2 절대 실행 안 됨
        return res.status(500).json({ error: 'Step1 실패', detail: e.message });
    }

    // ── Step 2: CoreChat 방 생성 ──
    let room;
    try {
        const { data, error: roomErr } = await supabaseService
            .from('chat_rooms')
            .insert({
                room_type,
                owner_device_id: device_id,
                core_user_id: coreUser.id,
                is_permanent: true,
            })
            .select()
            .single();

        if (roomErr) throw new Error('chat_rooms 생성 실패: ' + roomErr.message);
        room = data;
    } catch (e) {
        return res.status(500).json({ error: 'Step2 실패', detail: e.message });
    }

 // ── Step 3: CoreNull 집 자동 생성 (실패해도 방은 반환) ──
let house = null;
try {
    const slug = 'house_' + coreUser.core_id.replace('core_user_', '').toLowerCase();
    const { data, error: houseErr } = await supabaseService
        .schema('corenull')
        .from('houses')
        .insert({
            slug,
            core_user_id: coreUser.id,
            category: 'daily',
            name: slug,
        })
        .select()
        .single();

    if (houseErr) {
        console.error('Step3 경고 (집 생성 실패, 무시):', houseErr.message);
    } else {
        house = data;
    }
} catch (e) {
    console.error('Step3 예외 (무시):', e.message);
}

// ── Step 4: space_id 연결 (house 있을 때만) ──
if (house) {
    try {
        await supabaseService
            .from('chat_rooms')
            .update({ space_id: house.id })
            .eq('id', room.id);
    } catch (e) {
        console.error('Step4 경고:', e.message);
    }
}

return res.json({
    room:      { ...room, space_id: house?.id || null },
    core_user: coreUser,
    house:     house ? { id: house.id, slug: house.slug } : null,
});

// ─────────────────────────────────────────────
// DELETE ROOM
// ─────────────────────────────────────────────
async function handleDeleteRoom(req, res) {
    if (req.method !== 'POST') return res.status(405).end();

    const { room_id, device_id } = req.body;
    if (!room_id || !device_id) return res.status(400).json({ error: 'room_id, device_id 필수' });

    const { data: room, error: findErr } = await supabaseService
        .from('chat_rooms')
        .select('owner_device_id')
        .eq('id', room_id)
        .single();

    if (findErr) return res.status(404).json({ error: '방을 찾을 수 없습니다.' });
    if (room.owner_device_id !== device_id) return res.status(403).json({ ok: false, error: '권한 없음' });

    const { error } = await supabaseService
        .from('chat_rooms')
        .delete()
        .eq('id', room_id);

    if (error) return res.status(500).json(error);
    return res.json({ ok: true });
}

// ─────────────────────────────────────────────
// GET MESSAGES
// ─────────────────────────────────────────────
async function handleGetMessages(req, res) {
    const { room_id, after } = req.query;
    if (!room_id) return res.status(400).json({ error: 'room_id 필수' });

    let query = supabaseAnon
        .from('chat_messages')
        .select('*')
        .eq('room_id', room_id)
        .order('created_at', { ascending: true });

    if (after) query = query.gt('created_at', after);

    const { data, error } = await query;
    if (error) return res.status(500).json(error);
    return res.json(data);
}

// ─────────────────────────────────────────────
// SEND MESSAGE
// ─────────────────────────────────────────────
async function handleSendMessage(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { room_id, nickname, device_id, message, translated_ko = null, translated_vi = null } = req.body;
    if (!room_id || !message) return res.status(400).json({ error: 'room_id, message 필수' });

    const { data, error } = await supabaseService
        .from('chat_messages')
        .insert({ room_id, nickname, device_id, message, translated_ko, translated_vi })
        .select();

    if (error) return res.status(500).json(error);
    return res.json(data);
}

// ─────────────────────────────────────────────
// JOIN ROOM
// ─────────────────────────────────────────────
async function handleJoinRoom(req, res) {
    if (req.method !== 'POST') return res.status(405).end();

    const { invite_code, nickname = null, device_id = null } = req.body;
    if (!invite_code) return res.status(400).json({ error: 'invite_code 필수' });

    const { data: room, error } = await supabaseService
        .from('chat_rooms')
        .select('*')
        .eq('invite_code', invite_code.toUpperCase())
        .single();

    if (error) return res.status(404).json({ error: '존재하지 않는 초대 코드입니다.' });

    await supabaseService
        .from('chat_participants')
        .insert({ room_id: room.id, nickname, device_id });

    return res.json(room);
}

// ─────────────────────────────────────────────
// GET ROOMS
// ─────────────────────────────────────────────
async function handleGetRooms(req, res) {
    const { data, error } = await supabaseAnon
        .from('chat_rooms')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) return res.status(500).json(error);
    return res.json(data);
}

// ─────────────────────────────────────────────
// CREATE SPACE
// ─────────────────────────────────────────────
async function handleCreateSpace(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { room_id, space_type } = req.body;
    if (!room_id || !space_type) return res.status(400).json({ error: 'room_id, space_type 필수' });

    const { data, error } = await supabaseService
        .from('spaces')
        .insert({ room_id, space_type })
        .select();

    if (error) return res.status(500).json(error);
    return res.json(data);
}

// ─────────────────────────────────────────────
// MAIN ROUTER
// ─────────────────────────────────────────────
module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const action = req.query.action || req.body?.action;

    switch (action) {
        case 'chat':          return handleChat(req, res);
        case 'log':           return handleLog(req, res);
        case 'get-rooms':     return handleGetRooms(req, res);
        case 'create-room':   return handleCreateRoom(req, res);
        case 'delete-room':   return handleDeleteRoom(req, res);
        case 'get-messages':  return handleGetMessages(req, res);
        case 'send-message':  return handleSendMessage(req, res);
        case 'join-room':     return handleJoinRoom(req, res);
        case 'create-space':  return handleCreateSpace(req, res);
        default:
            return res.status(400).json({ error: 'action 파라미터 필요' });
    }
}