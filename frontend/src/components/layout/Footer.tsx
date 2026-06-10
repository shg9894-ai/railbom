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
  // 한글이 글자 단위로 끊기지 않도록 명시적으로 keep-all + break-word.
  // 더불어 쉼표/문장부호 뒤에서 끊기게 두 문장으로 명시적 분리.
  const textStyle: React.CSSProperties = {
    wordBreak: 'keep-all',
    overflowWrap: 'break-word',
  }
  return (
    <div style={{
      marginTop: compact ? 6 : 10,
      fontSize: compact ? 11 : 12,
      lineHeight: 1.7,
      color: 'inherit',
      maxWidth: 720,
      marginLeft: 'auto',
      marginRight: 'auto',
      ...textStyle,
    }}>
      <div style={{ marginBottom: 6, ...textStyle }}>
        📩 <b>현재 시스템과 유기적으로 결합하여 고도화할 수 있는 관련 자료</b>를 공유해 주신다면,
      </div>
      <div style={{ marginBottom: 8, ...textStyle }}>
        이를 면밀히 검토·반영하여 한층 더 완성도 높은 시스템으로 만들겠습니다.
      </div>
      {/* 메일 두 줄을 inline-grid로 묶어 라벨/주소 컬럼을 정렬 */}
      <div style={{
        display: 'inline-grid', gridTemplateColumns: 'auto auto',
        columnGap: 6, rowGap: 2, textAlign: 'left', ...textStyle,
      }}>
        <span>내부 메일 ·</span>
        <span>
          <a href={`mailto:${INTERNAL_EMAIL}`} style={{ color: '#1677ff', textDecoration: 'none' }}>
            {INTERNAL_EMAIL}
          </a>{' '}
          <span style={{ opacity: 0.65 }}>(육아휴직 중 · 사용 불가)</span>
        </span>
        <span>외부 메일 ·</span>
        <span>
          <a href={`mailto:${EXTERNAL_EMAIL}`} style={{ color: '#1677ff', textDecoration: 'none' }}>
            {EXTERNAL_EMAIL}
          </a>
        </span>
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
