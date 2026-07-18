const fs = require("fs");
const path = "components/BrainHeader.module.css";
let content = fs.readFileSync(path, "utf8");
let changed = false;

const actionsBefore = ".actions {\n  display: flex;\n  align-items: center;\n  gap: var(--space-2);\n  height: var(--touch-min-height);\n}";
const actionsAfter = ".actions {\n  display: flex;\n  align-items: center;\n  gap: var(--space-1);\n  height: var(--touch-min-height);\n}";

if (content.includes(actionsAfter)) {
  console.log("SKIP .actions 이미 적용됨");
} else if (content.includes(actionsBefore)) {
  content = content.replace(actionsBefore, actionsAfter);
  changed = true;
  console.log("OK .actions gap 8px -> 4px 완료");
} else {
  console.log("X .actions 대상 못 찾음");
}

if (changed) fs.writeFileSync(path, content, "utf8");
