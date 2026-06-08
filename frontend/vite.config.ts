import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'favicon.ico', 'robots.txt'],
      manifest: {
        name: '철도차량 BOM 시스템',
        short_name: 'KORAIL BOM',
        description: '철도차량 BOM·명칭도감·자재마스터 통합 관리',
        theme_color: '#1F4E79',
        background_color: '#0a0e1a',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/',
        lang: 'ko',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // 명칭도감 이미지 + ecat 이미지 캐싱 전략
        runtimeCaching: [
          {
            // 명칭도감 정적 이미지: 캐시 우선, 백그라운드 갱신
            urlPattern: /\/diagrams\/.+\.(?:jpg|jpeg|png)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'diagram-images',
              expiration: { maxEntries: 5000, maxAgeSeconds: 60 * 60 * 24 * 90 }, // 90일
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // 명칭도감 페이지 API (백엔드 redirect)
            urlPattern: /\/api\/diagram-pages\/image\/.+/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'diagram-api-images',
              expiration: { maxEntries: 5000, maxAgeSeconds: 60 * 60 * 24 * 90 },
              cacheableResponse: { statuses: [0, 200, 302] },
            },
          },
          {
            // ecat 자재 사진 (백엔드 프록시) — 네트워크 우선, 실패 시 캐시
            urlPattern: /\/api\/ecat\/image\?/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'ecat-images',
              networkTimeoutSeconds: 6,
              expiration: { maxEntries: 10000, maxAgeSeconds: 60 * 60 * 24 * 30 },
              // status 200만 캐시 (실패 응답 캐시 안 함)
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            // ecat 자재 정보 API (메타데이터)
            urlPattern: /\/api\/ecat\/material\/.+/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'ecat-meta',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            // 일반 API: 네트워크 우선, 실패 시 캐시
            urlPattern: /\/api\/.+/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
        // 크기 제한 (명칭도감 이미지 큰 거 캐시 위해)
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // 캐시할 정적 파일들
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
      },
      devOptions: {
        enabled: false,  // dev에서는 비활성 (필요 시 true)
      },
    }),
  ],
  server: {
    host: true,
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
  preview: {
    host: true,
  },
})
