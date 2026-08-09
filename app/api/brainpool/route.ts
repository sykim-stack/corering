import type { NextRequest } from 'next/server';
import { route } from '@/brain-engine/hajun/router.js';
import { createCtx } from '@/brain-engine/contracts/ctx.js';

export async function POST(request: NextRequest) {
  const traceId = crypto.randomUUID();
  let body: {
    action?: string;
    text?: string;
    sourceText?: string;
    author?: string;
    device_id?: string;
    targetLang?: string;
    context_category?: string;
    payload?: { text?: string };
  };

  try {
    const raw = await request.text();
    body = JSON.parse(raw);
  } catch {
    return new Response(
      JSON.stringify({ payload: null, _error: 'PARSE_FAIL', traceId }),
      { status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  }

  const action = body.action || 'translate';

  // ── action: learn ──────────────────────────────────────────
  if (action === 'learn') {
    const device_id =
      body.device_id ||
      request.headers.get('x-device-id') ||
      `dev_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    const text = body.text || body.sourceText || '';
    if (!text) {
      return new Response(
        JSON.stringify({ payload: null, _error: 'text required', traceId }),
        { status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
      );
    }

    const ctx = {
      device_id,
      payload: {
        sourceText: text,
        targetLang: body.targetLang || 'vi',
        context_category: body.context_category || 'daily',
      },
      traceId,
      _error: null,
    };

    const resultCtx = await route('translate', ctx);

    if (resultCtx._error) {
      return new Response(
        JSON.stringify({ payload: null, _error: resultCtx._error, traceId }),
        { status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
      );
    }

    return new Response(
      JSON.stringify({
        payload: {
          translated: resultCtx.payload.translated || resultCtx.payload.translatedText,
          asset_id: resultCtx.payload.asset_id || null,
          fromCache: resultCtx.payload.fromCache || false,
          device_id,
        },
        _error: null,
        traceId,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  }

  // ── action: translate (기본) ───────────────────────────────
  const text = body.text || body.payload?.text || '';
  if (!text) {
    return new Response(
      JSON.stringify({ payload: null, _error: 'text required', traceId }),
      { status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  }

  try {
    let ctx = createCtx({ text, author: body.author || 'anonymous' }, traceId);
    ctx = await route('translate', ctx);

    if (ctx._error) {
      return new Response(
        JSON.stringify({ payload: null, _error: ctx._error, traceId }),
        { status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
      );
    }

    const p = ctx.payload;
    const sourceLang = p.sourceLang || null;
    const targetLang = sourceLang === 'ko' ? 'vi' : 'ko';

    // ── 번역 결과 즉시 반환 ──────────────────────────────────
    // Gemini 분석(emotion, dialect)은 응답 후 백그라운드에서 실행
    // → 채팅창에 번역 결과가 바로 보이고, 분석값은 나중에 DB에 저장됨
    const responsePayload = {
      id: crypto.randomUUID(),
      type: 'post',
      author: p.author || 'anonymous',
      createdAt: Date.now(),
      original: p.text,
      translated: p.translatedText || p.text,
      sourceLang,
      targetLang,
      translationSource: p.translationSource || 'unknown',
      // 분석값은 백그라운드 완료 전엔 null — 카드 클릭 시 캐시에서 읽어옴
      emotionScore: null,
      emotion: null,
      riskScore: 0,
      intent: null,
      meaningScore: null,
      detectedDialect: 'unknown',
      isSouthern: false,
      culturalNote: null,
    };

    // ── 백그라운드 분석 (fire-and-forget) ───────────────────
    // waitUntil 없이도 Vercel 서버리스에서 응답 후 짧게 살아있는 동안 실행됨
    // 실패해도 번역 결과에 영향 없음
    Promise.resolve().then(async () => {
      try {
        let analysisCtx = { ...ctx };
        analysisCtx = await route('emotion', analysisCtx);
        if (!analysisCtx._error) {
          analysisCtx = await route('dialect', analysisCtx);
        }

        const ap = analysisCtx.payload;
        const logId = ctx.payload?.logId;

        console.log(
          `[brainpool] 분석 완료 traceId=${traceId}`,
          `emotion=${ap?.emotion} risk=${ap?.riskScore}`,
          `dialect=${ap?.detectedDialect} logId=${logId}`
        );

        // ── Language Knowledge: 어휘/구문 자동 추출 저장 (새 AI 호출 없음) ──
        try {
          const { saveVocabulary, savePhrase } = await import('@/brain-engine/connectors/storage.js');
          await saveVocabulary({ payload: { keywords: ap?.keywords, sourceLang, source: 'translator' } });
          if (ap?.contextType || p.translatedText) {
            await savePhrase({
              payload: {
                text: p.text,
                translatedText: p.translatedText || p.text,
                sourceLang,
                contextType: ap?.contextType,
                source: 'translator',
                logId,
              },
            });
          }
        } catch (e: any) {
          console.warn('[brainpool] Language Knowledge 저장 실패 (무시):', e.message);
        }

        // tb_trans_logs에 분석 결과 UPDATE
        if (logId) {
          const { getStorage } = await import('@/brain-engine/connectors/storage.js');
          const db = await getStorage();
          if (db) {
            const { error } = await db.from('tb_trans_logs').update({
              emotion:          ap?.emotion || 'neutral',
              emotion_score:    ap?.emotionScore ?? 0.5,
              risk_score:       ap?.riskScore ?? 0,
              conflict_count:   ap?.conflictCount ?? 0,
              intent:           ap?.intent || null,
              intent_conf:      ap?.intentConf || null,
              meaning_score:    ap?.meaningScore ?? null,
              meaning_reason:   ap?.meaningReason ?? null,
              risk_reason:      ap?.riskReason ?? null,
              detected_dialect: ap?.detectedDialect || 'unknown',
              final_dialect:    ap?.finalDialect || null,
              is_southern:      ap?.isSouthern ?? false,
              cultural_notes:   ap?.culturalNote ? { warning: ap.culturalNote } : null,
              is_cultural_adjusted: !!ap?.culturalNote,
            }).eq('id', logId);
            if (error) console.warn('[brainpool] 분석값 UPDATE 실패:', error.message);
            else console.log(`[brainpool] 분석값 저장 완료 logId=${logId}`);
          }
        }
      } catch (e: any) {
        console.warn('[brainpool] 백그라운드 분석 실패 (번역엔 영향 없음):', e.message);
      }
    });

    return new Response(
      JSON.stringify({ payload: responsePayload, _error: null, traceId }),
      { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ payload: null, _error: e.message, traceId }),
      { status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  }
}