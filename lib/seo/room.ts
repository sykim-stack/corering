// lib/seo/room.ts
import type { Metadata } from 'next';
import { getSupabase } from '@/lib/supabase';
import { BASE_URL, noindexMetadata } from './shared';

interface RoomRow {
  room_name: string | null;
  is_public: boolean;
}

export async function getRoomMetadata(roomId: string): Promise<Metadata> {
  try {
    const supabase = getSupabase();
    if (!supabase) return noindexMetadata;

    const { data } = await supabase
      .from('chat_rooms')
      .select('room_name, is_public')
      .eq('id', roomId)
      .single();

    const room = data as RoomRow | null;

    // ★ SEO SOURCE RULE: public이 아니면 즉시 noindex
    if (!room || !room.is_public) return noindexMetadata;

    const title = room.room_name ? `${room.room_name} - CoreRing` : 'CoreRing 채팅방';
    const description = `${room.room_name ?? '채팅방'} — 한국어-베트남어 번역 채팅방`;
    const canonicalUrl = `${BASE_URL}/rooms/${roomId}`;

    return {
      title,
      description,
      alternates: { canonical: canonicalUrl },
      openGraph: {
        title,
        description,
        url: canonicalUrl,
        type: 'website',
      },
    };
  } catch {
    return noindexMetadata; // fail-safe
  }
}

/** DiscussionForumPosting JSON-LD — public 방일 때만 호출할 것 */
export function getRoomJsonLd(roomId: string, roomName: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'DiscussionForumPosting',
    headline: roomName,
    url: `${BASE_URL}/rooms/${roomId}`,
    inLanguage: ['ko', 'vi'],
  };
}