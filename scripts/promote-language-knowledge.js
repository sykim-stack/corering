// scripts/promote-language-knowledge.js
// Language Knowledge Pipeline v1.0 - Phase 1
// tb_trans_logs -> language_knowledge 승격 배치
//
// 실행: node scripts/promote-language-knowledge.js
//
// v1.2 변경사항:
//   - source_expression 품질 수정: rows[0] 문장 전체(최대 200자) -> 여러 후보 중
//     가장 짧은 예시(최대 40자)로 교체. dialect_north 등에서 문장 전체가
//     들어가던 문제 해결.
//   - consistency 임계값은 건드리지 않음 (다음 재진단: tb_trans_logs 1500~2000건 시점)
//
// v1.1 변경사항 (진단 결과 반영):
//   - 글로벌 단일 임계값 폐기 -> 타입별 임계값으로 전환
//
// 원칙:
//   - tb_trans_logs는 절대 수정하지 않음 (Archive 보호)
//   - CoreRing 기존 번역/분석 파이프라인 무수정 (추가 레이어)
//   - status=verified | deprecated인 기존 지식은 덮어쓰지 않음

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const THRESHOLDS_BY_TYPE = {
  emotion_pattern:      { minFrequency: 10, minConfidence: 0.4, minConsistency: 0.6 },
  dialect_pattern:       { minFrequency: 5,  minConfidence: 0.9, minConsistency: 0.2 },
  translation_pattern:   { minFrequency: 5,  minConfidence: 0.7, minConsistency: 0.05 },
  cultural_pattern:      { minFrequency: 5,  minConfidence: 0.7, minConsistency: 0.8 },
};

const INTENT_CONF_MAP = { high: 1.0, medium: 0.7, inferred: 0.4 };

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eq = trimmed.indexOf('=');
    if (eq === -1) return;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  });
}

function getSupabase() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
  if (!url || !key) {
    console.error('Supabase env vars missing (check .env.local)');
    process.exit(1);
  }
  return createClient(url, key);
}

function groupBy(arr, keyFn) {
  const map = new Map();
  for (const item of arr) {
    const key = keyFn(item);
    if (key === null || key === undefined) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

function avg(nums) {
  const valid = nums.filter((n) => typeof n === 'number' && !Number.isNaN(n));
  if (!valid.length) return 0;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

function round3(n) {
  return Math.round(n * 1000) / 1000;
}

// ── v1.2: 짧은 대표 예시 추출 (문장 전체 대신 가장 짧은 표현 선택) ─────
function shortestExample(rows, maxLen = 40) {
  const texts = rows
    .map((r) => r.source_text?.trim())
    .filter((t) => t && t.length > 0)
    .sort((a, b) => a.length - b.length);
  if (!texts.length) return null;
  const shortest = texts[0];
  return shortest.length > maxLen ? shortest.slice(0, maxLen) + '…' : shortest;
}

// ── [1] emotion_pattern ──────────────────────────────────────────
function buildEmotionPatterns(logs) {
  const withIntentEmotion = logs.filter((l) => l.intent && l.emotion);
  const totalByIntent = groupBy(withIntentEmotion, (l) => l.intent);
  const groups = groupBy(withIntentEmotion, (l) => l.intent + '::' + l.emotion);

  const results = [];
  for (const [key, rows] of groups) {
    const parts = key.split('::');
    const intent = parts[0];
    const emotion = parts[1];
    const totalForIntent = totalByIntent.get(intent)?.length || rows.length;
    const consistency = rows.length / totalForIntent;
    const confidence = avg(rows.map((r) => INTENT_CONF_MAP[r.intent_conf] ?? 0.4));

    results.push({
      knowledge_type: 'emotion_pattern',
      pattern_key: (intent + '_' + emotion).toLowerCase(),
      source_expression: shortestExample(rows),
      description: '의도 \'' + intent + '\' 표현은 감정 \'' + emotion + '\'과 함께 나타나는 경향이 있습니다 ' +
        '(해당 의도 표현 중 ' + Math.round(consistency * 100) + '% 비율, 표본 ' + rows.length + '건).',
      emotion,
      intent,
      confidence: round3(confidence),
      consistency: round3(consistency),
      frequency: rows.length,
      metadata: { sample_size_for_intent: totalForIntent },
    });
  }
  return results;
}

// ── [2] translation_pattern ──────────────────────────────────────
function buildTranslationPatterns(logs) {
  const withScore = logs.filter((l) => typeof l.meaning_score === 'number');
  const results = [];

  const byDirection = groupBy(withScore, (l) => l.direction);
  for (const [direction, rows] of byDirection) {
    const lowRows = rows.filter((r) => r.meaning_score < 0.6);
    if (!lowRows.length) continue;
    const consistency = lowRows.length / rows.length;
    const confidence = round3(1 - avg(lowRows.map((r) => r.meaning_score)));

    results.push({
      knowledge_type: 'translation_pattern',
      pattern_key: (direction + '_low_meaning').toLowerCase(),
      source_expression: shortestExample(lowRows),
      description: direction + ' 방향 번역에서 의미 전달률이 낮은(0.6 미만) 표현이 ' +
        '전체의 ' + Math.round(consistency * 100) + '% 비율로 반복됩니다 (표본 ' + lowRows.length + '건). ' +
        '직역 위험 - 문화적 맥락 보완 필요.',
      emotion: null,
      intent: null,
      confidence,
      consistency: round3(consistency),
      frequency: lowRows.length,
      metadata: { direction, total_in_direction: rows.length },
    });
  }

  const normalize = (t) => (t || '').trim().toLowerCase();
  const byExactText = groupBy(withScore, (l) => normalize(l.source_text));
  for (const [text, rows] of byExactText) {
    if (!text || rows.length < 5) continue;
    const avgScore = avg(rows.map((r) => r.meaning_score));
    if (avgScore >= 0.7) continue;
    const scores = rows.map((r) => r.meaning_score);
    const consistency = 1 - (Math.max(...scores) - Math.min(...scores));

    results.push({
      knowledge_type: 'translation_pattern',
      pattern_key: ('exact_' + text).slice(0, 120),
      source_expression: shortestExample(rows),
      description: '"' + text.slice(0, 50) + '" 표현이 ' + rows.length + '회 반복되며 ' +
        '평균 의미 전달률이 ' + avgScore.toFixed(2) + '로 낮습니다. 직역 위험 표현.',
      emotion: null,
      intent: null,
      confidence: round3(1 - avgScore),
      consistency: round3(Math.max(0, Math.min(1, consistency))),
      frequency: rows.length,
      metadata: {},
    });
  }

  return results;
}

// ── [3] dialect_pattern ──────────────────────────────────────────
function buildDialectPatterns(logs) {
  const dialectRows = logs.filter(
    (l) => l.detected_dialect === 'south' || l.detected_dialect === 'north'
  );
  const groups = groupBy(dialectRows, (l) => l.detected_dialect);
  const total = dialectRows.length;
  const results = [];

  for (const [dialect, rows] of groups) {
    const expectedSouthern = dialect === 'south';
    const matching = rows.filter((r) => !!r.is_southern === expectedSouthern);
    const confidence = matching.length / rows.length;
    const consistency = total ? rows.length / total : 0;

    results.push({
      knowledge_type: 'dialect_pattern',
      pattern_key: 'dialect_' + dialect,
      source_expression: shortestExample(rows),
      description: '방언 \'' + dialect + '\'로 감지된 표현이 전체 방언 감지 결과 중 ' +
        Math.round(consistency * 100) + '%를 차지하며, is_southern 플래그와의 ' +
        '일치율은 ' + Math.round(confidence * 100) + '%입니다 (표본 ' + rows.length + '건).',
      emotion: null,
      intent: null,
      confidence: round3(confidence),
      consistency: round3(consistency),
      frequency: rows.length,
      metadata: { total_dialect_analyzed: total },
    });
  }
  return results;
}

// ── [4] cultural_pattern ──────────────────────────────────────────
function buildCulturalPatterns(logs) {
  const byDirection = groupBy(logs, (l) => l.direction);
  const results = [];

  for (const [direction, rows] of byDirection) {
    const culturalRows = rows.filter((r) => r.is_cultural_adjusted === true);
    if (!culturalRows.length) continue;
    const consistency = culturalRows.length / rows.length;
    const confidence = avg(
      culturalRows
        .map((r) => r.meaning_score)
        .filter((s) => typeof s === 'number')
    ) || 0.5;

    results.push({
      knowledge_type: 'cultural_pattern',
      pattern_key: ('cultural_' + direction).toLowerCase(),
      source_expression: shortestExample(culturalRows),
      description: direction + ' 방향 번역 중 ' + Math.round(consistency * 100) + '%가 ' +
        '문화적 맥락 조정을 필요로 했습니다 (표본 ' + culturalRows.length + '/' + rows.length + '건).',
      emotion: null,
      intent: null,
      confidence: round3(confidence),
      consistency: round3(consistency),
      frequency: culturalRows.length,
      metadata: { direction, total_in_direction: rows.length },
    });
  }
  return results;
}

function passesThreshold(candidate) {
  const t = THRESHOLDS_BY_TYPE[candidate.knowledge_type];
  if (!t) return false;
  return (
    candidate.frequency >= t.minFrequency &&
    candidate.confidence >= t.minConfidence &&
    candidate.consistency >= t.minConsistency
  );
}

async function promote(supabase, candidates) {
  if (!candidates.length) {
    console.log('  (임계값을 만족하는 후보 없음)');
    return { inserted: 0, updated: 0, skipped: 0 };
  }

  const { data: existing, error: fetchErr } = await supabase
    .from('language_knowledge')
    .select('knowledge_type, pattern_key, status')
    .in('pattern_key', candidates.map((c) => c.pattern_key));

  if (fetchErr) {
    console.error('  기존 데이터 조회 실패:', fetchErr.message);
    return { inserted: 0, updated: 0, skipped: 0 };
  }

  const existingMap = new Map(
    (existing || []).map((e) => [e.knowledge_type + ':' + e.pattern_key, e.status])
  );

  let inserted = 0, updated = 0, skipped = 0;

  for (const c of candidates) {
    const key = c.knowledge_type + ':' + c.pattern_key;
    const currentStatus = existingMap.get(key);

    if (currentStatus && currentStatus !== 'candidate') {
      skipped++;
      continue;
    }

    const row = { ...c, source_core: 'CoreRing', status: 'candidate', updated_at: new Date().toISOString() };
    const { error } = await supabase
      .from('language_knowledge')
      .upsert(row, { onConflict: 'knowledge_type,pattern_key' });

    if (error) {
      console.error('  upsert 실패 (' + key + '):', error.message);
      continue;
    }
    if (currentStatus === 'candidate') updated++;
    else inserted++;
  }

  return { inserted, updated, skipped };
}

async function main() {
  console.log('Language Knowledge Pipeline - Phase 1 배치 시작 (v1.2 source_expression 수정)\n');
  for (const [type, t] of Object.entries(THRESHOLDS_BY_TYPE)) {
    console.log('  ' + type + ': freq>=' + t.minFrequency + ', conf>=' + t.minConfidence + ', consist>=' + t.minConsistency);
  }
  console.log('');

  const supabase = getSupabase();

  const { data: logs, error } = await supabase
    .from('tb_trans_logs')
    .select(
      'source_text, standard_vi, direction, emotion, emotion_score, ' +
      'intent, intent_conf, meaning_score, detected_dialect, is_southern, ' +
      'is_cultural_adjusted, created_at'
    )
    .order('created_at', { ascending: false })
    .limit(5000);

  if (error) {
    console.error('tb_trans_logs 조회 실패:', error.message);
    process.exit(1);
  }

  console.log('분석 대상: tb_trans_logs ' + logs.length + '건\n');

  const allCandidates = [
    ...buildEmotionPatterns(logs),
    ...buildTranslationPatterns(logs),
    ...buildDialectPatterns(logs),
    ...buildCulturalPatterns(logs),
  ];

  console.log('후보 패턴 (임계값 적용 전): ' + allCandidates.length + '건');
  const passed = allCandidates.filter(passesThreshold);
  console.log('승격 대상 (임계값 통과): ' + passed.length + '건\n');

  const byType = groupBy(passed, (c) => c.knowledge_type);
  for (const [type, rows] of byType) {
    console.log('  - ' + type + ': ' + rows.length + '건 (' + rows.map(r => r.pattern_key).join(', ') + ')');
  }
  console.log('');

  const result = await promote(supabase, passed);

  console.log('\n결과:');
  console.log('  신규 생성: ' + result.inserted);
  console.log('  갱신(candidate): ' + result.updated);
  console.log('  건너뜀(verified/deprecated 보호): ' + result.skipped);
  console.log('\nPhase 1 배치 완료');
}

main().catch((e) => {
  console.error('배치 실행 중 예외:', e.message);
  process.exit(1);
});
