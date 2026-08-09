// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

let supabaseInstance: ReturnType<typeof createClient> | null = null;

export function getSupabase() {
  if (supabaseInstance) {
    return supabaseInstance;
  }

  // Vercel 환경 변수 이름 불일치 문제를 해결하기 위해 두 가지 경우를 모두 확인
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

  if (!url || !key) {
    console.error(
      'Supabase URL 또는 Key가 설정되지 않았습니다. ' +
      'Vercel 환경 변수(NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)를 확인하세요.'
    );
    return null;
  }

  try {
    supabaseInstance = createClient(url, key);
    return supabaseInstance;
  } catch (error) {
    console.error('Supabase 클라이언트 생성 실패:', error);
    return null;
  }
}

// lib/supabase.ts (추가할 코드)

/**
 * Supabase REST API를 직접 호출하는 GET 래퍼 함수
 * @param path - '테이블명?쿼리파라미터' 형식 (예: 'language_knowledge?limit=5&status=eq.verified')
 * @returns 성공 시 JSON 데이터, 실패 시 null 반환 (fail-soft)
 */
export async function supabaseGet<T = any>(path: string): Promise<T | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('[supabaseGet] 환경 변수 누락: SUPABASE_URL 또는 KEY');
    return null;
  }

  // path는 'language_knowledge?order=...' 형태이므로 rest/v1/ 뒤에 바로 붙여줌
  const url = `${supabaseUrl}/rest/v1/${path}`;

  try {
    const response = await fetch(url, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`[supabaseGet] HTTP ${response.status} 오류: ${path}`);
      return null;
    }

    return await response.json();
  } catch (err) {
    console.error('[supabaseGet] 네트워크/파싱 오류:', err);
    return null;
  }
}