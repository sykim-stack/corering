// patch_ios_fallback.cjs
const fs = require('fs');
const path = 'components/WordModal.tsx';
let content = fs.readFileSync(path, 'utf8');
let changed = false;

// Patch A: 녹음 실패 시 사용자 안내 (마이크 접근 실패)
const micBefore = [
  "    } catch (e) {",
  "      console.warn('마이크 실패:', e);",
  "    }",
  "  };"
].join("\n");

const micAfter = [
  "    } catch (e) {",
  "      console.warn('마이크 실패:', e);",
  "      alert('이 기기에서는 음성 녹음이 지원되지 않아요. 텍스트로 저장해주세요.');",
  "    }",
  "  };"
].join("\n");

if (content.includes(micAfter)) {
  console.log('SKIP A: 이미 적용됨 (마이크 실패 안내)');
} else if (content.includes(micBefore)) {
  content = content.replace(micBefore, micAfter);
  changed = true;
  console.log('OK A: 마이크 실패 시 안내 메시지 추가');
} else {
  console.log('X A: 마이크 실패 catch 블록 앵커 못 찾음 - 중단');
  process.exit(1);
}

// Patch B: recorder.onstop 안에서 blob 크기 체크 실패 시에도 안내
const blobBefore = "          if (blob.size > 1000) {";
const blobAfterCheck = [
  "          if (blob.size <= 1000) {",
  "            alert('녹음이 제대로 저장되지 않았어요. 이 기기에서는 녹음 기능이 원활하지 않을 수 있습니다.');",
  "          }",
  "          if (blob.size > 1000) {"
].join("\n");

if (content.includes("녹음이 제대로 저장되지 않았어요")) {
  console.log('SKIP B: 이미 적용됨 (blob 크기 실패 안내)');
} else if (content.includes(blobBefore)) {
  content = content.replace(blobBefore, blobAfterCheck);
  changed = true;
  console.log('OK B: 녹음 blob 크기 부족 시 안내 추가');
} else {
  console.log('X B: blob.size 체크 앵커 못 찾음 - 중단');
  process.exit(1);
}

// Patch C: TTS 재생 전 해당 언어 음성 지원 여부 체크
const ttsBefore = [
  "  const handlePlayAudio = () => {",
  "    if (audioUrl) {",
  "      const audio = new Audio(audioUrl);",
  "      audio.play().catch(() => { window.open(audioUrl, '_blank'); });",
  "    } else if (typeof window !== 'undefined' && window.speechSynthesis && meaning) {",
  "      const utterance = new SpeechSynthesisUtterance(meaning);",
  "      utterance.lang = sourceLang === 'ko' ? 'vi-VN' : 'ko-KR';",
  "      utterance.rate = 0.9;",
  "      window.speechSynthesis.cancel();",
  "      window.speechSynthesis.speak(utterance);",
  "    }",
  "  };"
].join("\n");

const ttsAfter = [
  "  const handlePlayAudio = () => {",
  "    if (audioUrl) {",
  "      const audio = new Audio(audioUrl);",
  "      audio.play().catch(() => { window.open(audioUrl, '_blank'); });",
  "    } else if (typeof window !== 'undefined' && window.speechSynthesis && meaning) {",
  "      const targetLang = sourceLang === 'ko' ? 'vi-VN' : 'ko-KR';",
  "      const voices = window.speechSynthesis.getVoices();",
  "      const hasVoice = voices.some(v => v.lang === targetLang || v.lang.startsWith(targetLang.split('-')[0]));",
  "      if (voices.length > 0 && !hasVoice) {",
  "        alert('이 기기에는 ' + (targetLang === 'vi-VN' ? '베트남어' : '한국어') + ' 음성이 설치되어 있지 않아요. 설정 > 손쉬운 사용 > 음성 콘텐츠에서 추가할 수 있어요.');",
  "        return;",
  "      }",
  "      const utterance = new SpeechSynthesisUtterance(meaning);",
  "      utterance.lang = targetLang;",
  "      utterance.rate = 0.9;",
  "      window.speechSynthesis.cancel();",
  "      window.speechSynthesis.speak(utterance);",
  "    }",
  "  };"
].join("\n");

if (content.includes('설정 > 손쉬운 사용')) {
  console.log('SKIP C: 이미 적용됨 (TTS 음성 체크)');
} else if (content.includes(ttsBefore)) {
  content = content.replace(ttsBefore, ttsAfter);
  changed = true;
  console.log('OK C: TTS 재생 전 음성 지원 여부 체크 추가');
} else {
  console.log('X C: handlePlayAudio 앵커 못 찾음 - 중단');
  process.exit(1);
}

if (changed) {
  fs.writeFileSync(path, content, 'utf8');
  console.log('=== WordModal.tsx 저장 완료 ===');
} else {
  console.log('=== 변경 사항 없음 (모두 이미 적용됨) ===');
}