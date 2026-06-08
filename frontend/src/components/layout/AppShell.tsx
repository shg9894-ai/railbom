import { useState, useEffect } from 'react'
import { Layout, Menu, Button, Space } from 'antd'
import {
  NodeIndexOutlined, OrderedListOutlined, PictureOutlined,
  SearchOutlined, CheckSquareOutlined, LogoutOutlined, HistoryOutlined,
  BulbOutlined, BulbFilled, DatabaseOutlined, MenuFoldOutlined, MenuUnfoldOutlined,
  ToolOutlined, CloudDownloadOutlined,
} from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import { PLANT_NAMES } from '../../types'

const { Content, Header } = Layout

const SIDEBAR_W = 200

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
    { key: '/diagram',     icon: <PictureOutlined />,      label: '부품 탐색' },
    { key: '/bom',         icon: <DatabaseOutlined />,     label: 'BOM 원데이터' },
    { key: '/catalog',     icon: <SearchOutlined />,       label: '차종별 명칭도감' },
    { key: '/maintenance', icon: <ToolOutlined />,         label: '유지보수 기준' },
    { key: '/material-master', icon: <DatabaseOutlined />, label: '자재 마스터' },
    { key: '/offline',     icon: <CloudDownloadOutlined />, label: '앱 설치 / 오프라인' },
    { key: '/vehicles',    icon: <NodeIndexOutlined />,    label: '차종 관리' },
    { key: '/formations',  icon: <OrderedListOutlined />,  label: '편성 관리' },
    ...(role === 'admin' ? [
      { key: '/requests',   icon: <CheckSquareOutlined />, label: '데이터 수정 승인' },
      { key: '/login-logs', icon: <HistoryOutlined />,     label: '로그인 기록' },
    ] : []),
  ]

  const userId = localStorage.getItem('user_id') ?? ''

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key)
    if (isMobile) toggleOpen(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* 헤더 */}
      <Header style={{
        background: darkMode ? '#141414' : '#fff',
        padding: '0 16px',
        borderBottom: `1px solid ${darkMode ? '#303030' : '#f0f0f0'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 100, flexShrink: 0,
        height: 56,
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
        <Space>
          <span style={{ fontSize: 12, color: '#888', whiteSpace: 'nowrap' }}>
            {userId}{role === 'admin' ? ' (관리자)' : PLANT_NAMES[userId] ? ` (${PLANT_NAMES[userId]})` : ''}
          </span>
          <Button
            size="small"
            icon={darkMode ? <BulbFilled style={{ color: '#fadb14' }} /> : <BulbOutlined />}
            onClick={onToggleDark}
            title={darkMode ? '라이트 모드' : '다크 모드'}
          />
          <Button icon={<LogoutOutlined />} size="small" onClick={onLogout}>로그아웃</Button>
        </Space>
      </Header>

      {/* 바디 */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, position: 'relative' }}>
        {/* 사이드바 — 모바일은 overlay, 데스크탑은 inline */}
        <div style={{
          width: open ? SIDEBAR_W : 0,
          flexShrink: 0,
          overflow: 'hidden',
          transition: 'width 0.2s',
          ...(isMobile ? {
            position: 'fixed', top: 56, left: 0, bottom: 0,
            zIndex: 200, width: open ? SIDEBAR_W : 0,
          } : {}),
        }}>
          <div style={{
            width: SIDEBAR_W, height: '100%',
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
              position: 'fixed', inset: 0, top: 56,
              background: 'rgba(0,0,0,0.45)', zIndex: 199,
            }}
          />
        )}

        {/* 콘텐츠 */}
        <div style={{ flex: 1, minWidth: 0, overflowX: 'hidden', overflowY: 'auto', padding: 16, background: darkMode ? '#141414' : '#f5f5f5' }}>
          {children}
        </div>
      </div>
    </div>
  )
}
