// fix_wordmodal_recorded_audio_ios.cjs
// 목적: WordModal.tsx의 "발음 알려주기" 녹음 재생이 iOS에서
//       new Audio().play() 실패 -> window.open() 팝업으로 새는 문제 수정.
//
// 근거: ChatBubble.tsx는 동일한 녹음 재생 구조에 이미
//   document.createElement('audio') + playsInline = true 패치가 적용돼
//   iOS에서 정상 동작 확인된 상태 (0809 세션). WordModal.tsx만 그 패치가
//   누락돼 있었음 (TTS 폴백 작업 시 이 부분은 건드리지 않았음).
//   이미 검증된 패턴을 그대로 이식하는 것이라 추측성 수정 아님.
//
// 실행: 저장소 루트에서 `node fix_wordmodal_recorded_audio_ios.cjs`

const fs = require('fs');
const path = require('path');

console.log('🛡️ WordModal 녹음 재생 iOS 패치 시작...\n');

const targetPath = path.join('components', 'WordModal.tsx');
let src = fs.readFileSync(targetPath, 'utf8');

const before = `    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audio.play().catch(() => { window.open(audioUrl, '_blank'); });
      return;
    }`;

const after = `    if (audioUrl) {
      // iOS 호환: new Audio() 직접 재생이 실패하는 경우가 있어
      // ChatBubble.tsx와 동일한 방식(document.createElement + playsInline)으로 통일
      const audio = document.createElement('audio');
      audio.src = audioUrl;
      audio.controls = false;
      (audio as any).playsInline = true;
      document.body.appendChild(audio);
      audio.play().catch(() => { window.open(audioUrl, '_blank'); });
      audio.onended = () => document.body.removeChild(audio);
      return;
    }`;

if (src.includes('playsInline = true')) {
  console.log('SKIP 이미 패치됨');
} else if (src.includes(before)) {
  src = src.replace(before, after);
  fs.writeFileSync(targetPath, src, 'utf8');
  console.log('OK WordModal.tsx: 녹음 재생 iOS 패치 완료');
} else {
  console.log('X anchor 못 찾음 — 현재 handlePlayAudio 함수 내용을 붙여주시면 재조정하겠습니다');
}

console.log('\n완료. `npx next build`로 빌드 확인 후 커밋하세요.');
