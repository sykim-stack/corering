// ============================================================
// BRAINPOOL | CoreChat — 통합 API v1.0
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

async function handleChat(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const { text, history = [], softTone = false, role = 'unknown', dialect = 'vi_south' } = req.body;
    if (!text) return res.status(400).json({ error: 'text is required' });
    const dialectGuide = dialect === 'vi_north' ? '베트남 북부(하노이) 구어체 기준으로 번역.' : dialect === 'vi_south' ? '베트남 남부(호치민) 구어체 기준으로 번역.' : '표준 베트남어 기준으로 번역.';
    const SYSTEM_PROMPT = `당신은 한국-베트남 부부 통역사입니다.\n${dialectGuide}\n규칙:\n1. 번역 결과만 출력. 설명 절대 금지.\n2. 괄호, 태그, 안내문구 절대 금지.\n3. 자연스럽고 따뜻한 톤 유지.\n4. 한 줄로만 출력.`;
    const isKorean = /[ㄱ-ㅎ|가-힣]/.test(text);
    const direction = isKorean ? 'KO→VI' : 'VI→KO';
    const targetLang = isKorean ? '베트남어' : '한국어';
    const toneGuide = softTone ? '\n⚠️ 현재 감정 긴장 상태. 모든 표현을 최대한 부드럽고 따뜻하게 번역할 것.' : '';
    const contextText = history.slice(-5).map((log, i) => `[대화 ${i + 1}] 원문: "${log.input}" → 번역: "${log.output}"`).join('\n');
    const contextGuide = contextText ? `\n[이전 대화 맥락]\n${contextText}\n위 맥락을 참고해서 번역하세요.` : '';
    const fullPrompt = `${SYSTEM_PROMPT}${toneGuide}${contextGuide}\n\n다음 문장을 ${targetLang}로 번역하세요:\n"${text}"`;
    try {
        const geminiRes = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
            body: JSON.stringify({ contents: [{ parts: [{ text: fullPrompt }] }], generationConfig: { temperature: 0.3, maxOutputTokens: 512 } }),
        });
        if (!geminiRes.ok) { const err = await geminiRes.json(); throw new Error(err.error?.message || 'Gemini API 오류'); }
        const geminiData = await geminiRes.json();
        const translated = geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (!translated) throw new Error('번역 결과 없음');
        return res.status(200).json({ translated, direction, softTone });
    } catch (e) { return res.status(500).json({ error: e.message }); }
}

async function handleLog(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
    try {
        const { user_id, source_locale, target_locale, input_text, output_text, engine_used, emotion_score, conflict_detected } = req.body;
        if (!input_text || !output_text || !engine_used) return res.status(400).json({ error: 'input_text, output_text, engine_used 필수' });
        const response = await fetch(`${SUPABASE_URL}/rest/v1/translation_logs`, {
            method: 'POST',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
            body: JSON.stringify({ user_id: user_id || null, source_locale: source_locale || null, target_locale: target_locale || null, input_text, output_text, engine_used, emotion_score: emotion_score ?? null, conflict_detected: conflict_detected ?? false })
        });
        if (!response.ok) throw new Error(await response.text());
        return res.status(200).json({ ok: true });
    } catch (e) { return res.status(500).json({ error: e.message }); }
}

async function handleGetRooms(req, res) {
    const { data, error } = await supabaseAnon.from('chat_rooms').select('*').order('created_at', { ascending: false });
    if (error) return res.status(500).json(error);
    return res.json(data);
}

async function handleCreateRoom(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const { user_id, room_type = 'dm', space_id = null } = req.body;
    const { data: room, error } = await supabaseService
        .from('chat_rooms')
        .insert({ room_type, created_by: user_id || null, space_id })
        .select()
        .single();
    if (error) return res.status(500).json(error);
    return res.json(room);
}

async function handleGetMessages(req, res) {
    const { room_id } = req.query;
    const { data, error } = await supabaseAnon.from('chat_messages').select('*').eq('room_id', room_id).order('created_at', { ascending: true });
    if (error) return res.status(500).json(error);
    return res.json(data);
}

async function handleSendMessage(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const { room_id, sender_id, message } = req.body;
    const { data, error } = await supabaseService.from('chat_messages').insert({ room_id, sender_id, message }).select();
    if (error) return res.status(500).json(error);
    return res.json(data);
}

async function handleJoinRoom(req, res) {
    if (req.method !== 'POST') return res.status(405).end();
    const { invite_code, nickname, role = 'guest' } = req.body;
    const { data: room, error } = await supabaseService
        .from('chat_rooms')
        .select('*')
        .eq('invite_code', invite_code.toUpperCase())
        .single();
    if (error) return res.status(404).json({ error: '존재하지 않는 초대 코드입니다.' });
    await supabaseService.from('chat_participants').insert({
        room_id: room.id,
        nickname: nickname || null,
        role
    });
    return res.json(room);
}

async function handleCreateSpace(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const { room_id, space_type } = req.body;
    const { data, error } = await supabaseService.from('spaces').insert({ room_id, space_type }).select();
    if (error) return res.status(500).json(error);
    return res.json(data);
}

export default async function handler(req, res) {
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
        case 'get-messages':  return handleGetMessages(req, res);
        case 'send-message':  return handleSendMessage(req, res);
        case 'join-room':     return handleJoinRoom(req, res);
        case 'create-space':  return handleCreateSpace(req, res);
        default:
            return res.status(400).json({ error: 'action 파라미터 필요' });
    }
}