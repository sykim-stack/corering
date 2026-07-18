const fs = require("fs");
const path = "components/CorePhrase.tsx";
let content = fs.readFileSync(path, "utf8");

const re = /(<p className=\{styles\.flipWord\}>\{currentCard\?\.word\}<\/p>)\s*\n(\s*)(<p className=\{styles\.flipHint\}>탭해서 한국어 확인<\/p>)/;

if (content.includes("flipWord} style={{ margin: 0 }}")) {
  console.log("SKIP 이미 적용됨");
} else if (re.test(content)) {
  content = content.replace(re, (match, wordLine, indent, hintLine) => {
    const btn = "<button onClick={(e) => { e.stopPropagation(); if (typeof window !== 'undefined' && window.speechSynthesis) { const u = new SpeechSynthesisUtterance(currentCard?.word || ''); u.lang = 'vi-VN'; u.rate = 0.9; window.speechSynthesis.cancel(); window.speechSynthesis.speak(u); } }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', flexShrink: 0 }}>\u{1F50A}</button>";
    return indent + "<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>\n" +
           indent + "  <p className={styles.flipWord} style={{ margin: 0 }}>{currentCard?.word}</p>\n" +
           indent + "  " + btn + "\n" +
           indent + "</div>\n" +
           indent + hintLine;
  });
  fs.writeFileSync(path, content, "utf8");
  console.log("OK flipWord + 스피커 정규식으로 복원 완료");
} else {
  console.log("X 정규식 매칭 실패 - 파일 직접 확인 필요");
}
