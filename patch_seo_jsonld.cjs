// patch_seo_jsonld.cjs
const fs = require('fs');
const path = "app/rooms/[roomId]/page.tsx";

const newContent = `import { getRoomMetadata } from '@/lib/seo/room';
import { getSupabase } from '@/lib/supabase';
import { BASE_URL } from '@/lib/seo/shared';
import Home from '@/app/page'; // default export 재사용

export const revalidate = 0;
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  return getRoomMetadata(roomId);
}

async function getRoomJsonLd(roomId: string) {
  try {
    const supabase = getSupabase();
    if (!supabase) return null;

    const { data } = await supabase
      .from('chat_rooms')
      .select('room_name, is_public')
      .eq('id', roomId)
      .single();

    const room = data as { room_name: string | null; is_public: boolean } | null;

    // SEO SOURCE RULE: public이 아니면 JSON-LD도 생성하지 않음
    if (!room || !room.is_public) return null;

    return {
      '@context': 'https://schema.org',
      '@type': 'DiscussionForumPosting',
      headline: room.room_name || 'CoreRing 채팅방',
      url: \`\${BASE_URL}/rooms/\${roomId}\`,
      inLanguage: ['ko', 'vi'],
    };
  } catch {
    return null; // fail-safe
  }
}

export default async function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const jsonLd = await getRoomJsonLd(roomId);

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <Home initialRoomId={roomId} />
    </>
  );
}
`;

if (!fs.existsSync(path)) {
  console.log('X 파일이 존재하지 않음: ' + path);
  process.exit(1);
}

const current = fs.readFileSync(path, 'utf8');

if (current.includes('DiscussionForumPosting')) {
  console.log('SKIP: 이미 JSON-LD가 적용되어 있음');
} else {
  fs.writeFileSync(path, newContent, 'utf8');
  console.log('OK: app/rooms/[roomId]/page.tsx에 JSON-LD 추가 완료');
}