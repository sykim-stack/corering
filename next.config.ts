/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['cloudinary', 'brainpool-os'],
  // 환경변수는 Vercel 프로젝트 설정(Environment Variables)에서 관리합니다.
  // NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
  // SUPABASE_SERVICE_ROLE_KEY, DEEPL_API_KEY, GEMINI_API_KEY 모두 Vercel에 등록됨.
  // 여기에 평문으로 다시 적지 않습니다 (git 히스토리 노출 위험).
};

module.exports = nextConfig;
