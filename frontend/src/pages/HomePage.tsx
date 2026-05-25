import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { vehicleApi } from '../api/vehicles'

const QUICK_LINKS = [
  { label: '부품 탐색',    path: '/diagram',       desc: '차종별 부품 드릴다운' },
  { label: 'BOM 원데이터', path: '/bom',           desc: '전체 BOM 트리 조회' },
  { label: '명칭도감',     path: '/catalog',       desc: '차종별 부품 도면집' },
  { label: '호환성 관리',  path: '/compatibility', desc: '차종 간 호환 부품' },
]

const VEHICLES = [
  { id: 1, name: 'KTX-청룡',   code: 'EMU-320'   },
  { id: 2, name: 'KTX-이음',   code: 'EMU-260'   },
  { id: 8, name: 'ITX-마음',   code: 'ITX-마음'  },
  { id: 7, name: 'KTX-SRT',    code: 'KTX-산천3' },
  { id: 6, name: 'KTX-산천1',  code: 'KTX-산천1' },
  { id: 3, name: 'KTX-원강',   code: 'KTX-산천4' },
  { id: 4, name: 'KTX-호남',   code: 'KTX-산천2' },
  { id: 5, name: 'KTX(1세대)', code: 'KTX-1'     },
]

export default function HomePage() {
  const navigate = useNavigate()
  const { data: counts = {} } = useQuery({
    queryKey: ['vehicle-counts'],
    queryFn: vehicleApi.counts,
  })
  const totalNodes = Object.values(counts).reduce((a, b) => a + b, 0)

  return (
    <div style={{ minHeight: '100%', background: 'linear-gradient(135deg, #0a0e1a 0%, #0d1b2e 50%, #0a1628 100%)', padding: 0, margin: -16 }}>
      {/* 히어로 섹션 */}
      <div style={{
        position: 'relative', overflow: 'hidden',
        padding: '60px 40px 40px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'linear-gradient(rgba(22,119,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(22,119,255,0.05) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          pointerEvents: 'none',
        }} />
        <div style={{ position: 'relative', maxWidth: 900, margin: '0 auto' }}>
          <div style={{ fontSize: 11, color: '#1677ff', letterSpacing: 4, marginBottom: 12, fontFamily: 'monospace' }}>
            KORAIL ROLLING STOCK MANAGEMENT SYSTEM
          </div>
          <h1 style={{ color: '#fff', fontSize: 36, fontWeight: 700, margin: '0 0 12px', lineHeight: 1.2 }}>
            철도차량 BOM
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, margin: '0 0 32px' }}>
            한국철도공사 차량 부품 구성 정보 통합 관리 플랫폼
          </p>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {[
              { label: '등록 차종', value: '8종' },
              { label: 'BOM 노드', value: totalNodes.toLocaleString() + '개' },
              { label: '명칭도감', value: '2,000+ 페이지' },
            ].map(s => (
              <div key={s.label} style={{
                background: 'rgba(22,119,255,0.08)', border: '1px solid rgba(22,119,255,0.2)',
                borderRadius: 8, padding: '14px 24px',
              }}>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginBottom: 4 }}>{s.label}</div>
                <div style={{ color: '#fff', fontSize: 22, fontWeight: 700, fontFamily: 'monospace' }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ padding: '32px 40px 0', maxWidth: 940, margin: '0 auto' }}>
        {/* 바로가기 */}
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', letterSpacing: 2, marginBottom: 16 }}>QUICK ACCESS</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 40 }}>
          {QUICK_LINKS.map(q => (
            <div
              key={q.path}
              onClick={() => navigate(q.path)}
              style={{
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8, padding: '12px 20px', cursor: 'pointer',
                transition: 'all 0.15s', minWidth: 140,
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16, paddingBottom: 40 }}>
          {VEHICLES.map(v => {
            const count = counts[v.id] ?? 0
            const pct = Math.round(count / 9000 * 100)
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
                  </div>
                  <div style={{ color: '#1677ff', fontSize: 18, fontWeight: 700, fontFamily: 'monospace' }}>
                    {count.toLocaleString()}
                  </div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 4, height: 4 }}>
                  <div style={{
                    width: `${pct}%`, height: '100%', borderRadius: 4,
                    background: count > 5000 ? '#1677ff' : count > 2000 ? '#52c41a' : 'rgba(255,255,255,0.25)',
                  }} />
                </div>
                <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 10, marginTop: 6, textAlign: 'right' }}>
                  BOM 노드 {count.toLocaleString()}개 등록
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
