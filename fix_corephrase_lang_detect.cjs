// fix_corephrase_lang_detect.cjs
// 목적: CorePhrase(학습하기) 스피커 버튼이 언어를 'vi-VN'으로 고정해놔서,
//   저장된 단어가 한국어인 경우에도 베트남어 발음 엔진으로 읽어버리는 문제 수정.
//
// 원인: WordModal에서 단어 저장 시 word = data.sentence(원문 메시지 그대로)라
//   누가 보냈느냐에 따라 한국어/베트남어가 섞여 저장됨. user_vocabulary
//   테이블에 언어 구분 컬럼이 없어서, CorePhrase는 무조건 베트남어라고
//   가정하고 있었음.
//
// 근본 해결(언어 컬럼 추가)은 스키마 변경이라 범위가 커짐. 대신 이
//   코드베이스에 이미 쓰이는 방식(brain-engine/engines/language/detect.js의
//   한글 정규식 감지)과 동일한 방법으로 재생 직전에 텍스트를 보고 언어를
//   판단하도록 수정. 새 기법 도입 아님 — 기존 패턴 재사용.
//
// 실행: 저장소 루트에서 `node fix_corephrase_lang_detect.cjs`

const fs = require('fs');
const path = require('path');

console.log('🛡️ CorePhrase 언어 감지 수정 시작...\n');

const targetPath = path.join('components', 'CorePhrase.tsx');
let src = fs.readFileSync(targetPath, 'utf8');
let changed = false;

// ── 1. import 바로 뒤에 언어 감지 헬퍼 추가 ────────────────────────
const importAnchor = `import { speakNow } from '@/lib/tts';`;
const importAfter = `import { speakNow } from '@/lib/tts';

// word 필드가 한국어/베트남어 어느 쪽이든 저장될 수 있어(원문 메시지 그대로
// 저장되는 구조), 재생 직전에 한글 포함 여부로 언어를 판단한다.
// (brain-engine/engines/language/detect.js와 동일한 감지 방식)
const detectSpeechLang = (text: string) => (/[가-힣]/.test(text) ? 'ko-KR' : 'vi-VN');`;

if (src.includes('detectSpeechLang')) {
  console.log('SKIP 언어 감지 헬퍼: 이미 있음');
} else if (src.includes(importAnchor)) {
  src = src.replace(importAnchor, importAfter);
  changed = true;
  console.log('OK 언어 감지 헬퍼 추가');
} else {
  console.log('X import anchor 못 찾음 — 수동 확인 필요');
}

// ── 2. 리스트 카드 스피커: 'vi-VN' 고정 -> 동적 감지 ────────────────
const listBefore = `onClick={(e) => { e.stopPropagation(); speakNow(item.word, 'vi-VN'); }}`;
const listAfter = `onClick={(e) => { e.stopPropagation(); speakNow(item.word, detectSpeechLang(item.word)); }}`;

if (src.includes(listAfter)) {
  console.log('SKIP 리스트 카드: 이미 적용됨');
} else if (src.includes(listBefore)) {
  src = src.replace(listBefore, listAfter);
  changed = true;
  console.log('OK 리스트 카드 스피커: 동적 언어 감지 적용');
} else {
  console.log('X 리스트 카드 anchor 못 찾음 — 수동 확인 필요');
}

// ── 3. 플립카드 스피커: 'vi-VN' 고정 -> 동적 감지 ───────────────────
const flipBefore = `onClick={(e) => { e.stopPropagation(); speakNow(currentCard?.word || '', 'vi-VN'); }}`;
const flipAfter = `onClick={(e) => { e.stopPropagation(); speakNow(currentCard?.word || '', detectSpeechLang(currentCard?.word || '')); }}`;

if (src.includes(flipAfter)) {
  console.log('SKIP 플립카드: 이미 적용됨');
} else if (src.includes(flipBefore)) {
  src = src.replace(flipBefore, flipAfter);
  changed = true;
  console.log('OK 플립카드 스피커: 동적 언어 감지 적용');
} else {
  console.log('X 플립카드 anchor 못 찾음 — 수동 확인 필요');
}

if (changed) {
  fs.writeFileSync(targetPath, src, 'utf8');
  console.log('\n→ CorePhrase.tsx 저장 완료');
} else {
  console.log('\n→ 변경 없음');
}

console.log('\n✅ 완료. `npx next build` → 커밋 → push → Vercel 배포 확인 후');
console.log('   한국어로 저장된 단어와 베트남어로 저장된 단어 둘 다 재생해서');
console.log('   각각 올바른 언어로 읽히는지 확인하세요.');
