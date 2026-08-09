// brain-engine/layers/RingLexiconLayer.js
// DB 스키마: id, standard_word, southern_word, hue_word, mekong_word, meaning_ko, meaning_en,
// part_of_speech, category_main, category_sub, pronunciation_diff, conversion_rule,
// frequency, formality_level, generation, region, example_northern, example_southern,
// notes, created_at, entry_type, dialect, status, source, emotion_score, conflict_weight
//
// tp_lexicon: 채팅에서 자동 추출된 어휘 (Language Knowledge Phase 1.5)
//   - tp_translations(정성 사전)에 없을 때 보완 조회용
//   - translation_group_id로 언어쌍이 묶여 있음

export class RingLexiconLayer {
  async handle(ctx) {
    const action = ctx.payload?.action || ctx.action;
    switch (action) {
      case 'getWordData':        return await this.getWordData(ctx);
      case 'saveWord':           return await this.saveWord(ctx);
      case 'getUserVocabulary':  return await this.getUserVocabulary(ctx);
      case 'updateVocabulary':   return await this.updateVocabulary(ctx);
      case 'deleteVocabulary':   return await this.deleteVocabulary(ctx);
      case 'reportConflict':     return await this.reportConflict(ctx);
      case 'resolveConflict':    return await this.resolveConflict(ctx);
      case 'getRandomWord':      return await this.getRandomWord(ctx);
      case 'saveAudio':          return await this.saveAudio(ctx);
      case 'getAudio':           return await this.getAudio(ctx);
      default:
        return { ...ctx, _error: { code: 'UNKNOWN_ACTION', message: `Unknown action: ${action}` } };
    }
  }

  // ── tp_lexicon 보완 조회 (tp_translations에 없을 때만 호출됨) ──────
  async lookupLexicon(ctx, word, isKorean) {
    const searchLang = isKorean ? 'ko' : 'vi';
    const normalized = word.trim().toLowerCase();

    const { data: entry, error } = await ctx.supabase
      .from('tp_lexicon')
      .select('id, translation_group_id, language, lemma, frequency, status')
      .eq('language', searchLang)
      .eq('normalized_lemma', normalized)
      .neq('status', 'deprecated')
      .order('frequency', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !entry) return null;

    // 같은 translation_group_id를 가진 다른 언어 행 = 번역 짝
    const { data: pairs } = await ctx.supabase
      .from('tp_lexicon')
      .select('language, lemma')
      .eq('translation_group_id', entry.translation_group_id)
      .neq('language', searchLang);

    const translations = {};
    for (const p of pairs || []) {
      translations[p.language] = p.lemma;
    }

    return {
      matchedWord: entry.lemma,
      language: entry.language,
      translations,
      frequency: entry.frequency,
      status: entry.status,
    };
  }

  async getWordData(ctx) {
    const { word, dialect = 'standard' } = ctx.payload;
    if (!word) return { ...ctx, _error: { code: 'MISSING_WORD', message: 'word is required' } };

    const SELECT_COLS =
      'standard_word, southern_word, hue_word, mekong_word, meaning_ko, ' +
      'example_northern, example_southern, notes, part_of_speech, ' +
      'pronunciation_diff, conversion_rule, frequency, formality_level, ' +
      'emotion_score, conflict_weight';

    const isKorean = /[가-힣]/.test(word);
    const isSentence = word.includes(' ') || word.length > 15;
    let data = null;

    // 문장(공백 포함 또는 긴 텍스트)은 사전 조회 건너뜀 → tb_trans_logs에서만 분석값 조회
    if (!isSentence) {
      if (isKorean) {
        const r1 = await ctx.supabase.from('tp_translations')
          .select(SELECT_COLS).eq('meaning_ko', word).limit(1);
        if (r1.error) return { ...ctx, _error: { code: 'DB_ERROR', message: r1.error.message } };
        data = r1.data?.[0] ?? null;

        if (!data) {
          const r2 = await ctx.supabase.from('tp_translations')
            .select(SELECT_COLS).ilike('meaning_ko', `%${word}%`).limit(1);
          if (r2.error) return { ...ctx, _error: { code: 'DB_ERROR', message: r2.error.message } };
          data = r2.data?.[0] ?? null;
        }
      } else {
        const r1 = await ctx.supabase.from('tp_translations')
          .select(SELECT_COLS).ilike('standard_word', word).limit(1);
        if (r1.error) return { ...ctx, _error: { code: 'DB_ERROR', message: r1.error.message } };
        data = r1.data?.[0] ?? null;

        if (!data) {
          const r1b = await ctx.supabase.from('tp_translations')
            .select(SELECT_COLS).ilike('southern_word', word).limit(1);
          if (!r1b.error) data = r1b.data?.[0] ?? null;
        }

        if (!data) {
          const r2 = await ctx.supabase.from('tp_translations')
            .select(SELECT_COLS)
            .or(`hue_word.ilike.${word},mekong_word.ilike.${word}`)
            .limit(1);
          if (!r2.error) data = r2.data?.[0] ?? null;
        }
      }
    }

    // ── tp_translations(정성 사전)에 없으면 tp_lexicon(자동 추출)으로 보완 ──
    let lexiconMatch = null;
    if (!data && !isSentence) {
      lexiconMatch = await this.lookupLexicon(ctx, word, isKorean);
    }

    // tb_trans_logs에서 분석값 조회 (단어 & 문장 모두)
    let analysisData = null;
    try {
      const logQuery = ctx.supabase
        .from('tb_trans_logs')
        .select('emotion, emotion_score, risk_score, risk_reason, intent, detected_dialect, meaning_score, meaning_reason')
        .order('created_at', { ascending: false })
        .limit(1);

      let logResult;
      if (isSentence) {
        const r1 = await ctx.supabase.from('tb_trans_logs')
          .select('emotion, emotion_score, risk_score, risk_reason, intent, detected_dialect, meaning_score, meaning_reason')
          .eq('source_text', word)
          .order('created_at', { ascending: false })
          .limit(1);
        logResult = r1;
        if (!r1.data?.[0]) {
          const r2 = await ctx.supabase.from('tb_trans_logs')
            .select('emotion, emotion_score, risk_score, risk_reason, intent, detected_dialect, meaning_score, meaning_reason')
            .eq('standard_vi', word)
            .order('created_at', { ascending: false })
            .limit(1);
          logResult = r2;
        }
      } else {
        logResult = await logQuery.or(`source_text.eq."${word}",standard_vi.eq."${word}"`);
      }

      analysisData = logResult?.data?.[0] ?? null;
      console.log(`[getWordData] word="${word}" isSentence=${isSentence} riskScore=${analysisData?.risk_score} emotion=${analysisData?.emotion} lexiconMatch=${!!lexiconMatch}`);
    } catch (e) { /* 분석값 없어도 카드는 표시 */ }

    // 사전에도 없고, 자동추출 데이터도 없고, 분석값도 없으면 NOT_FOUND
    if (!data && !lexiconMatch && !analysisData) {
      return { ...ctx, _error: { code: 'NOT_FOUND', message: `Word "${word}" not found` } };
    }

    const example = data
      ? ((dialect === 'southern') ? data.example_southern : data.example_northern)
      : null;

    // meaning: tp_translations 우선 → tp_lexicon 번역 짝 → null
    let meaning = data?.meaning_ko || null;
    if (!meaning && lexiconMatch) {
      meaning = isKorean ? lexiconMatch.translations.vi : lexiconMatch.translations.ko;
    }

    return { ...ctx, result: {
      word,
      standard:        data?.standard_word || lexiconMatch?.matchedWord || null,
      southern:        data?.southern_word || null,
      hue:             data?.hue_word || null,
      mekong:          data?.mekong_word || null,
      meaning,
      examples:        example ? [example] : [],
      culturalNote:    data?.notes || null,
      riskScore:       analysisData?.risk_score ?? data?.conflict_weight ?? 0,
      riskReason:      analysisData?.risk_reason ?? null,
      emotion:         analysisData?.emotion || ((data?.emotion_score || 0) > 0.5 ? '긍정' : '중립'),
      emotionScore:    analysisData?.emotion_score ?? data?.emotion_score ?? null,
      meaningScore:    analysisData?.meaning_score ?? null,
      meaningReason:   analysisData?.meaning_reason ?? null,
      intent:          analysisData?.intent || null,
      detectedDialect: analysisData?.detected_dialect || 'unknown',
      partOfSpeech:    data?.part_of_speech || null,
      source:          data ? 'curated' : (lexiconMatch ? 'auto_extracted' : 'analysis_only'),
    }};
  }

  async getRandomWord(ctx) {
    const { data, error } = await ctx.supabase
      .from('tp_translations')
      .select('standard_word, meaning_ko, example_northern, notes')
      .not('meaning_ko', 'is', null)
      .limit(50);
    if (error || !data?.length)
      return { ...ctx, _error: { code: 'NOT_FOUND', message: 'No words found' } };
    const random = data[Math.floor(Math.random() * data.length)];
    return { ...ctx, result: {
      word:         random.standard_word,
      meaning:      random.meaning_ko,
      usage:        random.example_northern || null,
      culturalNote: random.notes || null,
    }};
  }

  async saveWord(ctx) {
    const { user_id, trans_id, word, meaning_kr, source_session_id } = ctx.payload;
    if (!word) return { ...ctx, _error: { code: 'MISSING_WORD', message: 'word is required' } };
    if (!user_id) return { ...ctx, _error: { code: 'MISSING_USER', message: 'user_id is required' } };
    const insertData = { user_id, word, meaning_kr, source_session_id };
    if (trans_id) insertData.trans_id = trans_id;
    const { data, error } = await ctx.supabase
      .from('user_vocabulary')
      .insert([insertData])
      .select()
      .single();
    if (error) return { ...ctx, _error: { code: 'DB_INSERT_ERROR', message: error.message } };
    return { ...ctx, result: data };
  }

  async getUserVocabulary(ctx) {
    const { user_id } = ctx.payload;
    if (!user_id) return { ...ctx, _error: { code: 'MISSING_USER', message: 'user_id is required' } };
    const { data, error } = await ctx.supabase
      .from('user_vocabulary')
      .select('*')
      .eq('user_id', user_id)
      .order('created_at', { ascending: false });
    if (error) return { ...ctx, _error: { code: 'DB_ERROR', message: error.message } };
    return { ...ctx, result: data };
  }

  async updateVocabulary(ctx) {
    const { id, user_id, ...fields } = ctx.payload;
    if (!id || !user_id) return { ...ctx, _error: { code: 'MISSING_PARAMS', message: 'id and user_id are required' } };
    const allowed = ['is_bookmarked', 'learn_status', 'memo', 'review_at', 'meaning_kr'];
    const update = Object.fromEntries(
      Object.entries(fields).filter(([k]) => allowed.includes(k))
    );
    if (!Object.keys(update).length) return { ...ctx, _error: { code: 'NO_FIELDS', message: 'No valid fields to update' } };
    const { data, error } = await ctx.supabase
      .from('user_vocabulary')
      .update(update)
      .eq('id', id)
      .eq('user_id', user_id)
      .select()
      .single();
    if (error) return { ...ctx, _error: { code: 'DB_UPDATE_ERROR', message: error.message } };
    return { ...ctx, result: data };
  }

  async deleteVocabulary(ctx) {
    const { id, user_id } = ctx.payload;
    if (!id || !user_id) return { ...ctx, _error: { code: 'MISSING_PARAMS', message: 'id and user_id are required' } };
    const { error } = await ctx.supabase
      .from('user_vocabulary')
      .delete()
      .eq('id', id)
      .eq('user_id', user_id);
    if (error) return { ...ctx, _error: { code: 'DB_DELETE_ERROR', message: error.message } };
    return { ...ctx, result: { success: true, id } };
  }

  async saveAudio(ctx) {
    const { user_id, word, dialect, audio_url, session_id, trans_id } = ctx.payload;
    if (!user_id || !audio_url) return { ...ctx, _error: { code: 'MISSING_PARAMS', message: 'user_id and audio_url required' } };
    const { data, error } = await ctx.supabase
      .from('audio_contributions')
      .insert([{ user_id, word: word || '', dialect: dialect || 'standard', audio_url, session_id: session_id || null, trans_id: trans_id || null }])
      .select()
      .single();
    if (error) return { ...ctx, _error: { code: 'DB_INSERT_ERROR', message: error.message } };
    return { ...ctx, result: data };
  }

  async getAudio(ctx) {
    const { word, dialect } = ctx.payload;
    if (!word) return { ...ctx, _error: { code: 'MISSING_WORD', message: 'word is required' } };
    let query = ctx.supabase
      .from('audio_contributions')
      .select('audio_url, user_id, created_at')
      .eq('word', word)
      .order('created_at', { ascending: false })
      .limit(1);
    if (dialect) query = query.eq('dialect', dialect);
    const { data, error } = await query.maybeSingle();
    if (error) return { ...ctx, _error: { code: 'DB_ERROR', message: error.message } };
    if (!data) return { ...ctx, result: null };
    return { ...ctx, result: { audio_url: data.audio_url } };
  }

  async reportConflict(ctx) {
    const { source_word, target_word, dialect, description, reporter_id } = ctx.payload;
    const { data, error } = await ctx.supabase
      .from('tp_conflicts')
      .insert([{ source_word, target_word, dialect, description, reporter_id, status: 'pending' }])
      .select()
      .single();
    if (error) return { ...ctx, _error: { code: 'DB_CONFLICT_ERROR', message: error.message } };
    return { ...ctx, result: data };
  }

  async resolveConflict(ctx) {
    const { conflict_id, resolution_note, new_translation, original_word } = ctx.payload;
    const { error: updateError } = await ctx.supabase
      .from('tp_conflicts')
      .update({ status: 'resolved', resolution_note, resolved_at: new Date() })
      .eq('id', conflict_id);
    if (updateError) return { ...ctx, _error: { code: 'DB_UPDATE_ERROR', message: updateError.message } };
    if (new_translation && original_word) {
      const { error: transError } = await ctx.supabase
        .from('tp_translations')
        .update({ standard_word: new_translation })
        .eq('meaning_ko', original_word);
      if (transError) return { ...ctx, _error: { code: 'DB_TRANS_UPDATE_ERROR', message: transError.message } };
    }
    return { ...ctx, result: { success: true, conflict_id } };
  }
}

export default RingLexiconLayer;