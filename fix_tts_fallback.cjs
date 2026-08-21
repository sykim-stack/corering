// fix_tts_fallback.cjs
// 목적: WordModal / CorePhrase의 speechSynthesis TTS가 음성팩 없는 iOS 기기에서
//       엉뚱한 언어(주로 한국어)로 대체 재생되는 문제 수정.
// 방식: 재생 전 getVoices()로 대상 언어 음성 존재 여부를 확인하고,
//       없으면 아예 재생하지 않음 (오발음보다 무음이 낫다는 원칙).
// 실행: 저장소 루트(C:\brainpool-clean\brainpool-clean)에서 `node fix_tts_fallback.cjs`

const fs = require('fs');
const path = require('path');

console.log('🛡️ TTS Fallback 수정 시작...\n');

// ── STEP 1: lib/tts.ts 신규 생성 ──────────────────────────────────
const ttsLibPath = path.join('lib', 'tts.ts');

const ttsLibContent = `// lib/tts.ts
// 음성팩이 없는 기기에서 speechSynthesis가 다른 언어로 대체 재생되는 것을 방지하는 헬퍼.
// iOS Safari는 getVoices()가 첫 호출 시 빈 배열을 반환하고 비동기로
// 'voiceschanged' 이벤트 이후에 채워지는 경우가 있어, 이를 대기하는 로직 포함.

let voicesCache: SpeechSynthesisVoice[] | null = null;
let voicesPromise: Promise<SpeechSynthesisVoice[]> | null = null;

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === 'undefined' || !window.speechSynthesis) return Promise.resolve([]);
  if (voicesCache) return Promise.resolve(voicesCache);
  if (voicesPromise) return voicesPromise;

  voicesPromise = new Promise((resolve) => {
    const synth = window.speechSynthesis;
    const existing = synth.getVoices();
    if (existing.length > 0) {
      voicesCache = existing;
      resolve(existing);
      return;
    }

    const handler = () => {
      const voices = synth.getVoices();
      if (voices.length > 0) {
        voicesCache = voices;
        synth.removeEventListener('voiceschanged', handler);
        resolve(voices);
      }
    };
    synth.addEventListener('voiceschanged', handler);

    // voiceschanged가 끝내 안 오는 기기 대비 타임아웃
    setTimeout(() => {
      synth.removeEventListener('voiceschanged', handler);
      const voices = synth.getVoices();
      voicesCache = voices;
      resolve(voices);
    }, 1000);
  });

  return voicesPromise;
}

export async function hasVoiceForLang(lang: string): Promise<boolean> {
  const prefix = lang.split('-')[0].toLowerCase();
  const voices = await loadVoices();
  return voices.some((v) => v.lang.toLowerCase().startsWith(prefix));
}

/**
 * 지정된 언어의 음성팩이 기기에 있을 때만 재생합니다.
 * 없으면 재생하지 않고 false를 반환합니다.
 * (음성팩 없이 speak()를 강행하면 브라우저가 임의의 다른 언어 음성으로
 *  대체 재생 — 베트남어 텍스트를 한국어 음성으로 읽는 등의 오작동 원인)
 */
export async function speakIfVoiceAvailable(
  text: string,
  lang: string,
  rate = 0.9
): Promise<boolean> {
  if (typeof window === 'undefined' || !window.speechSynthesis || !text) return false;

  const available = await hasVoiceForLang(lang);
  if (!available) return false;

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = rate;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
  return true;
}
`;

if (fs.existsSync(ttsLibPath)) {
  console.log('SKIP lib/tts.ts 이미 존재함 (덮어쓰지 않음)');
} else {
  fs.writeFileSync(ttsLibPath, ttsLibContent, 'utf8');
  console.log('OK lib/tts.ts 생성 완료');
}

// ── STEP 2: WordModal.tsx 패치 ────────────────────────────────────
const wordModalPath = path.join('components', 'WordModal.tsx');
let wm = fs.readFileSync(wordModalPath, 'utf8');
let wmChanged = false;

// 2-1. import 추가
const wmImportAnchor = "import styles from './WordModal.module.css';";
if (!wm.includes("from '@/lib/tts'")) {
  if (wm.includes(wmImportAnchor)) {
    wm = wm.replace(
      wmImportAnchor,
      `${wmImportAnchor}\nimport { speakIfVoiceAvailable } from '@/lib/tts';`
    );
    wmChanged = true;
    console.log('OK WordModal.tsx: import 추가');
  } else {
    console.log('X WordModal.tsx: import anchor 못 찾음 — 수동 확인 필요');
  }
} else {
  console.log('SKIP WordModal.tsx: import 이미 있음');
}

// 2-2. state 추가
const wmStateAnchor = '  const [wordDetail, setWordDetail] = useState<any>(null);';
if (!wm.includes('ttsUnavailable')) {
  if (wm.includes(wmStateAnchor)) {
    wm = wm.replace(
      wmStateAnchor,
      `${wmStateAnchor}\n  const [ttsUnavailable, setTtsUnavailable] = useState(false);`
    );
    wmChanged = true;
    console.log('OK WordModal.tsx: ttsUnavailable state 추가');
  } else {
    console.log('X WordModal.tsx: state anchor 못 찾음 — 수동 확인 필요');
  }
} else {
  console.log('SKIP WordModal.tsx: state 이미 있음');
}

// 2-3. handlePlayAudio 교체
const wmHandlerBefore = `  const handlePlayAudio = () => {
    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audio.play().catch(() => { window.open(audioUrl, '_blank'); });
    } else if (typeof window !== 'undefined' && window.speechSynthesis && meaning) {
      const utterance = new SpeechSynthesisUtterance(meaning);
      utterance.lang = sourceLang === 'ko' ? 'vi-VN' : 'ko-KR';
      utterance.rate = 0.9;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    }
  };`;

const wmHandlerAfter = `  const handlePlayAudio = async () => {
    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audio.play().catch(() => { window.open(audioUrl, '_blank'); });
      return;
    }
    if (!meaning) return;
    const lang = sourceLang === 'ko' ? 'vi-VN' : 'ko-KR';
    const played = await speakIfVoiceAvailable(meaning, lang);
    if (!played) {
      setTtsUnavailable(true);
      setTimeout(() => setTtsUnavailable(false), 2500);
    }
  };`;

if (wm.includes(wmHandlerAfter)) {
  console.log('SKIP WordModal.tsx: handlePlayAudio 이미 패치됨');
} else if (wm.includes(wmHandlerBefore)) {
  wm = wm.replace(wmHandlerBefore, wmHandlerAfter);
  wmChanged = true;
  console.log('OK WordModal.tsx: handlePlayAudio 패치 완료');
} else {
  console.log('X WordModal.tsx: handlePlayAudio anchor 못 찾음 — 수동 확인 필요');
}

// 2-4. 안내 문구 UI 추가
const wmUiAnchor = '        <p className={styles.subtitle}>단어 학습 카드</p>';
const wmUiBlock = `        <p className={styles.subtitle}>단어 학습 카드</p>
        {ttsUnavailable && (
          <p className={styles.subtitle} style={{ color: 'var(--color-warn)', marginTop: '-8px' }}>
            🔇 이 기기에 발음 음성팩이 없어요
          </p>
        )}`;

if (wm.includes('이 기기에 발음 음성팩이 없어요')) {
  console.log('SKIP WordModal.tsx: 안내 문구 이미 있음');
} else if (wm.includes(wmUiAnchor)) {
  wm = wm.replace(wmUiAnchor, wmUiBlock);
  wmChanged = true;
  console.log('OK WordModal.tsx: 안내 문구 UI 추가');
} else {
  console.log('X WordModal.tsx: UI anchor 못 찾음 — 수동 확인 필요');
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

// 3-1. import 추가
const cpImportAnchor = "import styles from './CorePhrase.module.css';";
if (!cp.includes("from '@/lib/tts'")) {
  if (cp.includes(cpImportAnchor)) {
    cp = cp.replace(
      cpImportAnchor,
      `${cpImportAnchor}\nimport { speakIfVoiceAvailable } from '@/lib/tts';`
    );
    cpChanged = true;
    console.log('OK CorePhrase.tsx: import 추가');
  } else {
    console.log('X CorePhrase.tsx: import anchor 못 찾음 — 수동 확인 필요');
  }
} else {
  console.log('SKIP CorePhrase.tsx: import 이미 있음');
}

// 3-2. 리스트 카드 스피커 버튼
const cpListBefore = `onClick={(e) => { e.stopPropagation(); if (typeof window !== 'undefined' && window.speechSynthesis) { const u = new SpeechSynthesisUtterance(item.word); u.lang = 'vi-VN'; u.rate = 0.9; window.speechSynthesis.cancel(); window.speechSynthesis.speak(u); } }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', opacity: 0.7, flexShrink: 0 }}>🔊</button>`;
const cpListAfter = `onClick={(e) => { e.stopPropagation(); speakIfVoiceAvailable(item.word, 'vi-VN'); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', opacity: 0.7, flexShrink: 0 }}>🔊</button>`;

if (cp.includes(cpListAfter)) {
  console.log('SKIP CorePhrase.tsx: 리스트 카드 스피커 이미 패치됨');
} else if (cp.includes(cpListBefore)) {
  cp = cp.replace(cpListBefore, cpListAfter);
  cpChanged = true;
  console.log('OK CorePhrase.tsx: 리스트 카드 스피커 패치 완료');
} else {
  console.log('X CorePhrase.tsx: 리스트 카드 anchor 못 찾음 — 수동 확인 필요');
}

// 3-3. 플립카드 스피커 버튼
const cpFlipBefore = `onClick={(e) => { e.stopPropagation(); if (typeof window !== 'undefined' && window.speechSynthesis) { const u = new SpeechSynthesisUtterance(currentCard?.word || ''); u.lang = 'vi-VN'; u.rate = 0.9; window.speechSynthesis.cancel(); window.speechSynthesis.speak(u); } }}`;
const cpFlipAfter = `onClick={(e) => { e.stopPropagation(); speakIfVoiceAvailable(currentCard?.word || '', 'vi-VN'); }}`;

if (cp.includes(cpFlipAfter)) {
  console.log('SKIP CorePhrase.tsx: 플립카드 스피커 이미 패치됨');
} else if (cp.includes(cpFlipBefore)) {
  cp = cp.replace(cpFlipBefore, cpFlipAfter);
  cpChanged = true;
  console.log('OK CorePhrase.tsx: 플립카드 스피커 패치 완료');
} else {
  console.log('X CorePhrase.tsx: 플립카드 anchor 못 찾음 — 수동 확인 필요');
}

if (cpChanged) {
  fs.writeFileSync(corePhrasePath, cp, 'utf8');
  console.log('→ CorePhrase.tsx 저장 완료\n');
} else {
  console.log('→ CorePhrase.tsx 변경 없음\n');
}

console.log('✅ 완료. `npx next build`로 빌드 확인 후 커밋하세요.');
console.log('   (ChatBubble.tsx는 동일 버그가 있으나 이번 범위에서 제외됨 — 별도 요청 시 처리)');
