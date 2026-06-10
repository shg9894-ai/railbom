import { useState, useEffect } from 'react'
import { Card, Button, Progress, Typography, Space, Tag, Alert, message } from 'antd'
import { CloudDownloadOutlined, CheckCircleOutlined, DeleteOutlined, MobileOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { vehicleApi } from '../api/vehicles'
import { diagramPagesApi } from '../api/diagramPages'
import { VEHICLE_DB_CODE } from '../types'

const { Title, Text, Paragraph } = Typography

// 차종별 명칭도감 페이지 정적 이미지 URL 패턴
function imageUrl(vehicleCode: string, fileNo: number): string {
  return diagramPagesApi.imageUrl(fileNo, vehicleCode)
}

interface VehicleDownloadStatus {
  vehicleId: number
  vehicleName: string
  vehicleCode: string
  totalPages: number
  downloaded: number
  inProgress: boolean
}

// 캐시에 저장된 차종별 이미지 수를 센다. vehicleCode가 URL의 ?vehicle= 파라미터에
// 들어가므로 URL 문자열 매칭으로 차종별로 분리 가능.
async function countCachedImages(vehicleCodes: string[]): Promise<Record<string, number>> {
  const result: Record<string, number> = {}
  vehicleCodes.forEach(c => { result[c] = 0 })
  if (!('caches' in window)) return result
  try {
    const cacheNames = ['diagram-api-images', 'diagram-images']
    for (const name of cacheNames) {
      const cache = await caches.open(name)
      const keys = await cache.keys()
      for (const req of keys) {
        const url = req.url
        for (const code of vehicleCodes) {
          // ?vehicle=KTX-1 같은 패턴 (encoded 형태도 고려)
          if (url.includes(`vehicle=${code}`) || url.includes(`vehicle=${encodeURIComponent(code)}`)) {
            result[code]++
            break
          }
        }
      }
    }
  } catch {
    /* ignore */
  }
  return result
}

export default function OfflineDownloadPage() {
  const [installEvent, setInstallEvent] = useState<any>(null)
  const [statuses, setStatuses] = useState<Record<number, VehicleDownloadStatus>>({})

  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn: vehicleApi.list,
  })

  // 차종별 총 페이지 수를 미리 받아둠 (캐시된 수 / 총 페이지 비교용)
  const { data: pageCounts = {} } = useQuery({
    queryKey: ['vehicle-page-counts', vehicles.map(v => v.id).join(',')],
    queryFn: async () => {
      const out: Record<number, number> = {}
      for (const v of vehicles) {
        const code = VEHICLE_DB_CODE[v.id]
        if (!code) continue
        try {
          const pages = await diagramPagesApi.allPages(code)
          out[v.id] = pages.length
        } catch {
          out[v.id] = 0
        }
      }
      return out
    },
    enabled: vehicles.length > 0,
    staleTime: 5 * 60_000,
  })

  // 페이지 마운트 시 / 차종 목록 로드 후 캐시 검사 → 다운로드 상태 복원
  useEffect(() => {
    if (vehicles.length === 0 || Object.keys(pageCounts).length === 0) return
    const codes = vehicles.map(v => VEHICLE_DB_CODE[v.id]).filter(Boolean)
    countCachedImages(codes).then(counts => {
      setStatuses(prev => {
        const next = { ...prev }
        for (const v of vehicles) {
          const code = VEHICLE_DB_CODE[v.id]
          const cached = counts[code] || 0
          const total = pageCounts[v.id] || 0
          // 이미 다운로드 중이면 건드리지 않음
          if (prev[v.id]?.inProgress) continue
          // 캐시에 무언가 있으면 그 만큼 복원
          if (cached > 0 && total > 0) {
            next[v.id] = {
              vehicleId: v.id, vehicleName: v.name, vehicleCode: code,
              totalPages: total, downloaded: Math.min(cached, total), inProgress: false,
            }
          }
        }
        return next
      })
    })
  }, [vehicles, pageCounts])

  // PWA 설치 이벤트 캐치
  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault()
      setInstallEvent(e)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!installEvent) {
      message.info('이미 설치되었거나, 브라우저 메뉴에서 "홈 화면에 추가"를 선택하세요.')
      return
    }
    installEvent.prompt()
    const choice = await installEvent.userChoice
    if (choice.outcome === 'accepted') {
      message.success('앱이 설치되었습니다!')
      setInstallEvent(null)
    }
  }

  // 차종별 페이지 목록 조회 + 다운로드 진행
  const [allDownloading, setAllDownloading] = useState(false)
  const supportedVehicles = vehicles.filter(v => VEHICLE_DB_CODE[v.id])

  const downloadVehicle = async (vehicleId: number, vehicleName: string, vehicleCode: string) => {
    try {
      const pages = await diagramPagesApi.allPages(vehicleCode)
      setStatuses(prev => ({
        ...prev,
        [vehicleId]: {
          vehicleId, vehicleName, vehicleCode,
          totalPages: pages.length, downloaded: 0, inProgress: true,
        },
      }))

      let downloaded = 0
      const CONCURRENCY = 6
      const queue = [...pages]
      const runOne = async () => {
        while (queue.length) {
          const p = queue.shift()
          if (!p) break
          try {
            const resp = await fetch(imageUrl(vehicleCode, p.file_no), { cache: 'force-cache' })
            if (resp.ok) {
              await resp.blob()
            }
          } catch {
            /* 한 장 실패해도 계속 */
          }
          downloaded++
          setStatuses(prev => ({
            ...prev,
            [vehicleId]: { ...prev[vehicleId], downloaded },
          }))
        }
      }
      await Promise.all(Array.from({ length: CONCURRENCY }, runOne))

      setStatuses(prev => ({
        ...prev,
        [vehicleId]: { ...prev[vehicleId], inProgress: false },
      }))
      return downloaded
    } catch (e: any) {
      setStatuses(prev => ({
        ...prev,
        [vehicleId]: { ...prev[vehicleId], inProgress: false },
      }))
      throw e
    }
  }

  const downloadAll = async () => {
    setAllDownloading(true)
    let totalDownloaded = 0
    let totalFailed = 0
    for (const v of supportedVehicles) {
      const code = VEHICLE_DB_CODE[v.id]
      try {
        const n = await downloadVehicle(v.id, v.name, code)
        totalDownloaded += n
      } catch {
        totalFailed += 1
      }
    }
    setAllDownloading(false)
    if (totalFailed === 0) {
      message.success(`전체 ${totalDownloaded}장 다운로드 완료`)
    } else {
      message.warning(`${totalDownloaded}장 다운로드 / ${totalFailed}개 차종 실패`)
    }
  }

  const clearCache = async () => {
    if (!('caches' in window)) {
      message.warning('이 브라우저는 캐시 API를 지원하지 않습니다')
      return
    }
    const targets = ['diagram-images', 'diagram-api-images', 'ecat-images']
    for (const name of targets) {
      await caches.delete(name)
    }
    setStatuses({})
    message.success('오프라인 캐시 삭제 완료. 다운로드 상태가 초기화됩니다.')
  }

  return (
    <div>
      <Title level={4} style={{ marginBottom: 4 }}>
        <CloudDownloadOutlined style={{ marginRight: 8, color: '#1677ff' }} />
        오프라인 사용 / 앱 설치
      </Title>
      <Text type="secondary" style={{ fontSize: 12 }}>
        명칭도감 사진을 기기에 미리 다운로드하면 인터넷 없이도 빠르게 열람 가능합니다.
      </Text>

      {/* 1. 홈화면 앱 설치 */}
      <Card size="small" style={{ marginTop: 16 }}
        title={<span><MobileOutlined /> 1. 홈 화면에 앱 설치</span>}>
        <Paragraph style={{ marginBottom: 8, fontSize: 13 }}>
          이 시스템을 휴대폰 바탕화면 아이콘으로 추가해 앱처럼 즉시 실행할 수 있습니다.
        </Paragraph>
        <Space direction="vertical" size={6} style={{ fontSize: 12 }}>
          <Text>📱 <b>안드로이드(Chrome/삼성인터넷)</b>: 아래 "앱 설치" 버튼 또는 브라우저 메뉴 → "홈 화면에 추가"</Text>
          <Text>🍎 <b>iOS(Safari)</b>: 공유 버튼 → "홈 화면에 추가"</Text>
        </Space>
        <div style={{ marginTop: 12 }}>
          <Button type="primary" icon={<MobileOutlined />} onClick={handleInstall}>
            앱 설치
          </Button>
        </div>
      </Card>

      {/* 2. 오프라인 다운로드 */}
      <Card size="small" style={{ marginTop: 12 }}
        title={<span><CloudDownloadOutlined /> 2. 명칭도감 오프라인 다운로드</span>}
        extra={
          <Button size="small" danger icon={<DeleteOutlined />} onClick={clearCache}>
            캐시 삭제
          </Button>
        }>
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message="명칭도감 사진을 미리 받아두면 비행기 모드에서도 빠르게 열람할 수 있습니다."
          description="Wi-Fi 환경에서 다운로드 권장. 전체 차종 합치면 약 1GB, 한 차종은 50~150MB 정도입니다."
        />

        {/* 전체 다운로드 */}
        <Card size="small" style={{ marginBottom: 12, background: 'rgba(22,119,255,0.06)', borderColor: '#91caff' }}
          styles={{ body: { padding: '12px 16px' } }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>📦 전체 차종 한번에 다운로드</div>
              <Text type="secondary" style={{ fontSize: 11 }}>
                {supportedVehicles.length}개 차종 모두 순차 다운로드 (약 10~20분 소요)
              </Text>
            </div>
            <Button
              type="primary"
              size="middle"
              icon={<CloudDownloadOutlined />}
              loading={allDownloading}
              onClick={downloadAll}
            >
              {allDownloading ? '다운로드 중...' : '전체 다운로드'}
            </Button>
          </div>
        </Card>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
          {supportedVehicles.map(v => {
            const code = VEHICLE_DB_CODE[v.id]
            const status = statuses[v.id]
            const isDownloading = status?.inProgress
            // 캐시된 비율 95% 이상이면 완료로 본다 (총 페이지 수 모를 땐 다운로드 > 0)
            const ratio = status && status.totalPages > 0
              ? status.downloaded / status.totalPages : 0
            const isDone = !!status && !isDownloading && (
              status.totalPages === 0 ? status.downloaded > 0 : ratio >= 0.95
            )
            const isPartial = !!status && !isDownloading && !isDone && status.downloaded > 0

            return (
              <Card key={v.id} size="small"
                styles={{ body: { padding: '10px 12px' } }}
                style={isDone ? { borderColor: '#52c41a', background: 'rgba(82,196,26,0.04)' } : undefined}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{v.name}</div>
                    <Text type="secondary" style={{ fontSize: 11 }}>{v.code}</Text>
                  </div>
                  {isDone && <Tag color="success" icon={<CheckCircleOutlined />}>다운로드 완료</Tag>}
                  {isPartial && <Tag color="warning">일부 다운로드</Tag>}
                </div>

                {status && (
                  <div style={{ margin: '8px 0' }}>
                    <Progress
                      percent={status.totalPages ? Math.round(status.downloaded / status.totalPages * 100) : 0}
                      size="small"
                      status={isDownloading ? 'active' : 'success'}
                      format={() => `${status.downloaded}/${status.totalPages}`}
                    />
                  </div>
                )}

                <Button
                  size="small"
                  type={isDone ? 'default' : 'primary'}
                  block
                  icon={<CloudDownloadOutlined />}
                  loading={isDownloading}
                  disabled={allDownloading}
                  onClick={async () => {
                    try {
                      const n = await downloadVehicle(v.id, v.name, code)
                      message.success(`${v.name} ${n}장 다운로드 완료`)
                    } catch (e: any) {
                      message.error(`다운로드 실패: ${e.message}`)
                    }
                  }}
                  style={{ marginTop: status ? 0 : 8 }}
                >
                  {isDone ? '다시 다운로드' : '다운로드 시작'}
                </Button>
              </Card>
            )
          })}
        </div>
      </Card>

      <Card size="small" style={{ marginTop: 12 }} title="💡 작동 원리 (간단)">
        <Paragraph style={{ fontSize: 12, marginBottom: 4 }}>
          • 다운로드한 사진은 브라우저의 서비스워커 캐시에 저장됩니다.
        </Paragraph>
        <Paragraph style={{ fontSize: 12, marginBottom: 4 }}>
          • 인터넷이 끊어져도 캐시에서 즉시 표시 (네트워크 요청 안 함 → 빠름).
        </Paragraph>
        <Paragraph style={{ fontSize: 12, marginBottom: 4 }}>
          • BOM 데이터(자재번호, 명칭도감 페이지 정보 등)도 자동으로 캐시됩니다.
        </Paragraph>
        <Paragraph style={{ fontSize: 12, marginBottom: 0 }}>
          • 다른 사람이 데이터 수정해도 다음 온라인 접속 시 자동 동기화됩니다.
        </Paragraph>
      </Card>
    </div>
  )
}
