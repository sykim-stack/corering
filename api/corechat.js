// ============================================================
// BRAINPOOL | CoreChat — 통합 API v2.2
// ============================================================

const { createClient } = require('@supabase/supabase-js');

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
    const url = `${.SUPABASE_URL}/rest/v1/${path}`;
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
// CHAT (Gemini 번역 + MindWorld 감정 연동)
// ─────────────────────────────────────────────

import { runMindWorld } from './mindworld.js';
import { calcEmotionScore } from './engine.js';

async function handleChat(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { text, history = [], dialect = 'vi_south' } = req.body;
    if (!text) return res.status(400).json({ error: 'text is required' });

    // ─────────────────────────
    // 1️⃣ 감정 분석 (CoreRing 핵심)
    // ─────────────────────────
    const rawScore = calcEmotionScore(text);

    const mw = runMindWorld({
        rawScore,
        inputText: text,
        sessionLogs: history,
        conflicts: []
    });

    const { rrp, intentState } = mw;

    // ─────────────────────────
    // 2️⃣ 톤 가이드 생성
    // ─────────────────────────
    const toneGuide = buildToneGuide({ rrp, intentState });

    // ─────────────────────────
    // 3️⃣ 사투리 설정
    // ─────────────────────────
    const dialectGuide =
        dialect === 'vi_north' ? '베트남 북부(하노이) 구어체 기준으로 번역.' :
        dialect === 'vi_south' ? '베트남 남부(호치민) 구어체 기준으로 번역.' :
        '표준 베트남어 기준으로 번역.';

    // ─────────────────────────
    // 4️⃣ 시스템 프롬프트
    // ─────────────────────────
    const SYSTEM_PROMPT = `
당신은 한국-베트남 부부 통역사입니다.
${dialectGuide}

규칙:
1. 번역 결과만 출력. 설명 절대 금지.
2. 괄호, 태그, 안내문구 절대 금지.
3. 자연스럽고 따뜻한 톤 유지.
4. 한 줄로만 출력.
`.trim();

    // ─────────────────────────
    // 5️⃣ 언어 방향
    // ─────────────────────────
    const isKorean   = /[ㄱ-ㅎ|가-힣]/.test(text);
    const direction  = isKorean ? 'KO→VI' : 'VI→KO';
    const targetLang = isKorean ? '베트남어' : '한국어';

    // ─────────────────────────
    // 6️⃣ 대화 맥락
    // ─────────────────────────
    const contextText = history.slice(-5).map((log, i) =>
        `[대화 ${i + 1}] 원문: "${log.input}" → 번역: "${log.output}"`
    ).join('\n');

    const contextGuide = contextText
        ? `\n[이전 대화 맥락]\n${contextText}\n위 맥락을 참고해서 번역하세요.`
        : '';

    // ─────────────────────────
    // 7️⃣ 최종 프롬프트
    // ─────────────────────────
    const fullPrompt = `${SYSTEM_PROMPT}${toneGuide}${contextGuide}

다음 문장을 ${targetLang}로 번역하세요:
"${text}"`;

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
                    generationConfig: {
                        temperature: 0.3,
                        maxOutputTokens: 512
                    },
                }),
            }
        );

        if (!geminiRes.ok) {
            const err = await geminiRes.json();
            throw new Error(err.error?.message || 'Gemini API 오류');
        }

        const geminiData = await geminiRes.json();

        let translated = geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (!translated) throw new Error('번역 결과 없음');

        // ─────────────────────────
        // 8️⃣ 후처리 (2차 안전장치)
        // ─────────────────────────
        translated = applyTonePostProcess({
            text: translated,
            rrp,
            intentState
        });

        return res.status(200).json({
            translated,
            direction,
            rrp,
            intentState
        });

    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
}

// ─────────────────────────────────────────
// 🔥 Tone Guide (LLM용)
// ─────────────────────────────────────────
function buildToneGuide({ rrp = 0, intentState = 'CALM' }) {

    if (rrp < 0.3 && intentState === 'CALM') {
        return '';
    }

    if (rrp < 0.7) {
        return `
⚠️ 대화에 약간의 긴장감이 있습니다.
직접적인 표현을 피하고, 부드럽고 정중하게 번역하세요.
`;
    }

    return `
⚠️ 현재 감정 갈등 상태입니다.
공격적 표현 금지.
완곡하고 조심스럽게 표현하세요.
상대 감정을 진정시키는 방향으로 번역하세요.
`;
}

// ─────────────────────────────────────────
// 🔥 후처리 (Rule 기반 안전장치)
// ─────────────────────────────────────────
function applyTonePostProcess({ text = '', rrp = 0, intentState = 'CALM' }) {

    if (rrp < 0.3) return text;

    // MEDIUM
    if (rrp < 0.7) {
        return text
            .replace(/야/g, '요')
            .replace(/해라/g, '해주세요')
            .replace(/왜/g, '혹시 왜');
    }

    // HIGH
    return `혹시 오해가 있을 수도 있어서 조심스럽게 말씀드리면, ${text}`;
}

export default handleChat;

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
// CHANGE START
async function handleCreateRoom(req, res) {
    if (req.method !== 'POST') return res.status(405).end();

    const { device_id, room_type = 'dm', room_name = null } = req.body; // ← room_name 추가
    if (!device_id) return res.status(400).json({ error: 'device_id 필수' });

    // ── Step 1: CoreID 확정 ──
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
        return res.status(500).json({ error: 'Step1 실패', detail: e.message });
    }

    const slug = 'house_' + Math.random().toString(36).slice(2, 8).toLowerCase();

    // ── Step 2: 방 생성 ──
    let room;
    try {
        const { data, error: roomErr } = await supabaseService
            .from('chat_rooms')
            .insert({
                room_type,
                room_name,           // ← 추가
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

    // ── Step 3: CoreNull 집 자동 생성 ──
    let house = null;
    let houseError = null;
    try {
        const { data, error: houseErr } = await supabaseService
            .schema('corenull')
            .from('houses')
            .insert({
                slug, name: slug,
                core_user_id: coreUser.id,
                house_type: 'family',
                category: 'daily',
                is_public: false,
            })
            .select()
            .single();

        if (houseErr) { houseError = houseErr.message; }
        else { house = data; }
    } catch (e) { houseError = e.message; }

    // ── Step 4: space_id 연결 ──
    if (house) {
        try {
            await supabaseService.from('chat_rooms').update({ space_id: house.id }).eq('id', room.id);
        } catch (e) { console.error('Step4 경고:', e.message); }
    }

    return res.json({
        room: { ...room, space_id: house?.id || null },
        core_user: coreUser,
        house: house ? { id: house.id, slug: house.slug } : null,
        house_error: houseError || null,
    });
}
// CHANGE END

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
// JOIN ROOM (Join-first 통합 구조 v2.3)
// ─────────────────────────────────────────────
async function handleJoinRoom(req, res) {
    if (req.method !== 'POST') return res.status(405).end();

    const { invite_code, nickname = null, device_id = null } = req.body;
    if (!invite_code) return res.status(400).json({ error: 'invite_code 필수' });

    const code = invite_code.toUpperCase();

    // ── Step 1: core_user 보장 (join-room에서 처리) ──
    if (device_id) {
        const { data: existingUser } = await supabaseService
            .from('core_users')
            .select('id')
            .eq('device_id', device_id)
            .limit(1);

        if (!existingUser || existingUser.length === 0) {
            const coreId = 'core_user_' + Math.random().toString(36).slice(2, 8).toUpperCase();
            await supabaseService
                .from('core_users')
                .insert({ core_id: coreId, device_id })
                .select()
                .single();
        }
    }

    // ── Step 2: room 조회 ──
    let room = null;
    const { data: existing } = await supabaseService
        .from('chat_rooms')
        .select('*')
        .eq('invite_code', code)
        .single();

    if (existing) {
        room = existing;
    } else {
        // ── Step 3: 없으면 생성 ──
        const { data: created, error: createErr } = await supabaseService
            .from('chat_rooms')
            .insert({
                invite_code:     code,
                room_type:       'dm',
                owner_device_id: device_id,
                is_permanent:    true,
            })
            .select()
            .single();

        if (createErr) {
            // Race condition: unique 충돌 → 재조회
            if (createErr.code === '23505') {
                const { data: retried } = await supabaseService
                    .from('chat_rooms')
                    .select('*')
                    .eq('invite_code', code)
                    .single();
                room = retried;
            } else {
                return res.status(500).json({ error: '방 생성 실패', detail: createErr.message });
            }
        } else {
            room = created;
        }
    }

    if (!room) return res.status(500).json({ error: '방을 찾을 수 없어요' });

    // ── Step 4: participant 중복 없이 등록 ──
    if (device_id) {
        const { data: existingParticipant } = await supabaseService
            .from('chat_participants')
            .select('id')
            .eq('room_id', room.id)
            .eq('device_id', device_id)
            .limit(1);

        if (!existingParticipant || existingParticipant.length === 0) {
            await supabaseService
                .from('chat_participants')
                .insert({ room_id: room.id, nickname, device_id });
        }
    }

    return res.json({
        ...room,
        joined:  true,
        created: !existing,
    });
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