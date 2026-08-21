// lib/tts.ts
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
