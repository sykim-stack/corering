// fix_promote_metadata_preserve_v2.cjs
// v1(fix_promote_metadata_preserve.cjs) 재시도.
//
// v1이 왜 실패했는가:
//   - v1은 promote() 함수 전체(약 40줄)를 하나의 거대한 anchor로 교체하려 했음.
//   - "이미 적용됐는지" 판정 조건이 src.includes('PRESERVED_METADATA_KEYS')였는데,
//     이 문자열이 v1이 넣은 "설명 주석"에도 등장함 (파일 11번째 줄).
//   - 결과: 주석만 성공적으로 삽입되고, 정작 promote() 함수 본체 교체는
//     (아마 최초 1회부터) 실패했는데, 재실행할 때마다 주석의 문자열 때문에
//     "이미 패치됨(SKIP)"으로 오판 -> 계속 "완료"로 잘못 보고됨.
//   - 실제 결과: metadata select 안 함, existingMap이 status만 저장,
//     merge 로직 전무 -> v1.3 원본 그대로 -> 다음 배치에서 수동 태그 전부 소실.
//
// v2 변경점:
//   - 40줄 블록 통째 교체 대신, 5개의 독립된 "한 줄" anchor로 쪼갬.
//     한 줄 단위는 줄바꿈 문자 불일치 등으로 조용히 실패할 여지가 훨씬 적고,
//     실패해도 정확히 어느 지점인지 로그로 바로 드러남.
//   - "이미 적용됨" 판정 문자열을 주석과 절대 겹치지 않는
//     'const PRESERVED_METADATA_KEYS = [' (등호+대괄호 포함)로 변경.
//
// 실행: 저장소 루트에서 `node fix_promote_metadata_preserve_v2.cjs`
// 실행 후 반드시: 콘솔에 OK가 5개(또는 이미 적용된 만큼 SKIP) 모두 나오는지 확인.
//   X가 하나라도 있으면 그 줄만 알려주면 재조정.

const fs = require('fs');
const path = require('path');

console.log('🛡️ promote-language-knowledge.js v2 패치 시작 (한 줄 단위 anchor)...\n');

const targetPath = path.join('scripts', 'promote-language-knowledge.js');
let src = fs.readFileSync(targetPath, 'utf8');
let changed = false;
let anyFailed = false;

function applyPatch(label, before, after, alreadyAppliedCheck) {
  if (alreadyAppliedCheck(src)) {
    console.log(`SKIP ${label}: 이미 적용됨`);
    return;
  }
  if (!src.includes(before)) {
    console.log(`X ${label}: anchor 못 찾음 — 이 줄을 그대로 알려주세요:`);
    console.log(`   찾던 문자열: ${before}`);
    anyFailed = true;
    return;
  }
  src = src.replace(before, after);
  changed = true;
  console.log(`OK ${label}: 패치 완료`);
}

// ── 1. PRESERVED_METADATA_KEYS 상수 선언 (promote 함수 바로 앞) ──────
applyPatch(
  '상수 선언',
  'async function promote(supabase, candidates) {',
  `// v1.4: 수동 큐레이션 태그는 재계산되는 통계 metadata 위에 보존
const PRESERVED_METADATA_KEYS = ['knowledge_class', 'review_trigger'];

async function promote(supabase, candidates) {`,
  (s) => s.includes('const PRESERVED_METADATA_KEYS = [')
);

// ── 2. select에 metadata 추가 ─────────────────────────────────────
applyPatch(
  'select 절',
  `.select('knowledge_type, pattern_key, status')`,
  `.select('knowledge_type, pattern_key, status, metadata')`,
  (s) => s.includes(`.select('knowledge_type, pattern_key, status, metadata')`)
);

// ── 3. existingMap이 status 대신 행 전체(e)를 저장 ────────────────
applyPatch(
  'existingMap 구성',
  `(existing || []).map((e) => [e.knowledge_type + ':' + e.pattern_key, e.status])`,
  `(existing || []).map((e) => [e.knowledge_type + ':' + e.pattern_key, e])`,
  (s) => s.includes(`(existing || []).map((e) => [e.knowledge_type + ':' + e.pattern_key, e])`)
);

// ── 4. currentStatus를 existingRow에서 파생 ───────────────────────
applyPatch(
  'currentStatus 파생',
  `    const currentStatus = existingMap.get(key);`,
  `    const existingRow = existingMap.get(key);
    const currentStatus = existingRow?.status;`,
  (s) => s.includes('const existingRow = existingMap.get(key);')
);

// ── 5. row 생성 시 metadata 병합 ──────────────────────────────────
applyPatch(
  'metadata 병합',
  `    const row = { ...c, source_core: 'CoreRing', status: 'candidate', updated_at: new Date().toISOString() };`,
  `    // 수동 큐레이션 태그(knowledge_class, review_trigger)는 재계산 시에도 보존
    const mergedMetadata = { ...(c.metadata || {}) };
    if (existingRow?.metadata) {
      for (const k of PRESERVED_METADATA_KEYS) {
        if (existingRow.metadata[k] !== undefined) mergedMetadata[k] = existingRow.metadata[k];
      }
    }

    const row = { ...c, metadata: mergedMetadata, source_core: 'CoreRing', status: 'candidate', updated_at: new Date().toISOString() };`,
  (s) => s.includes('mergedMetadata')
);

if (changed) {
  fs.writeFileSync(targetPath, src, 'utf8');
  console.log('\n→ scripts/promote-language-knowledge.js 저장 완료');
} else {
  console.log('\n→ 파일 변경 없음 (전부 SKIP 또는 전부 실패)');
}

if (anyFailed) {
  console.log('\n⚠️  일부 anchor가 안 맞았습니다. X로 표시된 "찾던 문자열"을 그대로 알려주시면');
  console.log('   실제 파일 내용과 대조해서 재조정하겠습니다. (배치 실행은 아직 하지 마세요)');
} else {
  console.log('\n✅ 5개 patch 전부 적용/확인됨.');
  console.log('   다음 순서 (검증 없이 재태깅 금지):');
  console.log('   1) 아래 SQL로 exact_ba에 임시 테스트 태그를 심어달라고 요청할 예정');
  console.log('   2) node scripts/promote-language-knowledge.js 실행');
  console.log('   3) DB 재조회로 테스트 태그가 살아있는지 확인 후에만 실제 재태깅 진행');
}
