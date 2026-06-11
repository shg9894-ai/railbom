import { useState, useEffect } from 'react'
import { Select, Card, Empty, Typography, Image } from 'antd'
import { PictureOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { vehicleApi } from '../api/vehicles'
import { diagramPagesApi } from '../api/diagramPages'
import TrainDiagramSVG from '../components/diagram/TrainDiagramSVG'
import TrainPhotoView from '../components/diagram/TrainPhotoView'
import DrillDownView from '../components/diagram/DrillDownView'

const { Text, Title } = Typography

const VEHICLE_CODE_MAP: Record<number, string> = {
  1: 'emu320',      // KTX-청룡
  2: 'emu260',      // KTX-이음
  3: 'KTX-산천4',   // KTX-원강
  4: 'KTX-산천2',   // KTX-호남
  6: 'KTX-산천1',   // KTX-산천1
}

// 차종 코드별 량수 매핑
const CAR_COUNT: Record<string, number> = {
  'EMU-320':   8,   // KTX-청룡
  'EMU-260':   6,   // KTX-이음
  'KTX-산천4': 10,  // 원강
  'KTX-산천2': 10,  // 호남
  'KTX-산천3': 10,  // SRT
  'KTX-산천1': 10,  // 산천1
  'KTX-1':    20,   // KTX 1세대
}
const CAR_COUNT_LABEL: Record<string, string> = {
  'ITX-마음': '4량/6량',
}

export default function DiagramPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialVehicleId = (() => {
    const raw = searchParams.get('vehicleId')
    const n = raw ? Number(raw) : NaN
    return Number.isFinite(n) ? n : null
  })()
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(initialVehicleId)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [jumpSearch, setJumpSearch] = useState<string | undefined>()

  // URL 쿼리가 늦게 들어오는 경우 대비
  useEffect(() => {
    const raw = searchParams.get('vehicleId')
    if (!raw) return
    const n = Number(raw)
    if (Number.isFinite(n) && n !== selectedVehicleId) {
      setSelectedVehicleId(n)
    }
    // 한 번 적용하면 쿼리 제거 (뒤로가기/공유 시 잔존 방지)
    searchParams.delete('vehicleId')
    setSearchParams(searchParams, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn: vehicleApi.list,
  })

  const selectedVehicle = vehicles.find(v => v.id === selectedVehicleId)
  const carCount = selectedVehicle ? (CAR_COUNT[selectedVehicle.code] ?? 8) : 8
  const vehicleCode = selectedVehicleId ? VEHICLE_CODE_MAP[selectedVehicleId] : null

  const { data: layoutPages = [] } = useQuery({
    queryKey: ['diagram-pages', 'layout', vehicleCode],
    queryFn: () => diagramPagesApi.byPageType(vehicleCode!, 'layout'),
    enabled: !!vehicleCode && !selectedCategory,
    staleTime: 300_000,
  })
  const { data: overviewPages = [] } = useQuery({
    queryKey: ['diagram-pages', 'overview', vehicleCode],
    queryFn: () => diagramPagesApi.byPageType(vehicleCode!, 'overview'),
    enabled: !!vehicleCode && !selectedCategory,
    staleTime: 300_000,
  })

  const handleSelectCategory = (code: string) => {
    setSelectedCategory(code)
    setJumpSearch(undefined)
  }

  const handleChangeCategory = (code: string, searchName?: string) => {
    setSelectedCategory(code)
    setJumpSearch(searchName)
  }

  const handleBackToDiagram = () => {
    setSelectedCategory(null)
    setJumpSearch(undefined)
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 112px)', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* 페이지 헤더 */}
      <div>
        <Title level={4} style={{ marginBottom: 2 }}>
          <PictureOutlined style={{ marginRight: 8, color: '#1677ff' }} />
          부품 탐색
        </Title>
        <Text type="secondary" style={{ fontSize: 12 }}>
          차종별 열차 도면에서 부품을 선택하면 BOM 코드·자재 정보·명칭도감을 확인할 수 있습니다
        </Text>
      </div>
      {/* 차종 선택 바 */}
      <Card size="small" style={{ flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <Text strong style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>차종</Text>
          <Select
            placeholder="차종을 선택하세요"
            style={{ flex: 1, minWidth: 0 }}
            options={vehicles.map(v => ({ value: v.id, label: `${v.name} (${v.code})` }))}
            value={selectedVehicleId}
            onChange={v => {
              setSelectedVehicleId(v)
              setSelectedCategory(null)
            }}
          />
          {selectedVehicle && (
            <Text type="secondary" style={{ fontSize: 11, whiteSpace: 'nowrap', flexShrink: 0 }}>
              {CAR_COUNT_LABEL[selectedVehicle.code] ?? `${carCount}량`}
            </Text>
          )}
        </div>
      </Card>

      {/* 메인 영역 */}
      <div style={{ flex: 1, minHeight: 0, overflowX: 'hidden', overflowY: 'auto' }}>
        {!selectedVehicleId ? (
          <Card style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Empty description="차종을 선택하면 열차 도면이 표시됩니다" />
          </Card>
        ) : selectedCategory ? (
          // 드릴다운 뷰
          <DrillDownView
            vehicleTypeId={selectedVehicleId}
            categoryCode={selectedCategory}
            onBack={handleBackToDiagram}
            onChangeCategory={handleChangeCategory}
            initialSearch={jumpSearch}
          />
        ) : (
          // 열차 도면 뷰
          <Card
            style={{ height: '100%' }}
            styles={{ body: { padding: '24px 16px' } }}
          >
            {selectedVehicle && ['EMU-320', 'EMU-260', 'KTX-산천1', 'KTX-산천2', 'KTX-산천3', 'KTX-산천4', 'ITX-마음', 'KTX-1'].includes(selectedVehicle.code) ? (
              <TrainPhotoView
                onSelectCategory={handleSelectCategory}
                selectedCategory={selectedCategory}
                vehicleCode={selectedVehicle.code}
                imageSrc={
                  selectedVehicle.code === 'EMU-260'   ? '/train_eum_nobg.png'     :
                  selectedVehicle.code === 'KTX-산천3' ? '/train_srt_nobg.png'     :
                  selectedVehicle.code === 'KTX-산천2' ? '/train_srt_nobg.png'     :
                  selectedVehicle.code === 'KTX-산천4' ? '/train_wongang_nobg.png' :
                  selectedVehicle.code === 'KTX-산천1' ? '/train_wongang_nobg.png' :
                  selectedVehicle.code === 'ITX-마음'  ? '/train_maum_nobg.png'    :
                  selectedVehicle.code === 'KTX-1'    ? '/train_ktx1_nobg.png'   :
                  '/train_blue_nobg.png'
                }
                flipImage={selectedVehicle.code === 'EMU-320'}
                editable
              />
            ) : (
              <TrainDiagramSVG
                carCount={carCount}
                onSelectCategory={handleSelectCategory}
                selectedCategory={selectedCategory}
              />
            )}
            <div style={{ marginTop: 12, textAlign: 'center', fontSize: 11 }}>
              {selectedVehicle?.name} ({selectedVehicle?.code}) · {CAR_COUNT_LABEL[selectedVehicle?.code ?? ''] ?? `${carCount}량`} 편성
            </div>

            {/* 차량 일반 (layout + overview 통합) */}
            {(layoutPages.length > 0 || overviewPages.length > 0) && (
              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: '#666' }}>
                  차량 일반 ({layoutPages.length + overviewPages.length})
                </div>
                <Image.PreviewGroup>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {[...layoutPages, ...overviewPages].map(p => (
                      <div key={p.id} style={{ textAlign: 'center' }}>
                        <Image
                          src={diagramPagesApi.imageUrl(p.file_no, vehicleCode ?? undefined)}
                          style={{ height: 180, borderRadius: 6, border: '1px solid #e0e0e0', cursor: 'pointer' }}
                          preview={{ mask: '확대' }}
                        />
                        <div style={{ fontSize: 11, marginTop: 4, maxWidth: 160 }}>
                          {p.assembly}
                        </div>
                      </div>
                    ))}
                  </div>
                </Image.PreviewGroup>
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  )
}
