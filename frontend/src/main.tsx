import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import 'antd/dist/reset.css'
import App from './App.tsx'

// PWA 서비스워커 등록 + 새 번들 감지 시 즉시 reload
// (이게 없으면 새 번들이 배포돼도 모바일 PWA가 옛 캐시를 계속 사용함)
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    // 새 SW가 대기 중이면 skipWaiting + clientsClaim 후 reload
    updateSW(true)
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
