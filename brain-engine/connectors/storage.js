// brain-engine/connectors/storage.js

let _client = null;

export async function getStorage() {
  if (_client) return _client;

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      console.error('[Storage] 환경변수 누락');
      return null;
    }

    _client = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    return _client;
  } catch (err) {
    console.error('[Storage] 클라이언트 생성 실패', err);
    return null;
  }
}

export async function setCurrentDeviceId(ctx) {
  ctx = ctx || {};
  const deviceId = ctx.device_id || ctx.payload?.device_id || ctx.payload?.user_id;

  if (!deviceId) {
    ctx._skipSave = true;
    return ctx;
  }

  ctx.device_id = deviceId;

  const client = await getStorage();
  if (!client) {
    ctx._skipSave = true;
    return ctx;
  }

  try {
    await client.rpc('set_app_current_device_id', { device_id: deviceId });
  } catch (e) {
    console.warn('[Storage] rpc skipped');
  }

  return ctx;
}

export async function saveTranslationAsset(ctx) {
  ctx = ctx || {};
  const client = await getStorage();
  if (!client) {
    ctx._skipSave = true;
    return ctx;
  }

  try {
    const p = ctx.payload || {};

    const { data, error } = await client
      .from('tb_trans_logs')
      .insert({
        user_id: ctx.device_id,
        source_text: p.sourceText || p.source_text || p.text,
        standard_vi: p.translated || p.translatedText || p.standard_vi,
        southern_vi: p.translated || p.translatedText,
        is_southern: true,
        marriage_type: p.marriage_type || null,
        partner_device_id: p.partner_device_id || null,
        context_category: p.context_category || 'daily',
        cultural_notes: p.cultural_notes || null,
        is_cultural_adjusted: p.is_cultural_adjusted ?? false,
      })
      .select()
      .single();

    if (error) {
      console.warn('[Storage] DB 저장 실패:', error.message);
    } else {
      ctx.payload.asset_id = data?.id;
    }
  } catch (err) {
    console.warn('[Storage] saveTranslationAsset exception:', err.message);
  }

  return ctx;
}

export async function saveTranslation(ctx) {
  ctx = await setCurrentDeviceId(ctx);
  if (ctx._error) return ctx;
  if (ctx._skipSave) return ctx;
  return await saveTranslationAsset(ctx);
}

// ── Language Knowledge Phase 1.5: 자동 어휘/구문 추출 저장 ─────────────
// Gemini 분석 결과(analyze.js)에서 나온 keywords/context_type을
// tp_lexicon / tp_phrases에 저장. 새 AI 호출 없음 -- 순수 저장 레이어.

function normalizeLemma(text) {
  return (text || '').trim().toLowerCase();
}

async function hashPhrase(sourceLanguage, normalizedText, targetLanguage) {
  const { createHash } = await import('crypto');
  return createHash('sha256')
    .update(`${sourceLanguage}|${normalizedText}|${targetLanguage}`)
    .digest('hex');
}

export async function saveVocabulary(ctx) {
  const { keywords, sourceLang, source = 'chat' } = ctx.payload || {};
  if (!Array.isArray(keywords) || !keywords.length) return ctx;

  const client = await getStorage();
  if (!client) return ctx;

  const koLang = 'ko';
  const viLang = sourceLang === 'ko' ? 'vi' : sourceLang || 'vi';

  for (const kw of keywords) {
    const koLemma = kw?.ko?.trim();
    const viLemma = kw?.vi?.trim();
    if (!koLemma && !viLemma) continue;

    try {
      const groupId = crypto.randomUUID();
      const rows = [];
      if (koLemma) {
        rows.push({
          translation_group_id: groupId,
          language: koLang,
          lemma: koLemma,
          normalized_lemma: normalizeLemma(koLemma),
          source,
        });
      }
      if (viLemma) {
        rows.push({
          translation_group_id: groupId,
          language: viLang,
          lemma: viLemma,
          normalized_lemma: normalizeLemma(viLemma),
          source,
        });
      }

      for (const row of rows) {
        const { data: existing } = await client
          .from('tp_lexicon')
          .select('id, frequency, translation_group_id')
          .eq('language', row.language)
          .eq('normalized_lemma', row.normalized_lemma)
          .maybeSingle();

        if (existing) {
          await client
            .from('tp_lexicon')
            .update({ frequency: existing.frequency + 1, updated_at: new Date().toISOString() })
            .eq('id', existing.id);
        } else {
          await client.from('tp_lexicon').insert(row);
        }
      }
    } catch (e) {
      console.warn('[storage] saveVocabulary 실패 (무시):', e.message);
    }
  }

  return ctx;
}

export async function savePhrase(ctx) {
  const {
    text, translatedText, sourceLang, contextType,
    source = 'chat', logId,
  } = ctx.payload || {};

  if (!text || !translatedText || !sourceLang) return ctx;

  const client = await getStorage();
  if (!client) return ctx;

  const targetLang = sourceLang === 'ko' ? 'vi' : 'ko';
  const normalized = normalizeLemma(text);

  try {
    const hash = await hashPhrase(sourceLang, normalized, targetLang);

    const { data: existing } = await client
      .from('tp_phrases')
      .select('id, frequency')
      .eq('phrase_hash', hash)
      .maybeSingle();

    if (existing) {
      await client
        .from('tp_phrases')
        .update({ frequency: existing.frequency + 1, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
    } else {
      await client.from('tp_phrases').insert({
        phrase_hash: hash,
        source_language: sourceLang,
        target_language: targetLang,
        source_text: text,
        target_text: translatedText,
        context_type: contextType || null,
        source,
        tb_trans_log_id: logId || null,
      });
    }
  } catch (e) {
    console.warn('[storage] savePhrase 실패 (무시):', e.message);
  }

  return ctx;
}