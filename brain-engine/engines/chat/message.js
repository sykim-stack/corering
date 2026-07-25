import { getStorage } from '../../connectors/storage.js';

function isUUID(str) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str || '');
}

async function sendMessage(ctx) {
  const { roomId, userId, original, meta = {} } = ctx.payload || {};
  if (!roomId || !userId || !original) return { ...ctx, _error: 'roomId, userId, original required' };
  if (!isUUID(roomId)) return { ...ctx, _error: 'roomId is not UUID: ' + roomId };
  const db = await getStorage();
  if (!db) return { ...ctx, _error: 'DB connection failed' };
  const { data: roomCheck2 } = await db.from('chat_rooms').select('id').eq('id', roomId).maybeSingle();
  if (!roomCheck2) return { ...ctx, _error: 'ROOM_DELETED', roomDeleted: true };
  const { data: roomCheck } = await db.from('chat_rooms').select('id').eq('id', roomId).maybeSingle();
  if (!roomCheck) return { ...ctx, _error: 'ROOM_DELETED', roomDeleted: true };
  // translations jsonb 구조: { ko: "...", vi: "...", en: null, ja: null }
  // ADR-002: messages.translations = 렌더링 편의용 Projection
  //          Language Knowledge의 Source of Truth = tb_trans_logs
  const translationsPayload = {};
  if (meta.translatedText && meta.targetLang) {
    translationsPayload[meta.targetLang] = meta.translatedText;
  }
  if (meta.detectedLanguage) {
    translationsPayload[meta.detectedLanguage] = original;
  }

  const { error: insertError } = await db.from('messages').insert({
    room_id:       roomId,
    user_id:       isUUID(userId) ? userId : null,
    device_id:     userId,
    type:          'chat',
    content:       original,
    language:      meta.detectedLanguage || null,
    translations:  translationsPayload,
    translated_ko: meta.targetLang === 'ko' ? meta.translatedText || null : null,
    // ADR-002: relations.tb_trans_log_id → Language Knowledge 참조
    relations: meta.tbTransLogId ? { tb_trans_log_id: meta.tbTransLogId } : {},
    meta: {
      emotion:         meta.emotion || null,
      riskScore:       meta.riskScore ?? 0,
      intent:          meta.intent || null,
      meaningScore:    meta.meaningScore ?? null,
      detectedDialect: meta.detectedDialect || 'unknown',
      isSouthern:      meta.isSouthern ?? false,
      culturalNote:    meta.culturalNote || null,
      detectedLanguage: meta.detectedLanguage || null,
      targetLang:      meta.targetLang || null,
    },
  });
  if (insertError) {
    console.error('[message] insert error:', insertError.message);
    return { ...ctx, _error: insertError.message };
  }
  const messageId = crypto.randomUUID();
  return { ...ctx, message: {
    messageId,
    roomId,
    userId,
    original,
    translations: {
      ko: meta.translations?.ko || null,
      vi: meta.translations?.vi || null,
    },
    emotion: meta.emotion || null,
    riskScore: meta.riskScore ?? 0,
    intent: meta.intent || null,
    timestamp: new Date().toISOString(),
  }};
}

async function getHistory(ctx) {
  const { roomId, limit = 50 } = ctx.payload || {};
  if (!roomId) return { ...ctx, _error: 'roomId required' };
  const db = await getStorage();
  if (!db) return { ...ctx, _error: 'DB connection failed' };
  const { data, error } = await db.from('messages')
    .select('*')
    .eq('room_id', roomId)
    .order('created_at', { ascending: false })
    .limit(Math.min(limit, 100));
  if (error) return { ...ctx, _error: error.message };
  return { ...ctx, messages: (data || []).map(m => {
    const detectedLang = m.language || m.meta?.detectedLanguage || null;
    const targetLang   = m.meta?.targetLang || (detectedLang === 'ko' ? 'vi' : 'ko');

    // ADR-002: translations 공식 컬럼 우선 (Projection)
    // fallback: meta.translatedText(구버전) → translated_ko
    const translationsCol = m.translations || {};
    const translatedText  =
      translationsCol[targetLang] ||
      m.translated_ko ||
      null;

    return {
      messageId:    m.id,
      roomId:       m.room_id,
      userId:       m.device_id || 'unknown',
      original:     m.content || '',
      translated:   translatedText,
      translations: Object.keys(translationsCol).length > 0
        ? translationsCol
        : { [targetLang]: translatedText },
      sourceLang:   detectedLang,
      targetLang,
      emotion:      m.meta?.emotion || null,
      riskScore:    m.meta?.riskScore ?? 0,
      intent:       m.meta?.intent || null,
      meaningScore: m.meta?.meaningScore ?? null,
      detectedDialect: m.meta?.detectedDialect || 'unknown',
      isSouthern:   m.meta?.isSouthern ?? false,
      culturalNote: m.meta?.culturalNote || null,
      timestamp:    m.created_at,
    };
  })};
}

const actionMap = { SEND_MESSAGE: sendMessage, GET_HISTORY: getHistory };

export async function ChatMessageEngine(ctx) {
  if (!ctx || ctx._error) return ctx;
  const handler = actionMap[ctx.type];
  if (!handler) return ctx;
  return await handler(ctx);
}

export default ChatMessageEngine;