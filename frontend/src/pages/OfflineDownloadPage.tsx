import { useState, useEffect, useRef } from 'react'
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

// localStorage에 다운로드 기록을 저장. 서비스워커 캐시 검사와 별개로 100% 신뢰.
// 다운로드 행위 자체를 기록하므로 페이지 떠났다 와도, 앱 껐다 켜도 유지됨.
// 단점: 사용자가 브라우저 데이터 지우면 함께 사라짐(그땐 실제 캐시도 사라지므로 동기화됨).
const DL_KEY = 'bom_offline_downloads_v1'

interface DownloadRecord {
  totalPages: number
  downloaded: number
  downloadedAt: string  // ISO timestamp
}

function loadRecords(): Record<number, DownloadRecord> {
  try {
    const raw = localStorage.getItem(DL_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveRecord(vehicleId: number, rec: DownloadRecord) {
  const all = loadRecords()
  all[vehicleId] = rec
  localStorage.setItem(DL_KEY, JSON.stringify(all))
}

function clearAllRecords() {
  localStorage.removeItem(DL_KEY)
}

export default function OfflineDownloadPage() {
  const [installEvent, setInstallEvent] = useState<any>(null)
  const [statuses, setStatuses] = useState<Record<number, VehicleDownloadStatus>>({})
  const [records, setRecords] = useState<Record<number, DownloadRecord>>(() => loadRecords())
  // 현재 다운로드 진행 중인 차종 ID — useState는 비동기 갱신이라 즉시 검사가 필요한
  // 동시 호출 차단엔 부적합. useRef로 즉시 동기 검사.
  const inFlightRef = useRef<Set<number>>(new Set())

  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn: vehicleApi.list,
  })

  // 페이지 마운트 시 localStorage에서 다운로드 기록을 읽어 상태 복원
  useEffect(() => {
    if (vehicles.length === 0) return
    const records = loadRecords()
    setStatuses(prev => {
      const next = { ...prev }
      for (const v of vehicles) {
        const code = VEHICLE_DB_CODE[v.id]
        if (!code) continue
        if (prev[v.id]?.inProgress) continue  // 다운로드 중이면 건드리지 않음
        const rec = records[v.id]
        if (rec) {
          next[v.id] = {
            vehicleId: v.id, vehicleName: v.name, vehicleCode: code,
            totalPages: rec.totalPages, downloaded: rec.downloaded, inProgress: false,
          }
        }
      }
      return next
    })
  }, [vehicles])

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
    // 같은 차종이 이미 다운로드 중이면 두 번째 호출 무시 (진행률 왔다갔다 방지)
    if (inFlightRef.current.has(vehicleId)) {
      message.info(`${vehicleName}은(는) 이미 다운로드 중입니다.`)
      return 0
    }
    inFlightRef.current.add(vehicleId)
    try {
      const pages = await diagramPagesApi.allPages(vehicleCode)
      // 페이지 목록 받은 직후 loading 메시지 닫기 (진행률 바로 전환)
      message.destroy(`dl-${vehicleId}`)
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
      // localStorage에 영구 기록 (페이지 떠나도 / 앱 껐다 켜도 유지)
      const rec: DownloadRecord = {
        totalPages: pages.length,
        downloaded,
        downloadedAt: new Date().toISOString(),
      }
      saveRecord(vehicleId, rec)
      setRecords(prev => ({ ...prev, [vehicleId]: rec }))
      return downloaded
    } catch (e: any) {
      setStatuses(prev => ({
        ...prev,
        [vehicleId]: { ...prev[vehicleId], inProgress: false },
      }))
      throw e
    } finally {
      inFlightRef.current.delete(vehicleId)
    }
  }

  const downloadAll = async () => {
    setAllDownloading(true)
    let totalDownloaded = 0
    let totalFailed = 0
    let totalSkipped = 0
    // localStorage 기록 다시 읽어 최신 상태로 (state가 stale일 수 있음)
    const currentRecords = loadRecords()
    for (const v of supportedVehicles) {
      const code = VEHICLE_DB_CODE[v.id]
      // 이미 95% 이상 다운로드된 차종은 건너뜀
      const rec = currentRecords[v.id]
      if (rec && rec.totalPages > 0 && rec.downloaded / rec.totalPages >= 0.95) {
        totalSkipped++
        continue
      }
      try {
        const n = await downloadVehicle(v.id, v.name, code)
        totalDownloaded += n
      } catch {
        totalFailed += 1
      }
    }
    setAllDownloading(false)
    const parts: string[] = []
    if (totalDownloaded > 0) parts.push(`${totalDownloaded}장 다운로드`)
    if (totalSkipped > 0) parts.push(`${totalSkipped}개 차종은 이미 받음(건너뜀)`)
    if (totalFailed > 0) parts.push(`${totalFailed}개 차종 실패`)
    const msg = parts.join(' / ') || '대상 없음'
    if (totalFailed === 0) message.success(msg)
    else message.warning(msg)
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
    clearAllRecords()  // localStorage 기록도 함께 제거
    setRecords({})
    setStatuses({})
    message.success('오프라인 캐시 삭제 완료. 다운로드 상태가 초기화됩니다.')
  }

  return (
    <div>
      <Title level={4} style={{ marginBottom: 4 }}>
        <CloudDownloadOutlined style={{ marginRight: 8, color: '#1677ff' }} />
        앱 설치 / 명칭도감 미리받기
      </Title>
      <Text type="secondary" style={{ fontSize: 12 }}>
        명칭도감 사진을 Wi-Fi에서 미리 받아두면, 현장에서 사진 로딩 대기 없이 즉시 열람할 수 있습니다.
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

      {/* 2. 명칭도감 미리받기 */}
      <Card size="small" style={{ marginTop: 12 }}
        title={<span><CloudDownloadOutlined /> 2. 명칭도감 미리받기</span>}
        extra={
          <Button size="small" danger icon={<DeleteOutlined />} onClick={clearCache}>
            캐시 삭제
          </Button>
        }>
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message="이 기능은 명칭도감 사진을 기기에 미리 캐싱해 두는 기능입니다."
          description={
            <span>
              <b>현장에서 사진 로딩 시간을 단축</b>하기 위한 용도예요. 한 번 받아두면 다음 조회 때 서버를 거치지 않고 즉시 표시됩니다.<br />
              Wi-Fi 환경에서 다운로드 권장 — 전체 차종 약 1GB, 한 차종은 50~150MB.<br />
              <Text type="warning" style={{ fontSize: 12 }}>
                ⚠️ 자재마스터 검색·ecat 자재 상세는 인터넷이 필요합니다(완전한 오프라인 모드 아님).
              </Text>
            </span>
          }
        />

        {/* 전체 다운로드 */}
        <Card size="small" style={{ marginBottom: 12, background: 'rgba(22,119,255,0.06)', borderColor: '#91caff' }}
          styles={{ body: { padding: '12px 16px' } }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>📦 전체 차종 한번에 다운로드</div>
              <Text type="secondary" style={{ fontSize: 11 }}>
                {supportedVehicles.length}개 차종 순차 다운로드 (이미 받은 차종은 자동 건너뜀)
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

                {/* 다운로드 시각 표시 */}
                {records[v.id]?.downloadedAt && !isDownloading && (
                  <Text type="secondary" style={{ fontSize: 10, display: 'block', marginBottom: 4 }}>
                    📅 {new Date(records[v.id].downloadedAt).toLocaleString('ko-KR', {
                      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
                    })} 받음
                  </Text>
                )}

                <Button
                  size="small"
                  type={isDone ? 'default' : 'primary'}
                  block
                  icon={<CloudDownloadOutlined />}
                  loading={isDownloading}
                  disabled={allDownloading || isDownloading}
                  onClick={async () => {
                    message.loading({ content: `${v.name} 페이지 목록 조회 중...`, key: `dl-${v.id}`, duration: 0 })
                    try {
                      const n = await downloadVehicle(v.id, v.name, code)
                      message.success({ content: `${v.name} ${n}장 다운로드 완료`, key: `dl-${v.id}` })
                    } catch (e: any) {
                      message.error({ content: `다운로드 실패: ${e?.message || e}`, key: `dl-${v.id}` })
                    }
                  }}
                  style={{ marginTop: status ? 0 : 8 }}
                >
                  {isDone ? '재다운로드 (최신 동기화)' : isPartial ? '이어서 다운로드' : '다운로드 시작'}
                </Button>
              </Card>
            )
          })}
        </div>
      </Card>

      <Card size="small" style={{ marginTop: 12 }} title="💡 작동 원리 (간단)">
        <Paragraph style={{ fontSize: 12, marginBottom: 4 }}>
          • 다운로드한 사진은 브라우저 캐시에 저장되어, 다음 조회 때 서버를 거치지 않고 즉시 표시됩니다.
        </Paragraph>
        <Paragraph style={{ fontSize: 12, marginBottom: 4 }}>
          • <b>본래 목적은 속도 향상</b>입니다. 현장에서 사진 한 장당 0.5~2초씩 걸리던 로딩이 사라집니다.
        </Paragraph>
        <Paragraph style={{ fontSize: 12, marginBottom: 4 }}>
          • 인터넷이 약하거나 잠시 끊겨도 받아둔 사진은 캐시에서 표시됩니다.
        </Paragraph>
        <Paragraph style={{ fontSize: 12, marginBottom: 4, color: '#fa8c16' }}>
          • <b>주의:</b> 자재마스터 검색·ecat 자재 상세·BOM 새 경로 등은 항상 서버 통신이 필요합니다. 완전한 오프라인 모드는 아닙니다.
        </Paragraph>
        <Paragraph style={{ fontSize: 12, marginBottom: 0 }}>
          • 다른 사람이 명칭도감 사진을 교체하면 캐시 삭제 후 다시 받아야 최신본을 봅니다.
        </Paragraph>
      </Card>
    </div>
  )
}
