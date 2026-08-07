// scripts/diagnose-language-knowledge.js
// Language Knowledge Pipeline - 임계값 튜닝용 진단 스크립트
// 실제 승격은 하지 않음. tb_trans_logs를 읽어 모든 후보의
// frequency/confidence/consistency 값을 표로 출력한다.
//
// 실행: node scripts/diagnose-language-knowledge.js

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

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

const INTENT_CONF_MAP = { high: 1.0, medium: 0.7, inferred: 0.4 };

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
    results.push({
      knowledge_type: 'emotion_pattern',
      pattern_key: (intent + '_' + emotion).toLowerCase(),
      frequency: rows.length,
      confidence: round3(avg(rows.map((r) => INTENT_CONF_MAP[r.intent_conf] ?? 0.4))),
      consistency: round3(rows.length / totalForIntent),
    });
  }
  return results;
}

function buildTranslationPatterns(logs) {
  const withScore = logs.filter((l) => typeof l.meaning_score === 'number');
  const results = [];
  const byDirection = groupBy(withScore, (l) => l.direction);
  for (const [direction, rows] of byDirection) {
    const lowRows = rows.filter((r) => r.meaning_score < 0.6);
    if (!lowRows.length) continue;
    results.push({
      knowledge_type: 'translation_pattern',
      pattern_key: (direction + '_low_meaning').toLowerCase(),
      frequency: lowRows.length,
      confidence: round3(1 - avg(lowRows.map((r) => r.meaning_score))),
      consistency: round3(lowRows.length / rows.length),
    });
  }
  const normalize = (t) => (t || '').trim().toLowerCase();
  const byExactText = groupBy(withScore, (l) => normalize(l.source_text));
  for (const [text, rows] of byExactText) {
    if (!text || rows.length < 5) continue;
    const avgScore = avg(rows.map((r) => r.meaning_score));
    if (avgScore >= 0.7) continue;
    const scores = rows.map((r) => r.meaning_score);
    results.push({
      knowledge_type: 'translation_pattern',
      pattern_key: ('exact_' + text).slice(0, 60),
      frequency: rows.length,
      confidence: round3(1 - avgScore),
      consistency: round3(Math.max(0, Math.min(1, 1 - (Math.max(...scores) - Math.min(...scores))))),
    });
  }
  return results;
}

function buildDialectPatterns(logs) {
  const dialectRows = logs.filter((l) => l.detected_dialect === 'south' || l.detected_dialect === 'north');
  const groups = groupBy(dialectRows, (l) => l.detected_dialect);
  const total = dialectRows.length;
  const results = [];
  for (const [dialect, rows] of groups) {
    const expectedSouthern = dialect === 'south';
    const matching = rows.filter((r) => !!r.is_southern === expectedSouthern);
    results.push({
      knowledge_type: 'dialect_pattern',
      pattern_key: 'dialect_' + dialect,
      frequency: rows.length,
      confidence: round3(matching.length / rows.length),
      consistency: round3(total ? rows.length / total : 0),
    });
  }
  return results;
}

function buildCulturalPatterns(logs) {
  const byDirection = groupBy(logs, (l) => l.direction);
  const results = [];
  for (const [direction, rows] of byDirection) {
    const culturalRows = rows.filter((r) => r.is_cultural_adjusted === true);
    if (!culturalRows.length) continue;
    results.push({
      knowledge_type: 'cultural_pattern',
      pattern_key: ('cultural_' + direction).toLowerCase(),
      frequency: culturalRows.length,
      confidence: round3(avg(culturalRows.map((r) => r.meaning_score).filter((s) => typeof s === 'number')) || 0.5),
      consistency: round3(culturalRows.length / rows.length),
    });
  }
  return results;
}

async function main() {
  console.log('진단 모드 - 승격 없이 후보 값만 출력\n');
  const supabase = getSupabase();

  const { data: logs, error } = await supabase
    .from('tb_trans_logs')
    .select('source_text, standard_vi, direction, emotion, emotion_score, intent, intent_conf, meaning_score, detected_dialect, is_southern, is_cultural_adjusted, created_at')
    .order('created_at', { ascending: false })
    .limit(5000);

  if (error) {
    console.error('조회 실패:', error.message);
    process.exit(1);
  }

  console.log('분석 대상: ' + logs.length + '건\n');

  const all = [
    ...buildEmotionPatterns(logs),
    ...buildTranslationPatterns(logs),
    ...buildDialectPatterns(logs),
    ...buildCulturalPatterns(logs),
  ].sort((a, b) => b.frequency - a.frequency);

  console.log('type'.padEnd(20) + 'pattern_key'.padEnd(35) + 'freq'.padEnd(6) + 'conf'.padEnd(7) + 'consist'.padEnd(8) + 'pass(0.7/0.8/f5)');
  console.log('-'.repeat(95));
  for (const c of all) {
    const pass = c.frequency >= 5 && c.confidence >= 0.7 && c.consistency >= 0.8;
    console.log(
      c.knowledge_type.padEnd(20) +
      c.pattern_key.slice(0, 33).padEnd(35) +
      String(c.frequency).padEnd(6) +
      String(c.confidence).padEnd(7) +
      String(c.consistency).padEnd(8) +
      (pass ? 'YES' : 'no')
    );
  }

  console.log('\n타입별 통계:');
  const byType = groupBy(all, (c) => c.knowledge_type);
  for (const [type, rows] of byType) {
    console.log('  ' + type + ': 후보 ' + rows.length + '건, ' +
      'confidence 평균 ' + round3(avg(rows.map(r => r.confidence))) + ', ' +
      'consistency 평균 ' + round3(avg(rows.map(r => r.consistency))));
  }
}

main().catch((e) => { console.error('예외:', e.message); process.exit(1); });
