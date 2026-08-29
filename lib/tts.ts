// lib/tts.ts
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
