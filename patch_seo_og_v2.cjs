// patch_seo_og_v2.cjs
const fs = require('fs');
const path = 'lib/seo/room.ts';
let content = fs.readFileSync(path, 'utf8');
let changed = false;

// 짧고 유일한 앵커: "type: 'website'," 바로 다음 줄이 "},"인 지점을 찾는다
const before = "        url: canonicalUrl,\n        type: 'website',\n      },";
const after = [
  "        url: canonicalUrl,",
  "        type: 'website',",
  "        images: [",
  "          {",
  "            url: `${BASE_URL}/api/og?title=${encodeURIComponent(room.room_name ?? 'CoreRing')}`,",
  "            width: 1200,",
  "            height: 630,",
  "          },",
  "        ],",
  "      },"
].join("\n");

if (content.includes('/api/og?title=')) {
  console.log('SKIP: 이미 적용됨 (room.ts OG images)');
} else if (content.includes(before)) {
  content = content.replace(before, after);
  changed = true;
  console.log('OK: lib/seo/room.ts에 OG 이미지 연결 완료');
} else {
  console.log('X: 앵커 못 찾음 - 아래 진단 정보 확인');
  // 진단: openGraph 블록 주변 텍스트를 출력해서 실제 공백 구조를 확인
  const idx = content.indexOf("openGraph:");
  if (idx !== -1) {
    console.log('--- openGraph 주변 실제 텍스트 (참고용) ---');
    console.log(JSON.stringify(content.slice(idx, idx + 200)));
  }
  process.exit(1);
}

if (changed) {
  fs.writeFileSync(path, content, 'utf8');
  console.log('=== lib/seo/room.ts 저장 완료 ===');
}