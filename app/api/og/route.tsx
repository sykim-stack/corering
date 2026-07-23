import { ImageResponse } from 'next/og';
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
