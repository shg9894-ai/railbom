import { useState } from 'react'
import { Select, Card, Spin, Empty, Image, theme, Typography } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { vehicleApi } from '../api/vehicles'
import { diagramPagesApi } from '../api/diagramPages'

const { Text } = Typography

const VEHICLE_CODE_MAP: Record<string, string> = {
  'EMU-320':    'emu320',
  'EMU-260':    'emu260',
  'KTX-산천1':  'KTX-산천1',
  'KTX-산천2':  'KTX-산천2',
  'KTX-산천4':  'KTX-산천4',
}

export default function CatalogPage() {
  const { token: tk } = theme.useToken()
  const [vehicleCode, setVehicleCode] = useState<string | null>(null)

  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn: vehicleApi.list,
  })

  const { data: pages = [], isLoading } = useQuery({
    queryKey: ['catalog-pages', vehicleCode],
    queryFn: () => diagramPagesApi.allPages(vehicleCode!),
    enabled: !!vehicleCode,
    staleTime: 300_000,
  })

  // 차종 선택지: diagram_pages에 데이터 있는 차종만
  const vehicleOptions = vehicles
    .filter(v => VEHICLE_CODE_MAP[v.code])
    .map(v => ({ value: VEHICLE_CODE_MAP[v.code], label: `${v.name} (${v.code})` }))

  const selectedVehicle = vehicles.find(v => VEHICLE_CODE_MAP[v.code] === vehicleCode)

  return (
    <div style={{ height: 'calc(100vh - 112px)', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* 툴바 */}
      <Card size="small" style={{ flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>차종별 명칭도감</span>
          <Select
            placeholder="차종 선택"
            style={{ width: 220 }}
            options={vehicleOptions}
            value={vehicleCode}
            onChange={setVehicleCode}
          />
          {pages.length > 0 && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              총 {pages.length}페이지
            </Text>
          )}
        </div>
      </Card>

      {/* 갤러리 */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {!vehicleCode ? (
          <Card style={{ height: '100%' }}>
            <Empty description="차종을 선택하면 명칭도감 전체 페이지가 표시됩니다" style={{ paddingTop: 80 }} />
          </Card>
        ) : isLoading ? (
          <div style={{ textAlign: 'center', paddingTop: 80 }}><Spin size="large" /></div>
        ) : pages.length === 0 ? (
          <Card style={{ height: '100%' }}>
            <Empty description="해당 차종의 명칭도감 데이터가 없습니다" style={{ paddingTop: 80 }} />
          </Card>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: 12,
            padding: 4,
          }}>
            <Image.PreviewGroup>
              {pages.map(p => (
                <div key={p.id} style={{
                  border: `1px solid ${tk.colorBorder}`,
                  borderRadius: 8,
                  overflow: 'hidden',
                  background: tk.colorBgContainer,
                  cursor: 'pointer',
                }}>
                  <Image
                    src={diagramPagesApi.imageUrl(p.file_no, vehicleCode)}
                    alt={`${p.chapter ?? ''} ${p.assembly ?? ''} p.${p.file_no}`}
                    style={{ width: '100%', display: 'block', objectFit: 'cover' }}
                    preview={{ src: diagramPagesApi.imageUrl(p.file_no, vehicleCode) }}
                    placeholder={
                      <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', background: tk.colorFillAlter }}>
                        <Spin size="small" />
                      </div>
                    }
                  />
                  <div style={{ padding: '6px 8px', borderTop: `1px solid ${tk.colorBorderSecondary}` }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: tk.colorText, lineHeight: 1.3 }}>
                      {p.assembly || p.chapter || `페이지 ${p.file_no}`}
                    </div>
                    <div style={{ fontSize: 10, color: tk.colorTextSecondary, marginTop: 2 }}>
                      {p.chapter && p.assembly ? p.chapter : ''} · {p.file_no}p
                    </div>
                  </div>
                </div>
              ))}
            </Image.PreviewGroup>
          </div>
        )}
      </div>
    </div>
  )
}
