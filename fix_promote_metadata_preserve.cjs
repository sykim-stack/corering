// fix_promote_metadata_preserve.cjs
// 목적: promote-language-knowledge.js의 promote()가 candidate 재계산 시
//       metadata를 통째로 덮어쓰는 문제 수정 (v1.3 -> v1.4).
//
// 발견 경위: exact_ba/vi_ko_low_meaning/ko_vi_low_meaning에
//   metadata.knowledge_class = "risk_pattern" 태그를 심으려던 중,
//   promote()가 매 배치 실행마다 `row = { ...c, ... }`로 metadata를
//   새로 계산된 통계값으로 완전히 대체한다는 걸 확인.
//   (verified로 잘못 승격되는 문제는 아님 — status='candidate' 하드코딩 +
//    verified/deprecated 보호 로직은 원래도 안전했음. 대신 "위험 표식
//    자체가 다음 배치에서 조용히 사라지는" 문제였음)
//
// 수정 범위: promote() 함수만. threshold, Archive 보호(tb_trans_logs 무수정),
//   verified/deprecated 보호 로직은 전혀 건드리지 않음.
//
// 실행: 저장소 루트에서 `node fix_promote_metadata_preserve.cjs`

const fs = require('fs');
const path = require('path');

console.log('🛡️ promote-language-knowledge.js v1.4 패치 시작...\n');

const targetPath = path.join('scripts', 'promote-language-knowledge.js');
let src = fs.readFileSync(targetPath, 'utf8');
let changed = false;

// ── 1. 변경사항 주석 추가 ──────────────────────────────────────────
const commentBefore = `// 실행: node scripts/promote-language-knowledge.js
//
// v1.3 변경사항:`;

const commentAfter = `// 실행: node scripts/promote-language-knowledge.js
//
// v1.4 변경사항:
//   - promote()가 candidate 재계산 시 metadata를 통째로 덮어써서, 수동으로 심어둔
//     큐레이션 태그(knowledge_class, review_trigger 등)가 다음 배치 실행마다
//     조용히 사라지는 문제 확인.
//   - PRESERVED_METADATA_KEYS에 정의된 키는 재계산되는 통계 metadata 위에
//     보존되도록 병합 로직 추가. status=verified/deprecated 보호 로직은 무수정.
//
// v1.3 변경사항:`;

if (src.includes('v1.4 변경사항')) {
  console.log('SKIP 변경사항 주석 이미 있음');
} else if (src.includes(commentBefore)) {
  src = src.replace(commentBefore, commentAfter);
  changed = true;
  console.log('OK 변경사항 주석 추가');
} else {
  console.log('X 주석 anchor 못 찾음 — 수동 확인 필요');
}

// ── 2. PRESERVED_METADATA_KEYS 상수 + promote() 함수 전체 교체 ─────
const promoteBefore = `async function promote(supabase, candidates) {
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
}`;

const promoteAfter = `// v1.4: 수동 큐레이션 태그는 재계산되는 통계 metadata 위에 보존
const PRESERVED_METADATA_KEYS = ['knowledge_class', 'review_trigger'];

async function promote(supabase, candidates) {
  if (!candidates.length) {
    console.log('  (임계값을 만족하는 후보 없음)');
    return { inserted: 0, updated: 0, skipped: 0 };
  }

  const { data: existing, error: fetchErr } = await supabase
    .from('language_knowledge')
    .select('knowledge_type, pattern_key, status, metadata')
    .in('pattern_key', candidates.map((c) => c.pattern_key));

  if (fetchErr) {
    console.error('  기존 데이터 조회 실패:', fetchErr.message);
    return { inserted: 0, updated: 0, skipped: 0 };
  }

  const existingMap = new Map(
    (existing || []).map((e) => [e.knowledge_type + ':' + e.pattern_key, e])
  );

  let inserted = 0, updated = 0, skipped = 0;

  for (const c of candidates) {
    const key = c.knowledge_type + ':' + c.pattern_key;
    const existingRow = existingMap.get(key);
    const currentStatus = existingRow?.status;

    if (currentStatus && currentStatus !== 'candidate') {
      skipped++;
      continue;
    }

    // 수동 큐레이션 태그(knowledge_class, review_trigger)는 재계산 시에도 보존
    const mergedMetadata = { ...(c.metadata || {}) };
    if (existingRow?.metadata) {
      for (const k of PRESERVED_METADATA_KEYS) {
        if (existingRow.metadata[k] !== undefined) mergedMetadata[k] = existingRow.metadata[k];
      }
    }

    const row = { ...c, metadata: mergedMetadata, source_core: 'CoreRing', status: 'candidate', updated_at: new Date().toISOString() };
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
}`;

if (src.includes('PRESERVED_METADATA_KEYS')) {
  console.log('SKIP promote() 이미 패치됨');
} else if (src.includes(promoteBefore)) {
  src = src.replace(promoteBefore, promoteAfter);
  changed = true;
  console.log('OK promote() metadata 보존 로직 추가');
} else {
  console.log('X promote() anchor 못 찾음 — 수동 확인 필요');
}

// ── 3. 시작 로그 라인 버전 표시 갱신 ────────────────────────────────
const logBefore = `console.log('Language Knowledge Pipeline - Phase 1 배치 시작 (v1.3 페이지네이션 수정)\\n');`;
const logAfter = `console.log('Language Knowledge Pipeline - Phase 1 배치 시작 (v1.4 metadata 보존)\\n');`;

if (src.includes(logAfter)) {
  console.log('SKIP 시작 로그 이미 갱신됨');
} else if (src.includes(logBefore)) {
  src = src.replace(logBefore, logAfter);
  changed = true;
  console.log('OK 시작 로그 버전 표시 갱신');
} else {
  console.log('X 시작 로그 anchor 못 찾음 — 수동 확인 필요 (동작에는 영향 없음)');
}

if (changed) {
  fs.writeFileSync(targetPath, src, 'utf8');
  console.log('\n→ scripts/promote-language-knowledge.js 저장 완료');
} else {
  console.log('\n→ 변경 없음');
}

console.log('\n✅ 완료. 다음 배치 실행(`node scripts/promote-language-knowledge.js`) 시');
console.log('   metadata.knowledge_class / metadata.review_trigger가 유지되는지 확인하세요.');
