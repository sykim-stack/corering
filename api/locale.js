// ============================================================
// BRAINPOOL | CoreRing
// api/locale.js — vi_locale 조회 및 저장
//
// GET  /api/locale       → profiles.vi_locale 조회
// POST /api/locale       → profiles.vi_locale 업데이트
// ============================================================

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY  // RLS 우회용 서비스키
);

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();

    // ─── 인증 확인 ────────────────────────────────────────────
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        // 비로그인 상태 → vi_locale 없음으로 응답 (모달 표시 트리거)
        return res.status(200).json({ vi_locale: null });
    }

    const token = authHeader.replace('Bearer ', '');

    // JWT로 유저 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
        return res.status(200).json({ vi_locale: null });
    }

    // ─── GET: vi_locale 조회 ─────────────────────────────────
    if (req.method === 'GET') {
        const { data, error } = await supabase
            .from('profiles')
            .select('vi_locale')
            .eq('id', user.id)
            .single();

        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ vi_locale: data?.vi_locale ?? null });
    }

    // ─── POST: vi_locale 저장 ────────────────────────────────
    if (req.method === 'POST') {
        const { vi_locale } = req.body;

        const VALID_LOCALES = ['vi_north', 'vi_south', 'vi_neutral'];
        if (!VALID_LOCALES.includes(vi_locale)) {
            return res.status(400).json({ error: '유효하지 않은 locale 값' });
        }

        const { error } = await supabase
            .from('profiles')
            .update({ vi_locale })
            .eq('id', user.id);

        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ success: true, vi_locale });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}