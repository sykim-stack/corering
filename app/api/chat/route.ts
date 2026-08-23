import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const traceId = crypto.randomUUID();
  try {
    const body = JSON.parse(await request.text());
    const { action } = body;

    console.log(`[chat] action=${action} traceId=${traceId}`);

    if (!action) {
      return NextResponse.json({ payload: null, _error: 'action required', traceId }, { status: 400 });
    }

    // ── send ──
    if (action === 'send') {
      const { roomId, userId, original, analyze = true } = body;
      if (!roomId || !userId || !original) {
        return NextResponse.json({ payload: null, _error: 'roomId, userId, original required', traceId }, { status: 400 });
      }

      // ── Step 1: 번역만 먼저 (동기) ──────────────────────────
      let translationMeta: any = {
        translations: {}, detectedLanguage: null, emotion: null, cultureHints: [],
        translatedText: null, targetLang: null,
        riskScore: 0, intent: null, meaningScore: null,
        detectedDialect: 'unknown', isSouthern: false, culturalNote: null,
      };

      if (analyze) {
        try {
          const { route: engineRoute } = await import('@/brain-engine/hajun/router.js');
          const { createCtx } = await import('@/brain-engine/contracts/ctx.js');
          let ctx = createCtx({ text: original, author: userId }, traceId);
          ctx = await engineRoute('translate', ctx);  // DeepL만 기다림

          const p = ctx.payload;
          const sourceLang = p.sourceLang || null;
          const targetLang = sourceLang === 'ko' ? 'vi' : 'ko';
          const translated = p.translatedText || null;

          translationMeta = {
            translations: translated ? { [targetLang]: translated } : {},
            detectedLanguage: sourceLang,
            emotion: null,
            cultureHints: [],
            translatedText: translated,
            targetLang,
            riskScore: 0,
            intent: null,
            meaningScore: null,
            detectedDialect: 'unknown',
            isSouthern: false,
            culturalNote: null,
            tbTransLogId: null, // ADR-002: tb_trans_logs 참조 ID
          };

          // ── Step 1.5: tb_trans_logs에 번역 결과 선제 저장 ────
          // Gemini 분석 전이라도 번역 결과를 먼저 저장하고 id를 확보
          // → messages.relations.tb_trans_log_id 연결용
          try {
            const { getStorage } = await import('@/brain-engine/connectors/storage.js');
            const db = await getStorage();
            if (db && translated) {
              const direction = sourceLang === 'ko' ? 'KO_VI' : 'VI_KO';
              const { data: logData } = await db
                .from('tb_trans_logs')
                .insert({
                  source_text: original,
                  standard_vi: translated,
                  direction,
                  trace_id: traceId,
                })
                .select('id')
                .single();
              if (logData?.id) {
                translationMeta.tbTransLogId = logData.id;
              }
            }
          } catch (e: any) {
            console.warn('[chat/send] tb_trans_logs 선제 저장 실패:', e.message);
          }

          // ── Step 2: Gemini 분석 + 푸시 알림 (백그라운드) ────
          Promise.resolve().then(async () => {
            try {
              let analysisCtx = { ...ctx };
              analysisCtx = await engineRoute('emotion', analysisCtx);
              if (!analysisCtx._error) analysisCtx = await engineRoute('dialect', analysisCtx);

              const ap = analysisCtx.payload;
              console.log(`[chat/send] 분석 완료 traceId=${traceId} emotion=${ap?.emotion} risk=${ap?.riskScore}`);

              // ── Language Knowledge: 어휘/구문 자동 추출 저장 (새 AI 호출 없음) ──
              try {
                const { saveVocabulary, savePhrase } = await import('@/brain-engine/connectors/storage.js');
                await saveVocabulary({ payload: { keywords: ap?.keywords, sourceLang, source: 'chat' } });
                if (ap?.contextType || translated) {
                  await savePhrase({
                    payload: {
                      text: original,
                      translatedText: translated,
                      sourceLang,
                      contextType: ap?.contextType,
                      source: 'chat',
                      logId: translationMeta.tbTransLogId,
                    },
                  });
                }
              } catch (e: any) {
                console.warn('[chat/send] Language Knowledge 저장 실패 (무시):', e.message);
              }

              // tb_trans_logs에 저장 (getWordData에서 분석값 읽어오기 위해)
              const { getStorage } = await import('@/brain-engine/connectors/storage.js');
              const db = await getStorage();
              if (db) {
                const sourceLangForLog = ctx.payload?.sourceLang || null;
                const direction = sourceLangForLog === 'ko' ? 'KO_VI' : 'VI_KO';
                const updatePayload = {
                  emotion:          ap?.emotion || 'neutral',
                  emotion_score:    ap?.emotionScore ?? 0.5,
                  risk_score:       ap?.riskScore ?? 0,
                  conflict_count:   ap?.conflictCount ?? 0,
                  intent:           ap?.intent || null,
                  meaning_score:    ap?.meaningScore ?? null,
                  meaning_reason:   ap?.meaningReason ?? null,
                  risk_reason:      ap?.riskReason ?? null,
                  detected_dialect: ap?.detectedDialect || 'unknown',
                  is_southern:      ap?.isSouthern ?? false,
                  cultural_notes:   ap?.culturalNote ? { warning: ap.culturalNote } : null,
                };
                // Step 1.5에서 미리 확보한 id로 바로 UPDATE
                const logId = translationMeta.tbTransLogId;
                if (logId) {
                  await db.from('tb_trans_logs').update(updatePayload).eq('id', logId);
                } else {
                  // fallback: source_text로 기존 행 찾아서 UPDATE 또는 INSERT
                  const { data: existing } = await db
                    .from('tb_trans_logs').select('id')
                    .eq('source_text', original).eq('direction', direction)
                    .order('created_at', { ascending: false }).limit(1);
                  const existingId = existing?.[0]?.id;
                  if (existingId) {
                    await db.from('tb_trans_logs').update(updatePayload).eq('id', existingId);
                  } else {
                    await db.from('tb_trans_logs').insert({
                      source_text: original,
                      standard_vi: ctx.payload?.translatedText || original,
                      direction,
                      ...updatePayload,
                    });
                  }
                }
              }

              // ── repetition_count 계산 (CoreHub 합의 스키마) ──────
              // intent 기준, 300초 윈도우, messages 테이블 한정.
              // tb_trans_logs의 frequency/consistency(배치 집계)와는 별개 로직.
              try {
                if (db && ap?.intent) {
                  const REPETITION_WINDOW_SEC = 300;
                  const windowStart = new Date(Date.now() - REPETITION_WINDOW_SEC * 1000).toISOString();

                  const { count, error: countError } = await db
                    .from('messages')
                    .select('id', { count: 'exact', head: true })
                    .eq('room_id', roomId)
                    .eq('device_id', userId)
                    .eq('meta->>intent', ap.intent)
                    .gte('created_at', windowStart);

                  if (countError) {
                    console.warn('[chat/send] repetition_count 조회 실패:', countError.message);
                  } else {
                    // 방금 보낸 메시지 행을 room_id+device_id+content로 재특정
                    const { data: targetRow, error: findError } = await db
                      .from('messages')
                      .select('id, meta')
                      .eq('room_id', roomId)
                      .eq('device_id', userId)
                      .eq('content', original)
                      .order('created_at', { ascending: false })
                      .limit(1)
                      .maybeSingle();

                    if (!findError && targetRow?.id) {
                      const repetitionCount = (count ?? 0) + 1; // 이번 메시지(자기 자신) 포함
                      const mergedMeta = {
                        ...(targetRow.meta || {}),
                        intent: ap.intent,
                        repetitionCount,
                        repetitionWindowSec: REPETITION_WINDOW_SEC,
                        repetitionBasis: 'intent',
                      };
                      const { error: updateError } = await db
                        .from('messages')
                        .update({ meta: mergedMeta })
                        .eq('id', targetRow.id);
                      if (updateError) {
                        console.warn('[chat/send] repetition_count 저장 실패:', updateError.message);
                      } else {
                        console.log(`[chat/send] repetition_count=${repetitionCount} intent=${ap.intent} messageId=${targetRow.id}`);
                      }
                    }
                  }
                }
              } catch (e: any) {
                console.warn('[chat/send] repetition_count 계산 예외:', e.message);
              }
            } catch (e: any) {
              console.warn('[chat/send] 백그라운드 분석 실패:', e.message);
            }

            // 푸시 알림도 백그라운드
            try {
              const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://corering.vercel.app';
              await fetch(appUrl + '/api/push/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ room_id: roomId, sender_id: userId, title: 'CoreRing', body: original.length > 50 ? original.slice(0, 50) + '...' : original, url: `/?room=${roomId}` }),
              }).catch(() => null);
            } catch (e) {}
          });

        } catch (e: any) {
          console.warn('[chat/send] translate failed:', e.message);
        }
      }

      // ── Step 3: DB 저장 + 즉시 응답 ─────────────────────────
      const flatMeta = {
        ...translationMeta,
        emotion: translationMeta.emotion?.primary || null,
      };
      const { ChatMessageEngine } = await import('@/brain-engine/engines/chat/message.js');
      const result: any = await ChatMessageEngine({ type: 'SEND_MESSAGE', payload: { roomId, userId, original, meta: flatMeta }, traceId, _error: null });
      if (result._error) return NextResponse.json({ payload: null, _error: result._error, traceId }, { status: 500 });
      return NextResponse.json({ payload: { message: result.message }, _error: null, traceId });
    }

    // ── poll ──
    if (action === 'poll') {
      const { roomId, limit = 50 } = body;
      if (!roomId) return NextResponse.json({ payload: null, _error: 'roomId required', traceId }, { status: 400 });
      console.log(`[chat/poll] roomId=${roomId}`);
      const { ChatMessageEngine } = await import('@/brain-engine/engines/chat/message.js');
      const result: any = await ChatMessageEngine({ type: 'GET_HISTORY', payload: { roomId, limit }, traceId, _error: null });
      console.log(`[chat/poll] done error=${result._error}`);
      if (result._error) return NextResponse.json({ payload: null, _error: result._error, traceId }, { status: 500 });
      return NextResponse.json({ payload: { messages: result.messages ?? [] }, _error: null, traceId });
    }

    // ── join ──
    if (action === 'join') {
      const { inviteCode } = body;
      if (!inviteCode) return NextResponse.json({ payload: null, _error: 'inviteCode required', traceId }, { status: 400 });
      const { ChatRoomEngine } = await import('@/brain-engine/engines/chat/room.js');
      const result: any = await ChatRoomEngine({ type: 'FIND_BY_CODE', payload: { inviteCode }, traceId, _error: null });
      if (result._error) return NextResponse.json({ payload: null, _error: result._error, traceId }, { status: 404 });
      return NextResponse.json({ payload: { room: result.payload.room }, _error: null, traceId });
    }

    // ── create ──
    if (action === 'create') {
      const { title, createdBy, tags, maxParticipants, isPublic = true } = body;
      if (!title) return NextResponse.json({ payload: null, _error: 'title required', traceId }, { status: 400 });
      const { ChatRoomEngine } = await import('@/brain-engine/engines/chat/room.js');
      const result: any = await ChatRoomEngine({ type: 'CREATE_ROOM', payload: { title, createdBy: createdBy || 'anonymous', tags: tags || [], maxParticipants: maxParticipants || 100, isPublic }, traceId, _error: null });
      if (result._error) return NextResponse.json({ payload: null, _error: result._error, traceId }, { status: 500 });
      return NextResponse.json({ payload: { room: result.room }, _error: null, traceId }, { status: 201 });
    }

    return NextResponse.json({ payload: null, _error: 'unknown action: ' + action, traceId }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ payload: null, _error: err.message, traceId }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const traceId = crypto.randomUUID();
  const { searchParams } = new URL(request.url);
  const roomId = searchParams.get('roomId');
  const limit = parseInt(searchParams.get('limit') || '50');

  if (!roomId) return NextResponse.json({ payload: null, _error: 'roomId required', traceId }, { status: 400 });

  try {
    const { ChatMessageEngine } = await import('@/brain-engine/engines/chat/message.js');
    const result: any = await ChatMessageEngine({ type: 'GET_HISTORY', payload: { roomId, limit }, traceId, _error: null });
    if (result._error) return NextResponse.json({ payload: null, _error: result._error, traceId }, { status: 500 });
    return NextResponse.json({ payload: { messages: result.messages ?? [] }, _error: null, traceId });
  } catch (err: any) {
    return NextResponse.json({ payload: null, _error: err.message, traceId }, { status: 500 });
  }
}