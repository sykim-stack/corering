// patch_seo_sitemap.cjs
const fs = require('fs');
const path = require('path');

// ── Step 1: app/robots.txt 삭제 (sitemap.ts 코드가 잘못 들어간 파일) ──
const robotsTxtPath = 'app/robots.txt';
if (fs.existsSync(robotsTxtPath)) {
  fs.unlinkSync(robotsTxtPath);
  console.log('OK: app/robots.txt 삭제 완료');
} else {
  console.log('SKIP: app/robots.txt 이미 없음');
}

// ── Step 2: app/sitemap.ts 신설 ──
const sitemapPath = 'app/sitemap.ts';

const sitemapContent = `import type { MetadataRoute } from 'next';
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
    url: \`\${BASE_URL}/rooms/\${r.id}\`,
    lastModified: r.created_at ? new Date(r.created_at) : new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.6,
  }));

  return [...staticEntries, ...roomEntries];
}
`;

if (fs.existsSync(sitemapPath)) {
  console.log('SKIP: app/sitemap.ts 이미 존재함 (덮어쓰지 않음)');
} else {
  fs.writeFileSync(sitemapPath, sitemapContent, 'utf8');
  console.log('OK: app/sitemap.ts 신설 완료');
}