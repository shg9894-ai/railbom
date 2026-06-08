import { useState, useEffect } from 'react'
import { Card, Input, Table, Tag, Typography, Select, Space, Modal, Descriptions, Statistic, Row, Col, Switch, Button, Spin, Alert, InputNumber, message, Image } from 'antd'
import { DatabaseOutlined, SearchOutlined, LinkOutlined, CloudDownloadOutlined, ExportOutlined, SyncOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useState as useStateLocal } from 'react'
import { materialMasterApi, ecatApi, ecatImageUrl, PRODUCT_GROUP_PREFIX_LABEL, type MaterialMasterItem } from '../api/materialMaster'

const { Title, Text } = Typography

function SyncModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const [start, setStart] = useStateLocal<number>(0)
  const [count, setCount] = useStateLocal<number>(1000)
  const [logs, setLogs] = useStateLocal<string[]>([])

  const { data: status } = useQuery({
    queryKey: ['ecat-sync-status'],
    queryFn: ecatApi.syncStatus,
    enabled: open,
    refetchInterval: open ? 3000 : false,
  })

  const mutation = useMutation({
    mutationFn: () => ecatApi.syncNew({ start: start || 0, count, concurrency: 20 }),
    onSuccess: (r) => {
      setLogs(prev => [...prev, `✅ ${r.scanned_range} 스캔 → ${r.found_count}/${r.scanned_count} 발견`])
      setStart(r.next_start)
      qc.invalidateQueries({ queryKey: ['mm-stats'] })
      qc.invalidateQueries({ queryKey: ['mm-search'] })
    },
    onError: (e: any) => {
      setLogs(prev => [...prev, `❌ 실패: ${e.message}`])
      message.error('동기화 실패')
    },
  })

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={<span><SyncOutlined /> 신규 자재 동기화 (ecat)</span>}
      footer={null}
      width={600}
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="ecat에 등록된 신규 자재를 우리 DB로 가져옵니다"
        description={
          <div style={{ fontSize: 12 }}>
            시작 자재번호와 스캔 개수를 정하면 그 범위 내에서 ecat에 있는 자재를 모두 가져옵니다.
            <br />
            기본값(시작=0)은 우리 DB 최대값 다음부터 시작합니다.
          </div>
        }
      />

      {status && (
        <Card size="small" style={{ marginBottom: 12 }}>
          <Row gutter={16}>
            <Col span={8}>
              <Statistic title="DB 총 자재" value={status.total} suffix="건" />
            </Col>
            <Col span={8}>
              <Statistic title="DB 최대 번호" value={status.max_no || 0} />
            </Col>
            <Col span={8}>
              <Statistic title="최근 7일 갱신" value={status.recent_updated} suffix="건" valueStyle={{ color: '#52c41a' }} />
            </Col>
          </Row>
        </Card>
      )}

      <Space style={{ marginBottom: 12 }}>
        <span>시작 자재번호:</span>
        <InputNumber
          value={start}
          onChange={v => setStart(Number(v) || 0)}
          style={{ width: 140 }}
          placeholder="자동(DB 최대값+1)"
        />
        <span>스캔 개수:</span>
        <Select
          value={count}
          onChange={setCount}
          style={{ width: 120 }}
          options={[
            { value: 100, label: '100개' },
            { value: 500, label: '500개' },
            { value: 1000, label: '1,000개' },
            { value: 5000, label: '5,000개' },
            { value: 10000, label: '10,000개' },
          ]}
        />
        <Button
          type="primary"
          icon={<SyncOutlined />}
          onClick={() => mutation.mutate()}
          loading={mutation.isPending}
        >
          스캔 시작
        </Button>
      </Space>

      {mutation.isPending && (
        <Alert
          type="warning"
          showIcon
          message={`스캔 중... ${start}부터 ${count.toLocaleString()}건 (약 ${Math.ceil(count / 20)}초 소요 예상)`}
        />
      )}

      {logs.length > 0 && (
        <div style={{
          background: 'rgba(128,128,128,0.06)', padding: 10, borderRadius: 4,
          maxHeight: 200, overflow: 'auto', marginTop: 12, fontFamily: 'monospace', fontSize: 12,
        }}>
          {logs.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      )}
    </Modal>
  )
}

// 모바일(아이폰/안드) 감지 — ecat 서버가 모바일 UA 차단해서 외부 링크 막아둠
const isMobileUA = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)

// PWA standalone 모드에서 HTTP 외부 링크 차단 우회
function openEcat(url: string) {
  const w = window.open(url, '_blank', 'noopener,noreferrer')
  if (!w) {
    try { navigator.clipboard?.writeText(url) } catch {}
    message.warning('새 창이 차단되었습니다. URL이 복사되었으니 브라우저 주소창에 붙여넣으세요.')
  }
}

export default function MaterialMasterPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [syncOpen, setSyncOpen] = useState(false)
  const [q, setQ] = useState(searchParams.get('q') ?? '')

  // URL 쿼리 ?q=... 로 진입 시 자동 검색 + URL 정리
  useEffect(() => {
    const urlQ = searchParams.get('q')
    if (urlQ && urlQ !== q) {
      setQ(urlQ)
    }
    if (urlQ) {
      searchParams.delete('q')
      setSearchParams(searchParams, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [productGroupPrefix, setProductGroupPrefix] = useState<string | undefined>()
  const [materialType, setMaterialType] = useState<string | undefined>()
  const [showUnused, setShowUnused] = useState(false)   // false = 사용중만, true = 미사용 포함
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(30)
  const [selected, setSelected] = useState<string | null>(null)

  const { data: stats } = useQuery({
    queryKey: ['mm-stats'],
    queryFn: materialMasterApi.stats,
    staleTime: 5 * 60_000,
  })

  const { data: groups } = useQuery({
    queryKey: ['mm-groups'],
    queryFn: materialMasterApi.groups,
    staleTime: 10 * 60_000,
  })

  const { data: search, isLoading } = useQuery({
    queryKey: ['mm-search', q, productGroupPrefix, materialType, showUnused, page],
    queryFn: () => materialMasterApi.search({
      q: q.trim() || undefined,
      product_group_prefix: productGroupPrefix,
      material_type: materialType,
      // showUnused=false → is_unused=false 만 보여줌, true → 둘 다
      is_unused: showUnused ? undefined : false,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    }),
    staleTime: 30_000,
  })

  const { data: detail } = useQuery({
    queryKey: ['mm-detail', selected],
    queryFn: () => materialMasterApi.detail(selected!),
    enabled: !!selected,
  })

  const { data: ecat, isLoading: ecatLoading, error: ecatError } = useQuery({
    queryKey: ['ecat', selected],
    queryFn: () => ecatApi.material(selected!),
    enabled: !!selected,
    retry: 1,
    staleTime: 10 * 60_000,
  })

  const reset = () => {
    setQ(''); setProductGroupPrefix(undefined); setMaterialType(undefined); setShowUnused(false); setPage(1)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <Title level={4} style={{ marginBottom: 4 }}>
            <DatabaseOutlined style={{ marginRight: 8, color: '#1677ff' }} />
            자재 마스터
          </Title>
          <Text type="secondary" style={{ fontSize: 12 }}>
            SAP MM 자재 마스터데이터 + ecat 실시간 연계
          </Text>
        </div>
        {localStorage.getItem('role') === 'admin' && (
          <Button
            icon={<SyncOutlined />}
            onClick={() => setSyncOpen(true)}
          >
            신규 자재 동기화
          </Button>
        )}
      </div>

      {/* 통계 */}
      {stats && (
        <Card size="small" style={{ marginTop: 12 }}>
          <Row gutter={[16, 16]}>
            <Col xs={12} sm={6}>
              <Statistic title="전체 자재" value={stats.total} suffix="건" valueStyle={{ color: '#1677ff', whiteSpace: 'nowrap' }} />
            </Col>
            <Col xs={12} sm={6}>
              <Statistic title="사용중 자재" value={stats.active_count} suffix="건" valueStyle={{ color: '#52c41a', whiteSpace: 'nowrap' }} />
            </Col>
            <Col xs={12} sm={6}>
              <Statistic title="미사용 자재" value={stats.unused_count} suffix="건" valueStyle={{ color: '#999', whiteSpace: 'nowrap' }} />
            </Col>
            <Col xs={12} sm={6}>
              <Statistic title="보수품(ERSA)" value={stats.ersa_count} suffix="건" valueStyle={{ color: '#fa8c16', whiteSpace: 'nowrap' }} />
            </Col>
          </Row>
        </Card>
      )}

      {/* 검색 영역 */}
      <Card size="small" style={{ marginTop: 12 }}>
        <Space wrap size={8}>
          <Input
            prefix={<SearchOutlined />}
            placeholder="자재번호 / 자재내역 / 제조자 PN / 기존자재번호"
            value={q}
            onChange={e => { setQ(e.target.value); setPage(1) }}
            allowClear
            style={{ width: 360 }}
          />
          <Select
            placeholder="용품별그룹 (BB01 등)"
            value={productGroupPrefix}
            onChange={v => { setProductGroupPrefix(v); setPage(1) }}
            allowClear
            showSearch
            optionFilterProp="searchText"
            style={{ width: 280 }}
            options={groups?.product_group_prefixes.map(g => {
              const label = PRODUCT_GROUP_PREFIX_LABEL[g.prefix]
              return {
                value: g.prefix,
                searchText: `${g.prefix} ${label ?? ''}`,
                label: (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{g.prefix}</span>
                    {label && <span>{label}</span>}
                    <Text type="secondary" style={{ fontSize: 10, marginLeft: 'auto' }}>({g.cnt.toLocaleString()})</Text>
                  </span>
                ),
              }
            }) ?? []}
          />
          <Select
            placeholder="자재유형"
            value={materialType}
            onChange={v => { setMaterialType(v); setPage(1) }}
            allowClear
            style={{ width: 180 }}
            options={groups?.material_types.map(g => ({
              value: g.code,
              label: `${g.code} ${g.name} (${g.cnt.toLocaleString()})`,
            })) ?? []}
          />
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Switch
              checked={showUnused}
              onChange={v => { setShowUnused(v); setPage(1) }}
              size="small"
            />
            <Text style={{ fontSize: 12 }}>미사용 포함</Text>
          </span>
          {(q || productGroupPrefix || materialType || showUnused) && (
            <a onClick={reset}>초기화</a>
          )}
        </Space>
      </Card>

      {/* 검색 결과 0건일 때 ecat 직접 조회 안내 */}
      {q.trim() && /^\d{7,}$/.test(q.trim()) && search && search.total === 0 && (
        <Alert
          style={{ marginTop: 12 }}
          type="info"
          showIcon
          message={
            <span>
              내부 DB에 자재번호 <Text code>{q.trim()}</Text>가 없습니다.
              <Button
                size="small"
                type="link"
                icon={<CloudDownloadOutlined />}
                onClick={() => setSelected(q.trim())}
                style={{ marginLeft: 8 }}
              >
                ecat에서 직접 조회
              </Button>
            </span>
          }
        />
      )}

      {/* 결과 표 */}
      <Card size="small" style={{ marginTop: 12 }}>
        <Table<MaterialMasterItem>
          rowKey="material_no"
          size="small"
          loading={isLoading}
          dataSource={search?.items ?? []}
          scroll={{ x: 1500 }}
          pagination={{
            current: page,
            pageSize,
            total: search?.total ?? 0,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '30', '50', '100'],
            onChange: (p, ps) => {
              setPage(p)
              if (ps !== pageSize) setPageSize(ps)
            },
            onShowSizeChange: (_c, ps) => {
              setPageSize(ps)
              setPage(1)
            },
            showTotal: total => `전체 ${total.toLocaleString()}건`,
          }}
          onRow={(r) => ({ onClick: () => setSelected(r.material_no), style: { cursor: 'pointer' } })}
          columns={[
            { title: '자재번호', dataIndex: 'material_no', width: 100,
              render: (v: string) => <Text code style={{ fontSize: 12 }}>{v}</Text> },
            { title: '자재내역', dataIndex: 'material_desc',
              render: (v: string | null, r: MaterialMasterItem) => (
                <span>
                  {r.is_unused && <Tag color="default" style={{ fontSize: 9, marginRight: 4 }}>미사용</Tag>}
                  <Text style={{ fontSize: 12, opacity: r.is_unused ? 0.6 : 1 }}>{v || '-'}</Text>
                </span>
              ) },
            { title: '제조자 PN', dataIndex: 'manufacturer_pn', width: 130,
              render: (v: string | null) => v ? <Text code style={{ fontSize: 11 }}>{v}</Text> : <Text type="secondary">-</Text> },
            { title: '단위', dataIndex: 'unit', width: 50, align: 'center' as const },
            { title: '용품별그룹', dataIndex: 'product_group', width: 180,
              render: (v: string | null, r: MaterialMasterItem) => v ? (
                <span>
                  <Text code style={{ fontSize: 10 }}>{v}</Text>
                  {r.product_group_desc && <Text style={{ fontSize: 10, marginLeft: 4, color: '#888' }}>{r.product_group_desc}</Text>}
                </span>
              ) : null },
            { title: '조달구분', dataIndex: 'procurement_desc', width: 110,
              render: (v: string | null, r: MaterialMasterItem) => v ? (
                <Tag style={{ fontSize: 10 }}>{v}</Tag>
              ) : null },
            { title: '중요도', dataIndex: 'importance_desc', width: 80,
              render: (v: string | null) => v ? <Text style={{ fontSize: 11 }}>{v}</Text> : null },
            { title: 'BOM 연결', dataIndex: 'bom_links', width: 200,
              render: (links: any[] | undefined) => {
                if (!links || links.length === 0) return <Text type="secondary" style={{ fontSize: 10 }}>-</Text>
                return (
                  <Space size={2} wrap>
                    {links.slice(0, 3).map((l, i) => (
                      <Tag key={i} color="blue" style={{ fontSize: 9, padding: '0 4px' }}>
                        {l.vehicle_code} {l.bom_code}
                      </Tag>
                    ))}
                    {links.length > 3 && <Text type="secondary" style={{ fontSize: 10 }}>+{links.length - 3}</Text>}
                  </Space>
                )
              } },
            // 모바일에선 ecat 서버가 차단하므로 컬럼 자체를 숨김
            ...(isMobileUA ? [] : [{ title: 'ecat', key: 'ecat', width: 70, align: 'center' as const, fixed: 'right' as const,
              render: (_: any, r: MaterialMasterItem) => (
                <Button
                  size="small"
                  type="link"
                  icon={<ExportOutlined />}
                  onClick={e => {
                    e.stopPropagation()
                    openEcat(`http://ecat.korail.com/nsl/nomalSearchMatnrView.do?matnr=${r.material_no}`)
                  }}
                  style={{ fontSize: 11, padding: 0 }}
                >이동</Button>
              ) }]),
            { title: '생성일', dataIndex: 'created_date', width: 100,
              render: (v: string | null) => v ? <Text style={{ fontSize: 11 }}>{v}</Text> : <Text type="secondary">-</Text> },
            { title: '기존자재번호', dataIndex: 'legacy_material_no', width: 120,
              render: (v: string | null) => v ? <Text code style={{ fontSize: 10 }}>{v}</Text> : null },
          ]}
        />
      </Card>

      {/* 상세 모달 */}
      <Modal
        open={!!selected}
        onCancel={() => setSelected(null)}
        title={
          <span>
            자재 상세 — {selected}
            {ecat?.is_unused && <Tag color="default" style={{ marginLeft: 8 }}>미사용</Tag>}
            {ecat && !isMobileUA && (
              <Button
                size="small"
                type="link"
                icon={<ExportOutlined />}
                onClick={() => openEcat(ecat.source_url)}
                style={{ marginLeft: 8 }}
              >
                ecat에서 보기
              </Button>
            )}
          </span>
        }
        footer={null}
        width={1000}
      >
        {/* ecat 데이터를 메인으로 표시 */}
        {ecatLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><Spin tip="ecat에서 조회 중..." /></div>
        ) : ecatError ? (
          <Alert
            type="warning"
            showIcon
            message="ecat에서 정보를 가져오지 못했습니다"
            description={
              detail ? (
                <span>내부 DB의 기존 정보로 표시: <Text strong>{detail.material_desc}</Text></span>
              ) : (
                <span>잠시 후 다시 시도해주세요</span>
              )
            }
          />
        ) : ecat ? (
          <>
            {/* 이미지 갤러리 */}
            {ecat.images && ecat.images.length > 0 && (
              <div style={{ marginBottom: 16, padding: 12, background: 'rgba(128,128,128,0.06)', borderRadius: 6 }}>
                <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 8 }}>
                  📷 ecat 자재 사진 ({ecat.images.length}장)
                </Text>
                <Image.PreviewGroup>
                  <Space wrap size={8}>
                    {ecat.images.map((img, i) => (
                      <Image
                        key={i}
                        src={ecatImageUrl(img.url)}
                        alt={img.filename}
                        width={140}
                        height={100}
                        style={{ objectFit: 'cover', borderRadius: 4, border: '1px solid #d9d9d9' }}
                        preview={{ src: ecatImageUrl(img.url), mask: '확대' }}
                      />
                    ))}
                  </Space>
                </Image.PreviewGroup>
              </div>
            )}

            <Descriptions size="small" bordered column={2}>
              <Descriptions.Item label="자재번호">{ecat.material_no}</Descriptions.Item>
              <Descriptions.Item label="단위">{ecat.unit}</Descriptions.Item>
              <Descriptions.Item label="자재내역" span={2}>{ecat.material_desc_full}</Descriptions.Item>
              <Descriptions.Item label="자재그룹 분류번호">{ecat.group_classification_no}</Descriptions.Item>
              <Descriptions.Item label="자재그룹 분류명">{ecat.group_classification_name}</Descriptions.Item>
              <Descriptions.Item label="자재그룹 영문" span={2}>{ecat.group_classification_en || '-'}</Descriptions.Item>
              {ecat.group_classification_desc && (
                <Descriptions.Item label="품명 설명" span={2}>
                  <Text style={{ fontSize: 12 }}>{ecat.group_classification_desc}</Text>
                </Descriptions.Item>
              )}
              <Descriptions.Item label="용품별그룹">{ecat.product_group} {ecat.product_group_desc && `(${ecat.product_group_desc})`}</Descriptions.Item>
              <Descriptions.Item label="대분류">{ecat.category_2 || '-'}</Descriptions.Item>
              <Descriptions.Item label="제조자 PN">{ecat.manufacturer_pn || '-'}</Descriptions.Item>
              <Descriptions.Item label="생성일">{ecat.created_date}</Descriptions.Item>
              <Descriptions.Item label="조달구분">{ecat.procurement_name}</Descriptions.Item>
              <Descriptions.Item label="안전구분">{ecat.safety_code} / {ecat.safety_type}</Descriptions.Item>
              <Descriptions.Item label="구매그룹">{ecat.purchase_group} {ecat.purchase_group_name && `(${ecat.purchase_group_name})`}</Descriptions.Item>
              <Descriptions.Item label="미사용 여부">{ecat.is_unused ? <Tag color="default">미사용</Tag> : <Tag color="green">사용중</Tag>}</Descriptions.Item>
              <Descriptions.Item label="현재고">{ecat.stock_count} {ecat.unit}</Descriptions.Item>
              <Descriptions.Item label="적정재고">{ecat.optimal_stock} {ecat.unit}</Descriptions.Item>
              <Descriptions.Item label="조달리드타임">{ecat.lead_time}일</Descriptions.Item>
              <Descriptions.Item label="연간계획액">{ecat.yearly_plan_amount}</Descriptions.Item>
              <Descriptions.Item label="등록업체수">{ecat.registered_company_count}곳</Descriptions.Item>
              <Descriptions.Item label="계약 진행중">{ecat.contract_in_progress}건</Descriptions.Item>
              <Descriptions.Item label="계약 완료">{ecat.contract_completed}건</Descriptions.Item>
              <Descriptions.Item label="ecat 최종갱신">
                {ecat.last_update_date ? `${ecat.last_update_date.slice(0,4)}.${ecat.last_update_date.slice(4,6)}.${ecat.last_update_date.slice(6,8)}` : '-'}
              </Descriptions.Item>
            </Descriptions>

            {ecat.attributes && ecat.attributes.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <Title level={5} style={{ marginBottom: 8 }}>속성 ({ecat.attributes.length}건)</Title>
                <Table
                  size="small"
                  pagination={false}
                  dataSource={ecat.attributes.map((a, i) => ({ ...a, key: i }))}
                  columns={[
                    { title: '속성명', dataIndex: 'name', width: 180 },
                    { title: '속성값', dataIndex: 'value' },
                    { title: '단위', dataIndex: 'unit', width: 80,
                      render: (v: string) => v ? <Text>{v}</Text> : <Text type="secondary">-</Text> },
                  ]}
                />
              </div>
            )}

            {/* BOM 연결 (우리 시스템 고유 데이터) */}
            {detail?.bom_links && detail.bom_links.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <Title level={5} style={{ marginBottom: 8 }}>
                  <LinkOutlined style={{ marginRight: 6 }} />
                  연결된 BOM 노드 ({detail.bom_links.length}건)
                </Title>
                <Table
                  size="small"
                  pagination={false}
                  dataSource={detail.bom_links.map((l, i) => ({ ...l, key: i }))}
                  columns={[
                    { title: '차종', dataIndex: 'vehicle_name', width: 140 },
                    { title: 'BOM 코드', dataIndex: 'bom_code', width: 160,
                      render: (v: string | null) => v ? <Text code>{v}</Text> : '-' },
                    { title: '부품명', dataIndex: 'name' },
                    { title: '', width: 60,
                      render: (_: any, r: any) => (
                        <a onClick={() => {
                          setSelected(null)
                          navigate(`/bom?node=${r.id}`)
                        }}>이동</a>
                      ) },
                  ]}
                />
              </div>
            )}
          </>
        ) : null}
      </Modal>

      <SyncModal open={syncOpen} onClose={() => setSyncOpen(false)} />
    </div>
  )
}
