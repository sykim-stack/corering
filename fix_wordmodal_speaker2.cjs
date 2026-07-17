const fs = require("fs");
const path = "components/WordModal.tsx";
let content = fs.readFileSync(path, "utf8");

const before = "minWidth: '36px', minHeight: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}";
const after = "minWidth: '36px', minHeight: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '5px' }}";

if (content.includes(after)) {
  console.log("SKIP 이미 적용됨");
} else if (content.includes(before)) {
  content = content.replace(before, after);
  fs.writeFileSync(path, content, "utf8");
  console.log("OK WordModal 스피커 5px 아래로 이동 완료");
} else {
  console.log("X 대상 문자열 못 찾음");
}
