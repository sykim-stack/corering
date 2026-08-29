// fix_wordmodal_recording_toggle.cjs
// 목적: WordModal.tsx의 "친구에게 발음 알려주기" 녹음 버튼을
//   press-and-hold(누르고 있기) -> tap-to-toggle(탭 한 번 시작/종료)로 전환.
//
// 근거: ChatInput.tsx(채팅 음성입력)가 이미 겪은 것과 같은 종류의 문제.
//   0820 세션에서 press-and-hold의 근본적 불안정성 때문에 tap-to-toggle로
//   전환했고 Android/PC에서 검증됨. 이번에 Android(S25)에서 WordModal
//   녹음이 blob.size<=1000(사실상 빈 녹음)으로 실패하는 증상이 재현됐는데,
//   이는 WordModal 녹음 버튼만 그 전환이 누락돼 있었기 때문으로 보임.
//   iOS 전용 문제가 아니라 플랫폼 공통의 press-and-hold 불안정성.
//
// 추가로 정리:
//   - handlePlayAudio가 lib/tts의 speakNow를 import만 하고 실제로는 안 쓰고
//     예전 인라인 음성 체크 로직이 남아있던 것을 정리 (speakNow로 통합).
//   - 녹음 재생(audioUrl 분기)에 iOS playsInline 패치 적용
//     (지난 시도에서 anchor 불일치로 적용 안 됐던 부분, 이번엔 실제 파일
//      원문 그대로 anchor 구성).
//
// 실행: 저장소 루트에서 `node fix_wordmodal_recording_toggle.cjs`

const fs = require('fs');
const path = require('path');

console.log('🛡️ WordModal 녹음 버튼 tap-to-toggle 전환 시작...\n');

const targetPath = path.join('components', 'WordModal.tsx');
let src = fs.readFileSync(targetPath, 'utf8');
let changed = false;

// ── 1. handlePlayAudio 통합 (speakNow 사용 + playsInline 적용) ─────
const handlePlayBefore = `  const handlePlayAudio = () => {
    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audio.play().catch(() => { window.open(audioUrl, '_blank'); });
    } else if (typeof window !== 'undefined' && window.speechSynthesis && meaning) {
      const targetLang = sourceLang === 'ko' ? 'vi-VN' : 'ko-KR';
      const voices = window.speechSynthesis.getVoices();
      const hasVoice = voices.some(v => v.lang === targetLang || v.lang.startsWith(targetLang.split('-')[0]));
      if (voices.length > 0 && !hasVoice) {
        alert('이 기기에는 ' + (targetLang === 'vi-VN' ? '베트남어' : '한국어') + ' 음성이 설치되어 있지 않아요. 설정 > 손쉬운 사용 > 음성 콘텐츠에서 추가할 수 있어요.');
        return;
      }
      const utterance = new SpeechSynthesisUtterance(meaning);
      utterance.lang = targetLang;
      utterance.rate = 0.9;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    }
  };`;

const handlePlayAfter = `  const handlePlayAudio = () => {
    if (audioUrl) {
      // iOS 호환: new Audio() 직접 재생이 실패하는 경우가 있어 playsInline 적용
      const audio = document.createElement('audio');
      audio.src = audioUrl;
      audio.controls = false;
      (audio as any).playsInline = true;
      document.body.appendChild(audio);
      audio.play().catch(() => { window.open(audioUrl, '_blank'); });
      audio.onended = () => document.body.removeChild(audio);
      return;
    }
    if (!meaning) return;
    const lang = sourceLang === 'ko' ? 'vi-VN' : 'ko-KR';
    const played = speakNow(meaning, lang);
    if (!played) {
      setTtsUnavailable(true);
      setTimeout(() => setTtsUnavailable(false), 2500);
    }
  };`;

if (src.includes('document.createElement(\'audio\')') && src.includes('speakNow(meaning, lang)')) {
  console.log('SKIP handlePlayAudio: 이미 적용됨');
} else if (src.includes(handlePlayBefore)) {
  src = src.replace(handlePlayBefore, handlePlayAfter);
  changed = true;
  console.log('OK handlePlayAudio: speakNow + playsInline 통합 완료');
} else {
  console.log('X handlePlayAudio anchor 못 찾음 — 현재 함수 내용을 다시 붙여주세요');
}

// ── 2. 녹음 버튼: press-and-hold -> tap-to-toggle ──────────────────
const buttonBefore = `            <button
              onTouchStart={(e) => { e.preventDefault(); e.stopPropagation(); startRecording(); }}
              onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); stopRecording(); }}
              onContextMenu={(e) => e.preventDefault()}
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              style={{ width: '100%', userSelect: 'none', WebkitUserSelect: 'none' }}
              disabled={isUploading}
              className={\`\${styles.saveBtn} \${isRecording ? styles.recordingBtn : ''}\`}
            >
              {isUploading ? '⏳ 저장 중...' : isRecording ? '🔴 녹음 중... (떼면 완료)' : '🎤 누르고 말하세요'}
            </button>`;

const buttonAfter = `            <button
              onClick={() => { if (isRecording) stopRecording(); else startRecording(); }}
              style={{ width: '100%', userSelect: 'none', WebkitUserSelect: 'none' }}
              disabled={isUploading}
              className={\`\${styles.saveBtn} \${isRecording ? styles.recordingBtn : ''}\`}
            >
              {isUploading ? '⏳ 저장 중...' : isRecording ? '🔴 녹음 중... (다시 눌러 종료)' : '🎤 눌러서 녹음 시작'}
            </button>`;

if (src.includes('눌러서 녹음 시작')) {
  console.log('SKIP 녹음 버튼: 이미 tap-to-toggle로 전환됨');
} else if (src.includes(buttonBefore)) {
  src = src.replace(buttonBefore, buttonAfter);
  changed = true;
  console.log('OK 녹음 버튼: tap-to-toggle 전환 완료');
} else {
  console.log('X 녹음 버튼 anchor 못 찾음 — 현재 버튼 JSX를 다시 붙여주세요');
}

if (changed) {
  fs.writeFileSync(targetPath, src, 'utf8');
  console.log('\n→ WordModal.tsx 저장 완료');
} else {
  console.log('\n→ 변경 없음');
}

console.log('\n✅ 완료. `npx next build` → 커밋 → push → Vercel 배포 확인 후');
console.log('   S25에서 녹음 버튼을 탭(누르고 떼기 아님) → 다시 탭해서 종료 → 재생까지 테스트하세요.');
