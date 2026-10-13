import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Вимикаємо перевірку типів під час білда

  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    // Обмежуємо використання процесора до 2 ядер, щоб комп'ютер не лагав під час збірки
    cpus: 2,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'credentialless', // or require-corp. credentialless is safer for external images
          },
        ],
      },
    ];
  },
};

export default nextConfig;
