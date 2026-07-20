import type { MetadataRoute } from 'next';
import { getSupabase } from '@/lib/supabase';
import { BASE_URL } from '@/lib/seo/shared';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
  ];

  const supabase = getSupabase();
  if (!supabase) return staticEntries;

  // SEO SOURCE RULE: is_public = true인 방만 sitemap에 포함
  const { data: rooms } = await supabase
    .from('chat_rooms')
    .select('id, created_at')
    .eq('is_public', true);

  const roomEntries: MetadataRoute.Sitemap = (rooms || []).map((r: any) => ({
    url: `${BASE_URL}/rooms/${r.id}`,
    lastModified: r.created_at ? new Date(r.created_at) : new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.6,
  }));

  return [...staticEntries, ...roomEntries];
}
