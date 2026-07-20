// patch_seo_homepage_jsonld.cjs
const fs = require('fs');
const path = 'app/layout.tsx';
let content = fs.readFileSync(path, 'utf8');
let changed = false;

// Patch A: import 추가
const importBefore = "import './globals.css';\nimport './core.css';";
const importAfter = "import './globals.css';\nimport './core.css';\nimport { getAppJsonLd } from '@/lib/seo/shared';";

if (content.includes(importAfter)) {
  console.log('SKIP A: 이미 적용됨 (import)');
} else if (content.includes(importBefore)) {
  content = content.replace(importBefore, importAfter);
  changed = true;
  console.log('OK A: getAppJsonLd import 추가');
} else {
  console.log('X A: import 앵커 못 찾음 - 중단');
  process.exit(1);
}

// Patch B: body 안에 JSON-LD script 삽입
const bodyBefore = [
  "      <body>",
  "        <script"
].join("\n");

const bodyAfter = [
  "      <body>",
  "        <script",
  "          type=\"application/ld+json\"",
  "          dangerouslySetInnerHTML={{ __html: JSON.stringify(getAppJsonLd()) }}",
  "        />",
  "        <script"
].join("\n");

if (content.includes('getAppJsonLd()) }}')) {
  console.log('SKIP B: 이미 적용됨 (JSON-LD script)');
} else if (content.includes(bodyBefore)) {
  content = content.replace(bodyBefore, bodyAfter);
  changed = true;
  console.log('OK B: SoftwareApplication JSON-LD script 삽입');
} else {
  console.log('X B: body 앵커 못 찾음 - 중단');
  process.exit(1);
}

if (changed) {
  fs.writeFileSync(path, content, 'utf8');
  console.log('=== layout.tsx 저장 완료 ===');
} else {
  console.log('=== 변경 사항 없음 (모두 이미 적용됨) ===');
}