const fs = require("fs");
const path = "components/CorePhrase.tsx";
let content = fs.readFileSync(path, "utf8");

const before = [
  "              <p className={styles.flipWord}>{currentCard?.word}</p>",
  "              <p className={styles.flipHint}>탭해서 한국어 확인</p>"
].join("\n");

const after = [
  "              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>",
  "                <p className={styles.flipWord} style={{ margin: 0 }}>{currentCard?.word}</p>",
  "              </div>",
  "              <p className={styles.flipHint}>탭해서 한국어 확인</p>"
].join("\n");

if (content.includes(after)) {
  console.log("SKIP 이미 적용됨 (flipWord wrap)");
} else if (content.includes(before)) {
  content = content.replace(before, after);
  fs.writeFileSync(path, content, "utf8");
  console.log("OK flipWord 감싸는 div 추가 완료");
} else {
  console.log("X flipWord/flipHint 대상 못 찾음");
}

fs.writeFileSync(path, content, "utf8");

// 이제 버튼을 그 div 안으로 이동
const btnBefore = [
  "              <button",
  "                onClick={(e) => { e.stopPropagation(); if (typeof window !== 'undefined' && window.speechSynthesis) { const u = new SpeechSynthesisUtterance(currentCard?.word || ''); u.lang = 'vi-VN'; u.rate = 0.9; window.speechSynthesis.cancel(); window.speechSynthesis.speak(u); } }}",
  "                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '24px', marginTop: '8px' }}",
  "              >🔊</button>"
].join("\n");

if (content.includes(btnBefore)) {
  content = content.replace(btnBefore, "");
  content = content.replace(
    "                <p className={styles.flipWord} style={{ margin: 0 }}>{currentCard?.word}</p>",
    "                <p className={styles.flipWord} style={{ margin: 0 }}>{currentCard?.word}</p>\n                <button onClick={(e) => { e.stopPropagation(); if (typeof window !== 'undefined' && window.speechSynthesis) { const u = new SpeechSynthesisUtterance(currentCard?.word || ''); u.lang = 'vi-VN'; u.rate = 0.9; window.speechSynthesis.cancel(); window.speechSynthesis.speak(u); } }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', flexShrink: 0 }}>🔊</button>"
  );
  fs.writeFileSync(path, content, "utf8");
  console.log("OK 버튼을 flipWord 옆으로 이동 완료");
} else {
  console.log("X 버튼 대상 못 찾음 (이미 이동됐을 수 있음)");
}
