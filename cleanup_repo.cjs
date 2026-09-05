// cleanup_repo.cjs
// 목적: 이미 적용 끝난 일회성 patch script들, 빈 파일, 죽은 잔재 삭제.
// 확실히 안전하다고 판단된 것만 포함 (아직 판단 보류 중인 것 제외):
//   - lib/message.ts vs lib/Message.js 중복 (grep 확인 대기)
//   - Master_Prompt_v2.0.md 중복 위치 (의도 확인 대기)
//
// git으로 추적 중인 파일이라 실수로 지워도 `git checkout -- <path>`로
// 복구 가능. 그래도 삭제 전 목록을 먼저 확인하고 진행할 것.
//
// 실행: 저장소 루트에서 `node cleanup_repo.cjs`

const fs = require('fs');
const path = require('path');

console.log('🧹 저장소 정리 시작...\n');

const filesToDelete = [
  // ── 이미 적용 끝난 일회성 patch script (누적) ──
  'fix_ios_audio.cjs',
  'fix_roomcode.cjs',
  'fix_deeplink.cjs',
  'fix_restore_join.cjs',
  'fix_invite_bugs1.cjs',
  'fix_invite_bugs2.cjs',
  'fix_invite_bugs3.cjs',
  'fix_scroll.cjs',
  'fix_push_url.cjs',
  'fix_corephrase_speaker.cjs',
  'fix_wordmodal_speaker.cjs',
  'fix_playsinline.cjs',
  'task02_apply.ps1',
  'fix_tts_fallback.cjs',
  'fix_repetition_count.cjs',
  'fix_promote_metadata_preserve.cjs',    // v1, 버그 있던 버전 (v2로 대체됨)
  'fix_promote_metadata_preserve_v2.cjs',
  'fix_wordmodal_recorded_audio_ios.cjs',
  'fix_tts_ios_gesture.cjs',
  'fix_wordmodal_audio_diagnostic.cjs',   // 실행한 적 없는 진단용
  'fix_wordmodal_recording_toggle.cjs',
  'fix_corephrase_lang_detect.cjs',

  // ── 빈 파일 ──
  'demo.js',
  path.join('doc', 'API.md'),

  // ── 코드 잔재 ──
  path.join('brain-engine', 'layers', 'CoreNullLayer.js.bak'),

  // ── 실수로 커밋된 것으로 보이는 로그성 덤프 ──
  'structure.txt',
];

let deleted = 0;
let missing = 0;

for (const rel of filesToDelete) {
  if (fs.existsSync(rel)) {
    fs.unlinkSync(rel);
    console.log('OK 삭제:', rel);
    deleted++;
  } else {
    console.log('SKIP 이미 없음:', rel);
    missing++;
  }
}

console.log(`\n결과: 삭제 ${deleted}건, 이미 없음 ${missing}건`);
console.log('\n다음: git status로 확인 → git add -A → git commit → push');
console.log('(실수로 지운 게 있으면 git checkout -- <path>로 복구 가능, push 전이라면)');
console.log('\n판단 보류 중인 것 (이번엔 안 지움):');
console.log('  - lib/message.ts vs lib/Message.js 중복 (grep 확인 필요)');
console.log('  - Master_Prompt_v2.0.md 루트 vs doc/directives 중복 (의도 확인 필요)');
