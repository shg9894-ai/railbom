// 공통 푸터 — 제작자/버전 표기
// 변경 시 한 곳만 수정.

export const APP_VERSION = '0.9 (Closed Beta)'
export const APP_AUTHOR = 'SHG (KORAIL)'
export const APP_YEAR = '2026'

interface Props {
  variant?: 'default' | 'sidebar' | 'login'
}

export default function Footer({ variant = 'default' }: Props) {
  if (variant === 'sidebar') {
    return (
      <div style={{
        padding: '10px 14px',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        color: 'rgba(255,255,255,0.35)',
        fontSize: 10,
        lineHeight: 1.5,
      }}>
        <div>Made by <span style={{ color: 'rgba(255,255,255,0.55)' }}>{APP_AUTHOR}</span></div>
        <div>v{APP_VERSION} · © {APP_YEAR}</div>
      </div>
    )
  }
  if (variant === 'login') {
    return (
      <div style={{
        textAlign: 'center',
        marginTop: 16,
        color: 'rgba(128,128,128,0.7)',
        fontSize: 11,
      }}>
        Made by {APP_AUTHOR} · v{APP_VERSION} · © {APP_YEAR}
      </div>
    )
  }
  // default — 페이지 콘텐츠 하단
  return (
    <div style={{
      marginTop: 32,
      padding: '14px 16px',
      borderTop: '1px solid rgba(128,128,128,0.15)',
      textAlign: 'center',
      color: 'rgba(128,128,128,0.7)',
      fontSize: 11,
    }}>
      Made by <span style={{ fontWeight: 600 }}>{APP_AUTHOR}</span> · v{APP_VERSION} · © {APP_YEAR}
    </div>
  )
}
