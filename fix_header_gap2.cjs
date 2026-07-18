const fs = require("fs");
const path = "components/BrainHeader.module.css";
let content = fs.readFileSync(path, "utf8");

const re = /(\.actions\s*\{[^}]*gap:\s*var\()--space-2(\)[^}]*\})/;

if (/\.actions\s*\{[^}]*gap:\s*var\(--space-1\)/.test(content)) {
  console.log("SKIP 이미 적용됨");
} else if (re.test(content)) {
  content = content.replace(re, "$1--space-1$2");
  fs.writeFileSync(path, content, "utf8");
  console.log("OK .actions gap space-2 -> space-1 완료");
} else {
  console.log("X 정규식 매칭 실패");
}
