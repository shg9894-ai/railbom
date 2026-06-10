import { useState, useEffect } from 'react'
import { Layout, Menu, Button, Space, Badge } from 'antd'
import {
  NodeIndexOutlined, OrderedListOutlined, PictureOutlined,
  SearchOutlined, CheckSquareOutlined, LogoutOutlined, HistoryOutlined,
  BulbOutlined, BulbFilled, DatabaseOutlined, MenuFoldOutlined, MenuUnfoldOutlined,
  ToolOutlined, CloudDownloadOutlined, QuestionCircleOutlined, HomeOutlined,
  MessageOutlined,
} from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import { PLANT_NAMES } from '../../types'
import InquiryModal, { useUnreadInquiryCount, markInquiriesSeen } from './InquiryModal'
import Footer from './Footer'

const { Content, Header } = Layout

// 사이드바 폭 — 메뉴 라벨('홈화면 추가 / 명칭도감', '매뉴얼 / 자주 묻는 질문' 등)이
// 잘리지 않게 모바일에선 더 넓게.
const SIDEBAR_W_DESKTOP = 220
const SIDEBAR_W_MOBILE = 240

interface Props {
  children: React.ReactNode
  role?: string
  onLogout?: () => void
  darkMode?: boolean
  onToggleDark?: () => void
}

export default function AppShell({ children, role, onLogout, darkMode, onToggleDark }: Props) {
  const navigate = useNavigate()
  const location = useLocation()
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)
  const [inquiryOpen, setInquiryOpen] = useState(false)
  const unreadInquiries = useUnreadInquiryCount()
  const sidebarW = isMobile ? SIDEBAR_W_MOBILE : SIDEBAR_W_DESKTOP

  // 문의/요청 페이지 진입 시 미확인 카운트 리셋
  useEffect(() => {
    if (location.pathname === '/inquiries') markInquiriesSeen()
  }, [location.pathname])
  const [open, setOpen] = useState(() => {
    if (window.innerWidth < 768) return false
    const saved = localStorage.getItem('sidebar_open')
    return saved === null ? true : saved === 'true'
  })

  const toggleOpen = (v: boolean) => {
    setOpen(v)
    if (!isMobile) localStorage.setItem('sidebar_open', String(v))
  }

  useEffect(() => {
    const fn = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
    }
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])

  const menuItems = [
    { key: '/',                icon: <HomeOutlined />,         label: '메인' },
    { key: '/diagram',         icon: <PictureOutlined />,      label: '부품 탐색' },
    { key: '/bom',             icon: <DatabaseOutlined />,     label: 'BOM 원데이터' },
    { key: '/catalog',         icon: <SearchOutlined />,       label: '차종별 명칭도감' },
    { key: '/maintenance',     icon: <ToolOutlined />,         label: '유지보수 기준' },
    { key: '/material-master', icon: <DatabaseOutlined />,     label: '자재 마스터' },
    { key: '/vehicles',        icon: <NodeIndexOutlined />,    label: '차종 관리' },
    { key: '/formations',      icon: <OrderedListOutlined />,  label: '편성 관리' },
    { key: '/offline',         icon: <CloudDownloadOutlined />, label: '홈화면 추가 / 명칭도감' },
    { key: '/help',            icon: <QuestionCircleOutlined />, label: '매뉴얼 / 자주 묻는 질문' },
    { key: '/inquiries',       icon: <MessageOutlined />,        label: '문의 / 요청' },
    ...(role === 'admin' ? [
      { key: '/requests',          icon: <CheckSquareOutlined />, label: '데이터 수정 승인' },
      { key: '/login-logs',        icon: <HistoryOutlined />,     label: '로그인 기록' },
      { key: '/material-activity', icon: <DatabaseOutlined />,    label: '자재마스터 변경 로그' },
    ] : []),
  ]

  const userId = localStorage.getItem('user_id') ?? ''

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key)
    if (isMobile) toggleOpen(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* 헤더 — PWA standalone 모드에서 status bar(notch) 영역 회피 */}
      <Header style={{
        background: darkMode ? '#141414' : '#fff',
        padding: '0 16px',
        // iOS notch / Android status bar 회피
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingLeft: 'max(16px, env(safe-area-inset-left, 0px))',
        paddingRight: 'max(16px, env(safe-area-inset-right, 0px))',
        borderBottom: `1px solid ${darkMode ? '#303030' : '#f0f0f0'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 100, flexShrink: 0,
        // safe-area-inset-top 만큼 추가 높이 확보
        height: 'calc(56px + env(safe-area-inset-top, 0px))',
        boxSizing: 'border-box',
      }}>
        <Space size={8} style={{ flexShrink: 0, minWidth: 0 }}>
          <Button
            type="text"
            icon={open ? <MenuFoldOutlined /> : <MenuUnfoldOutlined />}
            onClick={() => toggleOpen(!open)}
            style={{ fontSize: 16 }}
          />
          <span
            style={{ fontSize: 16, fontWeight: 600, whiteSpace: 'nowrap', color: darkMode ? '#fff' : '#000', cursor: 'pointer' }}
            onClick={() => navigate('/')}
          >철도차량 BOM</span>
        </Space>
        <Space size={6} style={{ minWidth: 0, flexShrink: 1 }}>
          <span style={{
            fontSize: 12, color: '#888', whiteSpace: 'nowrap',
            overflow: 'hidden', textOverflow: 'ellipsis',
            maxWidth: isMobile ? 90 : 200,
          }}>
            {userId}{role === 'admin' ? ' (관리자)' : PLANT_NAMES[userId] ? ` (${PLANT_NAMES[userId]})` : ''}
          </span>
          <Badge count={unreadInquiries} size="small" offset={[-2, 2]}>
            <Button
              size="small"
              icon={<MessageOutlined />}
              onClick={() => setInquiryOpen(true)}
              title="관리자에게 문의/요청"
              style={{ color: '#52c41a', borderColor: 'rgba(82,196,26,0.4)' }}
            >
              {isMobile ? '' : '문의'}
            </Button>
          </Badge>
          <Button
            size="small"
            icon={darkMode ? <BulbFilled style={{ color: '#fadb14' }} /> : <BulbOutlined />}
            onClick={onToggleDark}
            title={darkMode ? '라이트 모드' : '다크 모드'}
          />
          <Button icon={<LogoutOutlined />} size="small" onClick={onLogout} title="로그아웃">
            {isMobile ? '' : '로그아웃'}
          </Button>
        </Space>
      </Header>
      <InquiryModal open={inquiryOpen} onClose={() => setInquiryOpen(false)} />

      {/* 바디 */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, position: 'relative' }}>
        {/* 사이드바 — 모바일은 overlay, 데스크탑은 inline */}
        <div style={{
          width: open ? sidebarW : 0,
          flexShrink: 0,
          overflow: 'hidden',
          transition: 'width 0.2s',
          ...(isMobile ? {
            position: 'fixed',
            top: 'calc(56px + env(safe-area-inset-top, 0px))',
            left: 0, bottom: 0,
            zIndex: 200, width: open ? sidebarW : 0,
          } : {}),
        }}>
          <div style={{
            width: sidebarW, height: '100%',
            background: '#001529', display: 'flex', flexDirection: 'column',
          }}>
            <Menu
              theme="dark"
              mode="inline"
              selectedKeys={[location.pathname]}
              items={menuItems}
              onClick={handleMenuClick}
              style={{ flex: 1, borderRight: 0 }}
            />
          </div>
        </div>

        {/* 모바일 오버레이 배경 */}
        {isMobile && open && (
          <div
            onClick={() => setOpen(false)}
            style={{
              position: 'fixed', inset: 0,
              top: 'calc(56px + env(safe-area-inset-top, 0px))',
              background: 'rgba(0,0,0,0.45)', zIndex: 199,
            }}
          />
        )}

        {/* 콘텐츠 */}
        <div style={{
          flex: 1, minWidth: 0, overflowX: 'hidden', overflowY: 'auto',
          padding: isMobile ? 12 : 16,
          // iOS PWA 하단 home-indicator 회피
          paddingBottom: 'max(12px, env(safe-area-inset-bottom, 0px))',
          background: darkMode ? '#141414' : '#f5f5f5',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ flex: 1 }}>{children}</div>
          <Footer />
        </div>
      </div>
    </div>
  )
}
