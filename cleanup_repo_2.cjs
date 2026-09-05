// cleanup_repo_2.cjs
// 목적: 판단 보류했던 나머지 2건 정리.
//   - lib/message.ts, lib/Message.js: grep 결과 어디서도 import 안 됨 -> 둘 다 삭제
//   - Master_Prompt_v2.0.md(루트): doc/directives/Master_Prompt_v2.0.md가 정본
//     (AI_Collaboration_Governance.md에 Level 0 문서로 명시된 경로) -> 루트 쪽 중복 삭제
//
// 실행: 저장소 루트에서 `node cleanup_repo_2.cjs`

const fs = require('fs');
const path = require('path');

console.log('🧹 저장소 정리 (2차) 시작...\n');

const filesToDelete = [
  path.join('lib', 'message.ts'),
  path.join('lib', 'Message.js'),
  'Master_Prompt_v2.0.md', // 루트 중복. doc/directives/Master_Prompt_v2.0.md가 정본
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
console.log('(이 스크립트 자체도 정리 끝나면 커밋에서 빼는 게 깔끔합니다)');
