// 공통 푸터 — 제작자/버전/연락처
// 변경 시 한 곳만 수정.

export const APP_VERSION = '0.9 (Closed Beta)'
export const APP_AUTHOR = 'SHG (KORAIL)'
export const APP_YEAR = '2026'
export const INTERNAL_EMAIL = '153149@korail.com'
export const EXTERNAL_EMAIL = 'shg0001@naver.com'

interface Props {
  variant?: 'default' | 'sidebar' | 'login'
}

// 자료/피드백 안내 문구 (default·login에서 공통 사용)
function ContactBlock({ compact = false }: { compact?: boolean }) {
  return (
    <div style={{
      marginTop: compact ? 6 : 10,
      fontSize: compact ? 11 : 12,
      lineHeight: 1.7,
      color: 'inherit',
    }}>
      <div style={{ marginBottom: 4 }}>
        📩 도면·자재 정보·정비 기준 등 <b>양질의 자료를 제공해 주시면</b>
        시스템에 더 많은 개선을 반영할 수 있습니다.
      </div>
      <div>
        내부 메일 ·{' '}
        <a href={`mailto:${INTERNAL_EMAIL}`} style={{ color: '#1677ff', textDecoration: 'none' }}>
          {INTERNAL_EMAIL}
        </a>{' '}
        <span style={{ opacity: 0.65 }}>(육아휴직 중 · 사용 불가)</span>
      </div>
      <div>
        외부 메일 ·{' '}
        <a href={`mailto:${EXTERNAL_EMAIL}`} style={{ color: '#1677ff', textDecoration: 'none' }}>
          {EXTERNAL_EMAIL}
        </a>
      </div>
    </div>
  )
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
        color: 'rgba(128,128,128,0.75)',
        fontSize: 11,
      }}>
        <div>Made by {APP_AUTHOR} · v{APP_VERSION} · © {APP_YEAR}</div>
        <ContactBlock compact />
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
      color: 'rgba(128,128,128,0.75)',
      fontSize: 11,
    }}>
      <div>
        Made by <span style={{ fontWeight: 600 }}>{APP_AUTHOR}</span> · v{APP_VERSION} · © {APP_YEAR}
      </div>
      <ContactBlock />
    </div>
  )
}
