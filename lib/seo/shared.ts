// lib/seo/shared.ts
import type { Metadata } from 'next';

export const BASE_URL = 'https://corering.vercel.app';

export const noindexMetadata: Metadata = {
  robots: { index: false, follow: false },
};

/** SoftwareApplication JSON-LD — 홈페이지용 */
export function getAppJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'CoreRing',
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: 'Any',
    description: '한국어-베트남어 번역 및 방언 학습 서비스',
    url: BASE_URL,
  };
}