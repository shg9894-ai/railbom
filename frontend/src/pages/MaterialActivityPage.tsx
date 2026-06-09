import { Card, Table, Typography, Tag, Alert, Spin, Select, Space, Row, Col, Statistic } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { ecatApi } from '../api/materialMaster'

const { Title, Text } = Typography

export default function MaterialActivityPage() {
  const [days, setDays] = useState(7)

  const { data: activity = [], isLoading: actLoading } = useQuery({
    queryKey: ['ecat-activity', days],
    queryFn: () => ecatApi.activity(days),
  })

  const { data: logs = [], isLoading: logsLoading } = useQuery({
    queryKey: ['ecat-sync-logs'],
    queryFn: () => ecatApi.syncLogs(30),
  })

  // 집계
  const totalNew = activity.reduce((s, r) => s + r.new_count, 0)
  const totalUpdated = activity.reduce((s, r) => s + r.updated_count, 0)
  const totalUnused = activity.reduce((s, r) => s + r.unused_updated_count, 0)
  const avgPerDay = activity.length ? Math.round(totalUpdated / activity.length) : 0

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <Title level={3} style={{ marginTop: 0 }}>자재마스터 변경 로그</Title>
      <Text type="secondary">ecat 자동 동기화로 우리 DB에 들어온 신규/갱신 자재 통계입니다. 매일 새벽 03:00 KST 배치 + 실시간 사용자 조회분이 모두 포함됩니다.</Text>

      <Space style={{ marginTop: 16, marginBottom: 12 }}>
        <Text>기간:</Text>
        <Select
          value={days}
          onChange={setDays}
          options={[
            { value: 7, label: '최근 7일' },
            { value: 14, label: '최근 14일' },
            { value: 30, label: '최근 30일' },
            { value: 90, label: '최근 90일' },
          ]}
          style={{ width: 140 }}
        />
      </Space>

      {/* 합계 카드 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]}>
          <Col xs={12} sm={6}>
            <Statistic title={`${days}일간 신규 자재`} value={totalNew} suffix="건" valueStyle={{ color: '#1677ff' }} />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic title={`${days}일간 갱신 자재`} value={totalUpdated} suffix="건" valueStyle={{ color: '#52c41a' }} />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic title={`${days}일간 미사용 갱신`} value={totalUnused} suffix="건" valueStyle={{ color: '#999' }} />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic title="일평균 갱신" value={avgPerDay} suffix="건/일" valueStyle={{ color: '#722ed1' }} />
          </Col>
        </Row>
      </Card>

      {/* 일별 표 */}
      <Card size="small" title="일별 활동" style={{ marginBottom: 16 }}>
        <Spin spinning={actLoading}>
          <Table
            size="small"
            pagination={false}
            rowKey="day"
            scroll={{ x: 480 }}
            dataSource={activity}
            columns={[
              { title: '날짜 (KST)', dataIndex: 'day', width: 120,
                render: (v: string) => <Text style={{ fontFamily: 'monospace' }}>{v}</Text> },
              { title: '신규', dataIndex: 'new_count', width: 110, align: 'right' as const,
                render: (v: number) => v > 0
                  ? <Text strong style={{ color: '#1677ff' }}>{v.toLocaleString()}</Text>
                  : <Text type="secondary">0</Text> },
              { title: '갱신', dataIndex: 'updated_count', width: 110, align: 'right' as const,
                render: (v: number) => v > 0
                  ? <Text strong style={{ color: '#52c41a' }}>{v.toLocaleString()}</Text>
                  : <Text type="secondary">0</Text> },
              { title: '미사용 갱신', dataIndex: 'unused_updated_count', width: 110, align: 'right' as const,
                render: (v: number) => v > 0
                  ? <Text style={{ color: '#999' }}>{v.toLocaleString()}</Text>
                  : <Text type="secondary">0</Text> },
              { title: '비고', key: 'note', render: (_, r) => {
                const note: string[] = []
                if (r.new_count > 50) note.push('신규 다수')
                if (r.updated_count > 50_000) note.push('대량 갱신(전수 배치)')
                else if (r.updated_count > 10_000) note.push('야간 배치')
                return note.length ? <Space>{note.map(n => <Tag key={n}>{n}</Tag>)}</Space> : null
              } },
            ]}
          />
        </Spin>
      </Card>

      {/* 자동 동기화 실행 이력 */}
      <Card size="small" title="자동 동기화 실행 이력">
        {logs.length === 0 ? (
          <Alert
            type="info"
            showIcon
            message="아직 실행 이력이 기록되지 않았습니다"
            description="다음 새벽 03:00 KST 배치부터 이력이 누적됩니다. 그 전까지는 위의 '일별 활동' 표로 변경 추이를 확인하세요."
          />
        ) : (
          <Spin spinning={logsLoading}>
            <Table
              size="small"
              pagination={{ pageSize: 10 }}
              rowKey="id"
              scroll={{ x: 600 }}
              dataSource={logs}
              columns={[
                { title: 'ID', dataIndex: 'id', width: 60 },
                { title: '시작 (KST)', dataIndex: 'started_at', width: 160,
                  render: (v: string) => v ? new Date(v).toLocaleString('ko-KR') : '—' },
                { title: '종료 (KST)', dataIndex: 'finished_at', width: 160,
                  render: (v: string | null) => v ? new Date(v).toLocaleString('ko-KR') : '—' },
                { title: '소요', dataIndex: 'duration_seconds', width: 100,
                  render: (v: number | null) => v != null
                    ? `${Math.floor(v / 60)}분 ${v % 60}초` : '—' },
                { title: '상세', dataIndex: 'detail', render: (v: string | null) => {
                  if (!v) return '—'
                  try {
                    const parsed = JSON.parse(v)
                    if (Array.isArray(parsed)) {
                      return (
                        <Space wrap size={[6, 4]}>
                          {parsed.map((p: any, i: number) => (
                            <Tag key={i} color={p.error ? 'red' : 'blue'} style={{ fontSize: 10 }}>
                              {p.phase === '신규'
                                ? `${p.pattern} ${p.found ?? 0}건`
                                : `전수 ${p.updated ?? 0}/${p.checked ?? 0}건`}
                              {p.error ? ` 실패` : ''}
                            </Tag>
                          ))}
                        </Space>
                      )
                    }
                  } catch {}
                  return <Text style={{ fontSize: 11 }}>{v.slice(0, 80)}</Text>
                } },
              ]}
            />
          </Spin>
        )}
      </Card>
    </div>
  )
}
