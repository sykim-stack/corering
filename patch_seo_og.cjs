// patch_seo_og.cjs
const fs = require('fs');

// ── Step 1: app/api/og/route.tsx 신설 ──
const ogPath = 'app/api/og/route.tsx';

const ogContent = `import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get('title') || 'CoreRing';
  const subtitle = searchParams.get('subtitle') || '한국어-베트남어 번역 채팅방';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0A0F1E',
          padding: '80px',
        }}
      >
        <div
          style={{
            fontSize: 28,
            color: '#64748B',
            letterSpacing: 4,
            marginBottom: 24,
            display: 'flex',
          }}
        >
          CORE RING
        </div>
        <div
          style={{
            fontSize: 64,
            fontWeight: 700,
            color: '#F8FAFC',
            textAlign: 'center',
            lineHeight: 1.3,
            display: 'flex',
            maxWidth: 900,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 30,
            color: '#58A6FF',
            marginTop: 32,
            display: 'flex',
          }}
        >
          {subtitle}
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
`;

if (fs.existsSync(ogPath)) {
  console.log('SKIP 1: app/api/og/route.tsx 이미 존재함 (덮어쓰지 않음)');
} else {
  fs.mkdirSync('app/api/og', { recursive: true });
  fs.writeFileSync(ogPath, ogContent, 'utf8');
  console.log('OK 1: app/api/og/route.tsx 신설 완료');
}

// ── Step 2: lib/seo/room.ts에 OG 이미지 URL 연결 ──
const roomPath = 'lib/seo/room.ts';
let content = fs.readFileSync(roomPath, 'utf8');
let changed = false;

const ogBlockBefore = [
  "      openGraph: {",
  "        title,",
  "        description,",
  "        url: canonicalUrl,",
  "        type: 'website',",
  "      },"
].join("\n");

const ogBlockAfter = [
  "      openGraph: {",
  "        title,",
  "        description,",
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
  console.log('SKIP 2: 이미 적용됨 (room.ts OG images)');
} else if (content.includes(ogBlockBefore)) {
  content = content.replace(ogBlockBefore, ogBlockAfter);
  changed = true;
  console.log('OK 2: lib/seo/room.ts에 OG 이미지 연결');
} else {
  console.log('X 2: openGraph 블록 앵커 못 찾음 - 중단');
  process.exit(1);
}

if (changed) {
  fs.writeFileSync(roomPath, content, 'utf8');
  console.log('=== lib/seo/room.ts 저장 완료 ===');
}