// fix_tts_ios_gesture.cjs
// 목적: iOS에서 음성팩이 설치돼 있는데도 TTS가 무음으로 실패하는 문제 수정.
//
// 진단 근거 (아이폰 실기기 확인):
//   - 베트남어 음성팩 설치 확인됨
//   - "음성팩 없어요" 경고 메시지 안 뜸 -> speakIfVoiceAvailable()이 음성팩을
//     "있음"으로 정상 판단하고 실제로 speak()를 호출했다는 뜻
//   - 그런데도 소리가 안 남
//   => iOS WebKit은 speechSynthesis.speak()가 사용자 클릭 핸들러 안에서
//      "동기적으로" 호출되지 않으면(중간에 await가 끼면) 신뢰된 사용자
//      제스처로 인정하지 않고 에러 없이 조용히 무시함. 기존 구현이
//      await hasVoiceForLang(...) 이후에 speak()를 호출하는 구조라 이 함정에 걸림.
//
// 수정: 클릭 핸들러 안에서 await 없이 곧바로 호출하는 speakNow()를 신설.
//   getVoices()는 동기 호출 + 최초 1회 캐시 워밍업(voiceschanged 리스너)만 사용.
//   음성팩 오탐지 방지(v1의 원래 목적)는 그대로 유지됨.
//
// 실행: 저장소 루트에서 `node fix_tts_ios_gesture.cjs`

const fs = require('fs');
const path = require('path');

console.log('🛡️ TTS iOS 사용자 제스처 정책 대응 패치 시작...\n');

// ── STEP 1: lib/tts.ts 전체 교체 ───────────────────────────────────
const ttsLibPath = path.join('lib', 'tts.ts');

const ttsLibContent = `// lib/tts.ts
// v2: iOS WebKit는 speechSynthesis.speak()가 사용자 제스처(클릭) 핸들러
// 안에서 "동기적으로" 호출되지 않으면(중간에 await가 끼면) 에러 없이
// 조용히 무시한다. 클릭 핸들러에서는 반드시 speakNow()를 사용할 것.
//
// 음성팩이 없는 언어로 speak()를 강행하면 브라우저가 임의의 다른 언어
// 음성으로 대체 재생하는 문제(v1에서 다루던 문제)는 getVoices() 동기
// 체크로 계속 방지한다.

let cachedVoices: SpeechSynthesisVoice[] = [];

function refreshVoicesCache() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) cachedVoices = voices;
}

if (typeof window !== 'undefined' && window.speechSynthesis) {
  refreshVoicesCache();
  window.speechSynthesis.addEventListener('voiceschanged', refreshVoicesCache);
}

function hasVoiceForLangSync(lang: string): boolean {
  refreshVoicesCache();
  const prefix = lang.split('-')[0].toLowerCase();
  return cachedVoices.some((v) => v.lang.toLowerCase().startsWith(prefix));
}

/**
 * 클릭 핸들러 안에서 await 없이 곧바로 호출해야 합니다.
 * (iOS WebKit의 "신뢰된 사용자 제스처" 요구사항 때문 — 중간에 await가
 *  끼면 speak()가 에러 없이 조용히 무시됨)
 * 음성팩이 없으면 재생하지 않고 false를 반환합니다.
 */
export function speakNow(text: string, lang: string, rate = 0.9): boolean {
  if (typeof window === 'undefined' || !window.speechSynthesis || !text) return false;
  if (!hasVoiceForLangSync(lang)) return false;

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = rate;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
  return true;
}

// ── 아래는 v1 호환용 (비동기 버전). 클릭 핸들러에는 사용하지 말 것 —
//    await로 인해 iOS에서 조용히 실패함. 사전 워밍업 등 용도로만 유지. ──
let voicesPromise: Promise<SpeechSynthesisVoice[]> | null = null;

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === 'undefined' || !window.speechSynthesis) return Promise.resolve([]);
  if (cachedVoices.length > 0) return Promise.resolve(cachedVoices);
  if (voicesPromise) return voicesPromise;

  voicesPromise = new Promise((resolve) => {
    const synth = window.speechSynthesis;
    const handler = () => {
      refreshVoicesCache();
      if (cachedVoices.length > 0) {
        synth.removeEventListener('voiceschanged', handler);
        resolve(cachedVoices);
      }
    };
    synth.addEventListener('voiceschanged', handler);
    setTimeout(() => {
      synth.removeEventListener('voiceschanged', handler);
      refreshVoicesCache();
      resolve(cachedVoices);
    }, 1000);
  });

  return voicesPromise;
}

export async function hasVoiceForLang(lang: string): Promise<boolean> {
  const voices = await loadVoices();
  const prefix = lang.split('-')[0].toLowerCase();
  return voices.some((v) => v.lang.toLowerCase().startsWith(prefix));
}

/** @deprecated 클릭 핸들러에는 speakNow()를 사용하세요 (iOS 사용자 제스처 문제) */
export async function speakIfVoiceAvailable(text: string, lang: string, rate = 0.9): Promise<boolean> {
  await loadVoices();
  return speakNow(text, lang, rate);
}
`;

if (fs.readFileSync(ttsLibPath, 'utf8').includes('speakNow')) {
  console.log('SKIP lib/tts.ts 이미 v2로 교체됨');
} else {
  fs.writeFileSync(ttsLibPath, ttsLibContent, 'utf8');
  console.log('OK lib/tts.ts v2로 전체 교체 완료 (speakNow 추가)');
}

// ── STEP 2: WordModal.tsx 패치 ────────────────────────────────────
const wordModalPath = path.join('components', 'WordModal.tsx');
let wm = fs.readFileSync(wordModalPath, 'utf8');
let wmChanged = false;

const wmPatches = [
  {
    label: 'import',
    before: `import { speakIfVoiceAvailable } from '@/lib/tts';`,
    after: `import { speakNow } from '@/lib/tts';`,
  },
  {
    label: 'handlePlayAudio 시그니처 (async 제거)',
    before: `  const handlePlayAudio = async () => {`,
    after: `  const handlePlayAudio = () => {`,
  },
  {
    label: 'speakNow 동기 호출로 교체',
    before: `    const played = await speakIfVoiceAvailable(meaning, lang);`,
    after: `    const played = speakNow(meaning, lang);`,
  },
];

for (const p of wmPatches) {
  if (wm.includes(p.after) && !wm.includes(p.before)) {
    console.log(`SKIP WordModal.tsx (${p.label}): 이미 적용됨`);
  } else if (wm.includes(p.before)) {
    wm = wm.replace(p.before, p.after);
    wmChanged = true;
    console.log(`OK WordModal.tsx (${p.label}): 패치 완료`);
  } else {
    console.log(`X WordModal.tsx (${p.label}): anchor 못 찾음 — 수동 확인 필요`);
  }
}

if (wmChanged) {
  fs.writeFileSync(wordModalPath, wm, 'utf8');
  console.log('→ WordModal.tsx 저장 완료\n');
} else {
  console.log('→ WordModal.tsx 변경 없음\n');
}

// ── STEP 3: CorePhrase.tsx 패치 ───────────────────────────────────
const corePhrasePath = path.join('components', 'CorePhrase.tsx');
let cp = fs.readFileSync(corePhrasePath, 'utf8');
let cpChanged = false;

const cpPatches = [
  {
    label: 'import',
    before: `import { speakIfVoiceAvailable } from '@/lib/tts';`,
    after: `import { speakNow } from '@/lib/tts';`,
  },
  {
    label: '리스트 카드 speakNow로 교체',
    before: `onClick={(e) => { e.stopPropagation(); speakIfVoiceAvailable(item.word, 'vi-VN'); }}`,
    after: `onClick={(e) => { e.stopPropagation(); speakNow(item.word, 'vi-VN'); }}`,
  },
  {
    label: '플립카드 speakNow로 교체',
    before: `onClick={(e) => { e.stopPropagation(); speakIfVoiceAvailable(currentCard?.word || '', 'vi-VN'); }}`,
    after: `onClick={(e) => { e.stopPropagation(); speakNow(currentCard?.word || '', 'vi-VN'); }}`,
  },
];

for (const p of cpPatches) {
  if (cp.includes(p.after) && !cp.includes(p.before)) {
    console.log(`SKIP CorePhrase.tsx (${p.label}): 이미 적용됨`);
  } else if (cp.includes(p.before)) {
    cp = cp.replace(p.before, p.after);
    cpChanged = true;
    console.log(`OK CorePhrase.tsx (${p.label}): 패치 완료`);
  } else {
    console.log(`X CorePhrase.tsx (${p.label}): anchor 못 찾음 — 수동 확인 필요`);
  }
}

if (cpChanged) {
  fs.writeFileSync(corePhrasePath, cp, 'utf8');
  console.log('→ CorePhrase.tsx 저장 완료\n');
} else {
  console.log('→ CorePhrase.tsx 변경 없음\n');
}

console.log('✅ 완료. `npx next build`로 빌드 확인 후 커밋 + push + Vercel 배포 확인까지 마친 뒤');
console.log('   아이폰에서 재테스트하세요. (배포 안 하면 이전 코드로 계속 테스트하게 됩니다)');
