import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { vehicleApi } from '../api/vehicles'
import { vehicleUnitsApi } from '../api/vehicleUnits'

const QUICK_LINKS = [
  { label: '부품 탐색',    path: '/diagram',          desc: '차종별 부품 드릴다운' },
  { label: 'BOM 원데이터', path: '/bom',              desc: '전체 BOM 트리 조회' },
  { label: '명칭도감',     path: '/catalog',          desc: '차종별 부품 도면집' },
  { label: '유지보수 기준', path: '/maintenance',     desc: '부품별 정비 주기' },
  { label: '자재 마스터',   path: '/material-master', desc: 'ecat 자재 검색' },
]

const VEHICLES = [
  { id: 1, name: 'KTX-청룡',   code: 'EMU-320',   source: '제작사 BOM' },
  { id: 2, name: 'KTX-이음',   code: 'EMU-260',   source: '제작사 BOM' },
  { id: 8, name: 'ITX-마음',   code: 'ITX-마음',  source: '제작사 BOM' },
  { id: 7, name: 'KTX-SRT',    code: 'KTX-산천3', source: '차량포탈 BOM' },
  { id: 6, name: 'KTX-산천1',  code: 'KTX-산천1', source: '명칭도감' },
  { id: 3, name: 'KTX-원강',   code: 'KTX-산천4', source: '명칭도감' },
  { id: 4, name: 'KTX-호남',   code: 'KTX-산천2', source: '명칭도감' },
  { id: 5, name: 'KTX(1세대)', code: 'KTX-1',     source: '명칭도감' },
]

const SOURCE_COLOR: Record<string, string> = {
  '제작사 BOM':  'rgba(82,196,26,0.15)',
  '차량포탈 BOM': 'rgba(250,173,20,0.15)',
  '명칭도감':    'rgba(22,119,255,0.12)',
}
const SOURCE_TEXT_COLOR: Record<string, string> = {
  '제작사 BOM':  '#52c41a',
  '차량포탈 BOM': '#faad14',
  '명칭도감':    '#1677ff',
}

export default function HomePage() {
  const navigate = useNavigate()
  const { data: counts = {} } = useQuery({
    queryKey: ['vehicle-counts'],
    queryFn: vehicleApi.counts,
  })
  const { data: diagramPageCount = 0 } = useQuery({
    queryKey: ['diagram-page-count'],
    queryFn: vehicleApi.diagramPageCount,
  })
  const { data: unitSummary } = useQuery({
    queryKey: ['vehicle-units-summary'],
    queryFn: vehicleUnitsApi.countsSummary,
  })
  const totalNodes = Object.values(counts).reduce((a, b) => a + b, 0)

  // vehicle_type_id → 활성 량수 매핑
  const unitsByVtId: Record<number, { active: number; total: number }> = {}
  unitSummary?.by_vehicle_type.forEach(v => {
    unitsByVtId[v.vehicle_type_id] = { active: v.active_units, total: v.total_units }
  })

  const [vw, setVw] = useState<number>(() => typeof window !== 'undefined' ? window.innerWidth : 1200)
  useEffect(() => {
    const fn = () => setVw(window.innerWidth)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])
  const isMobile = vw < 768           // 모바일 + 작은 태블릿
  const showSideHelp = vw >= 1024     // 우측 도움말 카드는 충분히 넓을 때만
  const sidePad = isMobile ? 16 : 40
  return (
    <div style={{ minHeight: '100%', background: 'linear-gradient(135deg, #0a0e1a 0%, #0d1b2e 50%, #0a1628 100%)', padding: 0, margin: -16 }}>
      {/* 히어로 섹션 */}
      <div style={{
        position: 'relative', overflow: 'hidden',
        padding: isMobile ? '32px 16px 24px' : '60px 40px 40px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'linear-gradient(rgba(22,119,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(22,119,255,0.05) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'relative', maxWidth: 900, margin: '0 auto',
          display: 'flex', gap: 24, alignItems: 'flex-start',
          flexDirection: isMobile ? 'column' : 'row',
        }}>
          {/* 좌측: 제목 + 통계 */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, color: '#1677ff', letterSpacing: 4, marginBottom: 12, fontFamily: 'monospace' }}>
              KORAIL ROLLING STOCK MANAGEMENT SYSTEM
            </div>
            <h1 style={{ color: '#fff', fontSize: isMobile ? 26 : 36, fontWeight: 700, margin: '0 0 12px', lineHeight: 1.2 }}>
              철도차량 BOM
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: isMobile ? 12 : 14, margin: '0 0 24px' }}>
              한국철도공사 차량 부품 구성 정보 통합 관리 플랫폼
            </p>
            <div style={{ display: 'flex', gap: isMobile ? 8 : 24, flexWrap: 'wrap' }}>
              {[
                { label: '등록 차종', value: '8종' },
                { label: 'BOM 노드', value: totalNodes.toLocaleString() + '개' },
                { label: '명칭도감', value: diagramPageCount ? diagramPageCount.toLocaleString() + ' 페이지' : '...' },
              ].map(s => (
                <div key={s.label} style={{
                  background: 'rgba(22,119,255,0.08)', border: '1px solid rgba(22,119,255,0.2)',
                  borderRadius: 8, padding: isMobile ? '10px 14px' : '14px 24px', flex: isMobile ? '1 1 calc(33% - 8px)' : 'unset', minWidth: 0,
                }}>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, marginBottom: 4 }}>{s.label}</div>
                  <div style={{ color: '#fff', fontSize: isMobile ? 16 : 22, fontWeight: 700, fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 우측: 도움말/매뉴얼 카드 — 빈 공간이 충분할 때만(1024px+) */}
          {showSideHelp && (
            <div
              onClick={() => navigate('/help')}
              style={{
                width: 220, flexShrink: 0,
                background: 'linear-gradient(135deg, rgba(82,196,26,0.15) 0%, rgba(82,196,26,0.05) 100%)',
                border: '1px solid rgba(82,196,26,0.4)',
                borderRadius: 12, padding: '20px 18px', cursor: 'pointer',
                transition: 'all 0.2s', alignSelf: 'stretch',
                display: 'flex', flexDirection: 'column', justifyContent: 'center',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#52c41a'; e.currentTarget.style.transform = 'translateY(-2px)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(82,196,26,0.4)'; e.currentTarget.style.transform = 'translateY(0)' }}
            >
              <div style={{ fontSize: 28, marginBottom: 10 }}>📖</div>
              <div style={{ color: '#73d13d', fontWeight: 700, fontSize: 16, marginBottom: 6 }}>도움말 / 매뉴얼</div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, lineHeight: 1.5 }}>
                BOM 코드 체계, 자재번호, 메뉴별 사용법 등 시스템 안내. 처음 사용한다면 여기부터.
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: `24px ${sidePad}px 0`, maxWidth: 940, margin: '0 auto' }}>
        {/* 바로가기 */}
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', letterSpacing: 2, marginBottom: 16 }}>QUICK ACCESS</div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 40 }}>
          {/* 우측 도움말 카드가 안 보이는 폭에선 QUICK ACCESS 첫 줄에 가로 전체 폭으로 */}
          {!showSideHelp && (
            <div
              onClick={() => navigate('/help')}
              style={{
                background: 'rgba(82,196,26,0.12)', border: '1px solid rgba(82,196,26,0.4)',
                borderRadius: 8, padding: '12px 16px', cursor: 'pointer',
                gridColumn: '1 / -1',
              }}
            >
              <div style={{ color: '#73d13d', fontWeight: 600, fontSize: 13, marginBottom: 3 }}>📖 도움말 / 매뉴얼</div>
              <div style={{ color: 'rgba(115,209,61,0.7)', fontSize: 11 }}>처음 사용한다면 여기부터</div>
            </div>
          )}
          {QUICK_LINKS.map(q => (
            <div
              key={q.path}
              onClick={() => navigate(q.path)}
              style={{
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8, padding: '12px 16px', cursor: 'pointer',
                transition: 'all 0.15s', minWidth: 0,
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#1677ff'; e.currentTarget.style.background = 'rgba(22,119,255,0.1)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
            >
              <div style={{ color: '#fff', fontWeight: 600, fontSize: 13, marginBottom: 3 }}>{q.label}</div>
              <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>{q.desc}</div>
            </div>
          ))}
        </div>

        {/* 차종별 현황 */}
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', letterSpacing: 2, marginBottom: 16 }}>VEHICLE STATUS</div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12, paddingBottom: 32 }}>
          {VEHICLES.map(v => {
            const count = counts[v.id] ?? 0
            const pct = Math.round(count / 9000 * 100)
            const units = unitsByVtId[v.id]
            return (
              <div
                key={v.id}
                onClick={() => navigate(`/diagram?vehicleId=${v.id}`)}
                style={{
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 10, padding: '18px 20px', cursor: 'pointer', transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(22,119,255,0.4)'; e.currentTarget.style.background = 'rgba(22,119,255,0.06)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ color: '#fff', fontWeight: 600, fontSize: 15 }}>{v.name}</div>
                    <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, fontFamily: 'monospace', marginTop: 2 }}>{v.code}</div>
                    <div style={{
                      display: 'inline-block', marginTop: 5,
                      background: SOURCE_COLOR[v.source], color: SOURCE_TEXT_COLOR[v.source],
                      fontSize: 10, padding: '1px 7px', borderRadius: 4, fontWeight: 500,
                    }}>{v.source}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {units && units.active > 0 && (
                      <div style={{ color: '#52c41a', fontSize: 20, fontWeight: 700, fontFamily: 'monospace', lineHeight: 1.1 }}>
                        {units.active.toLocaleString()}<span style={{ fontSize: 11, marginLeft: 2, opacity: 0.7 }}>량</span>
                      </div>
                    )}
                    <div style={{ color: '#1677ff', fontSize: units?.active ? 12 : 18, fontWeight: 700, fontFamily: 'monospace', marginTop: units?.active ? 2 : 0 }}>
                      {count.toLocaleString()}<span style={{ fontSize: 10, marginLeft: 2, opacity: 0.7 }}>노드</span>
                    </div>
                  </div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 4, height: 4 }}>
                  <div style={{
                    width: `${pct}%`, height: '100%', borderRadius: 4,
                    background: count > 5000 ? '#1677ff' : count > 2000 ? '#52c41a' : 'rgba(255,255,255,0.25)',
                  }} />
                </div>
                <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 10, marginTop: 6, textAlign: 'right' }}>
                  {units && units.total > 0
                    ? `활성 ${units.active}/${units.total}량 · BOM ${count.toLocaleString()}개`
                    : `BOM 노드 ${count.toLocaleString()}개 등록`}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
