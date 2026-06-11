import { useState, useEffect } from 'react'
import { Select, Card, Spin, Empty, Image, theme, Typography, Button, Modal, Form, Input, Select as AntSelect, message, Tooltip, Tag, List } from 'antd'
import { EditOutlined, LinkOutlined, DisconnectOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { vehicleApi } from '../api/vehicles'
import { diagramPagesApi } from '../api/diagramPages'
import { diagramPageRequestsApi } from '../api/diagramPageRequests'
import { bomApi } from '../api/bom'
import { changeRequestsApi } from '../api/changeRequests'
import type { DiagramPage } from '../api/diagramPages'
import { CATEGORIES, CATEGORY_COLORS } from '../types'
import type { BomNode } from '../types'

const { Text, Title } = Typography
const { TextArea } = Input
const userId = localStorage.getItem('user_id') ?? ''

const VEHICLE_CODE_MAP: Record<string, string> = {
  'EMU-320':    'emu320',
  'EMU-260':    'emu260',
  'KTX-산천1':  'KTX-산천1',
  'KTX-산천2':  'KTX-산천2',
  'KTX-산천4':  'KTX-산천4',
  'ITX-마음':   'ITX-마음',
  'KTX-1':      'KTX-1',
}

const REQUEST_TYPE_LABELS = [
  { value: 'assembly_edit', label: '데이터 수정' },
  { value: 'page_delete',   label: '페이지 삭제 요청' },
  { value: 'other',         label: '기타' },
]

function RequestModal({
  page,
  vehicle,
  open,
  onClose,
}: {
  page: DiagramPage | null
  vehicle: string
  open: boolean
  onClose: () => void
}) {
  const [form] = Form.useForm()

  useEffect(() => {
    if (page) {
      form.setFieldsValue({
        requested_value: page.assembly ?? '',
        requested_drawing_no: page.drawing_no ?? '',
      })
    }
  }, [page, form])

  const mutation = useMutation({
    mutationFn: (values: {
      request_type: string
      requested_value?: string
      requested_drawing_no?: string
      requester_note?: string
    }) =>
      diagramPageRequestsApi.create({
        page_id: page!.id,
        vehicle,
        file_no: page!.file_no,
        assembly: page!.assembly ?? null,
        request_type: values.request_type,
        current_value: page!.assembly ?? null,
        requested_value: values.requested_value ?? null,
        requested_drawing_no: values.requested_drawing_no ?? null,
        requester_name: userId || null,
        requester_note: values.requester_note ?? null,
      }),
    onSuccess: () => {
      message.success('수정 요청이 제출되었습니다')
      form.resetFields()
      onClose()
    },
    onError: () => message.error('요청 제출 중 오류가 발생했습니다'),
  })

  const handleOk = () => {
    form.validateFields().then((values) => mutation.mutate(values))
  }

  return (
    <Modal
      open={open}
      title={`명칭도감 수정 요청 — ${page?.file_no}p`}
      okText="요청 제출"
      cancelText="취소"
      onCancel={() => { form.resetFields(); onClose() }}
      onOk={handleOk}
      confirmLoading={mutation.isPending}
      width={480}
      style={{ maxWidth: 'calc(100vw - 32px)' }}
    >
      {page && (
        <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 6, border: '1px solid rgba(128,128,128,0.2)', background: 'rgba(128,128,128,0.08)', fontSize: 12, lineHeight: 1.8 }}>
          <div><Text type="secondary">현재 부품명: </Text><Text strong>{page.assembly || '(없음)'}</Text></div>
          <div><Text type="secondary">현재 도면번호: </Text><Text strong>{page.drawing_no || '(없음)'}</Text></div>
          <div><Text type="secondary">페이지: </Text><Text>{page.file_no}p</Text></div>
        </div>
      )}
      <Form form={form} layout="vertical" initialValues={{
        requested_value: page?.assembly ?? '',
        requested_drawing_no: page?.drawing_no ?? '',
      }}>
        <Form.Item name="request_type" label="요청 유형" rules={[{ required: true, message: '요청 유형을 선택해주세요' }]}>
          <AntSelect options={REQUEST_TYPE_LABELS} placeholder="유형 선택" />
        </Form.Item>
        <Form.Item name="requested_value" label="부품명 (2개일 경우: 하부 암 조립체 / 상부 암 조립체)">
          <Input />
        </Form.Item>
        <Form.Item name="requested_drawing_no" label="도면번호">
          <Input />
        </Form.Item>
        <Form.Item name="requester_note" label="요청 내용">
          <TextArea rows={3} placeholder="수정이 필요한 이유나 추가 설명을 입력하세요" />
        </Form.Item>
      </Form>
    </Modal>
  )
}

/* ─── 페이지 → BOM 노드 연결 모달 (드릴다운 + 검색) ─── */
type BreadcrumbItem = { id: number | null; name: string; categoryCode?: string }

function LinkBomModal({
  page, defaultVehicleId, vehicles, vehicleCode, open, onClose,
}: {
  page: DiagramPage | null
  defaultVehicleId: number | null
  vehicles: { id: number; code: string; name: string }[]
  vehicleCode: string
  open: boolean
  onClose: () => void
}) {
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(defaultVehicleId)
  const vehicleId = selectedVehicleId
  const [q, setQ] = useState('')
  const [categoryCode, setCategoryCode] = useState<string | null>(null)
  const [currentNodeId, setCurrentNodeId] = useState<number | null>(null)
  const [stack, setStack] = useState<BreadcrumbItem[]>([])

  const qc = useQueryClient()
  const role = localStorage.getItem('role') ?? ''
  const userId = localStorage.getItem('user_id') ?? ''
  const isAdmin = role === 'admin'

  // 모달 닫힐 때 / 페이지 변경 시 / 차종 변경 시 상태 초기화
  useEffect(() => {
    if (open) {
      setQ('')
      setCategoryCode(null)
      setCurrentNodeId(null)
      setStack([])
      setSelectedVehicleId(defaultVehicleId)
    }
  }, [open, page?.id, defaultVehicleId])

  // 차종이 바뀌면 드릴다운/카테고리 상태 초기화
  useEffect(() => {
    setCategoryCode(null)
    setCurrentNodeId(null)
    setStack([])
    setQ('')
  }, [selectedVehicleId])

  // 카테고리 + 드릴다운 모드용 트리
  const { data: roots = [], isLoading: rootsLoading } = useQuery({
    queryKey: ['link-bom-roots', vehicleId, categoryCode],
    queryFn: () => bomApi.getRoots(vehicleId!, categoryCode!),
    enabled: open && !!vehicleId && !!categoryCode && currentNodeId === null && !q.trim(),
  })

  const { data: children = [], isLoading: childLoading } = useQuery({
    queryKey: ['link-bom-children', currentNodeId],
    queryFn: () => bomApi.getChildrenLazy(currentNodeId!),
    enabled: open && currentNodeId !== null && !q.trim(),
  })

  // 검색 모드용
  const { data: searchResults = [], isLoading: searchLoading } = useQuery({
    queryKey: ['link-bom-search', vehicleId, q],
    queryFn: () => bomApi.search(vehicleId!, q),
    enabled: open && !!vehicleId && q.trim().length > 0,
    staleTime: 30_000,
  })

  // 단일 루트 자동 진입 (전력추진 = 전력추진장치)
  useEffect(() => {
    if (!q.trim() && categoryCode && currentNodeId === null && roots.length === 1 && roots[0].has_children) {
      setCurrentNodeId(roots[0].id)
    }
  }, [roots, categoryCode, currentNodeId, q])

  const linkedSet = new Set((page?.linked_bom ?? []).map(b => b.material_no).filter(Boolean) as string[])

  const linkMutation = useMutation({
    mutationFn: (nodeId: number) => bomApi.linkDiagram(nodeId, { diagram_page_id: page!.id, match_type: 'manual' }),
    onSuccess: () => {
      message.success('BOM 연결됨')
      qc.invalidateQueries({ queryKey: ['catalog-pages', vehicleCode] })
    },
    onError: (e: any) => message.error(`연결 실패: ${e.message}`),
  })

  const linkRequestMutation = useMutation({
    mutationFn: (nodeId: number) => changeRequestsApi.create({
      node_id: nodeId,
      request_type: 'diagram_link_add',
      requested_value: String(page!.id),
      requester_name: userId || null,
    }),
    onSuccess: () => message.success('BOM 연결 요청이 제출되었습니다'),
    onError: (e: any) => message.error(`요청 제출 실패: ${e.message}`),
  })

  const handleNodeClick = (n: BomNode) => {
    const linked = n.material_no ? linkedSet.has(n.material_no) : false
    if (linked) return
    if (isAdmin) linkMutation.mutate(n.id)
    else linkRequestMutation.mutate(n.id)
  }

  const drillDown = (n: BomNode) => {
    setCurrentNodeId(n.id)
    setStack(prev => [...prev, { id: n.id, name: n.name }])
  }

  const goBack = (idx: number) => {
    if (idx < -1) {
      // 카테고리 선택으로 돌아가기
      setCategoryCode(null); setCurrentNodeId(null); setStack([])
    } else if (idx === -1) {
      // 카테고리 최상위로 (자동진입 있으면 다시 발동)
      setCurrentNodeId(null); setStack([])
    } else {
      setCurrentNodeId(stack[idx].id)
      setStack(prev => prev.slice(0, idx + 1))
    }
  }

  const inSearch = q.trim().length > 0
  const displayNodes: BomNode[] = inSearch
    ? searchResults
    : (currentNodeId === null ? roots : children)
  const isLoading = inSearch ? searchLoading : (currentNodeId === null ? rootsLoading : childLoading)

  return (
    <Modal
      open={open}
      onCancel={() => { setQ(''); onClose() }}
      title={page ? `BOM 노드 연결 — ${page.assembly || page.chapter || ''} (p.${page.book_page ?? page.file_no})` : 'BOM 연결'}
      footer={null}
      width={720}
      style={{ maxWidth: 'calc(100vw - 32px)' }}
    >
      {!isAdmin && (
        <div style={{ marginBottom: 8, padding: '6px 10px', borderRadius: 4,
          background: 'rgba(250, 173, 20, 0.12)', fontSize: 12, color: '#d48806' }}>
          ⚠️ 일반 사용자: 노드 선택 시 연결 <b>요청</b>이 제출되며, 관리자 승인 후 적용됩니다.
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: '#888', whiteSpace: 'nowrap' }}>차종</span>
        <Select
          style={{ width: 200 }}
          value={selectedVehicleId}
          onChange={setSelectedVehicleId}
          placeholder="차종 선택"
          options={vehicles.map(v => ({ value: v.id, label: `${v.name} (${v.code})` }))}
        />
        <Input.Search
          placeholder="자재명 / BOM 코드 / 도면번호로 검색"
          value={q}
          onChange={e => setQ(e.target.value)}
          allowClear
          style={{ flex: 1 }}
          disabled={!vehicleId}
        />
      </div>

      {!vehicleId && (
        <Empty description="차종을 선택하세요" style={{ padding: 30 }} />
      )}

      {!!vehicleId && !inSearch && (
        <>
          {/* 카테고리 미선택 → 카테고리 그리드 */}
          {!categoryCode ? (
            <>
              <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>카테고리를 선택하세요</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {CATEGORIES.map(c => {
                  const color = CATEGORY_COLORS[c.code] ?? '#999'
                  return (
                    <Button key={c.code} onClick={() => setCategoryCode(c.code)}
                      style={{ height: 56, borderLeft: `4px solid ${color}`, textAlign: 'left' }}>
                      <div style={{ fontSize: 11, color: '#999' }}>{c.code}</div>
                      <div style={{ fontWeight: 600 }}>{c.name}</div>
                    </Button>
                  )
                })}
              </div>
            </>
          ) : (
            <>
              {/* breadcrumb */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 10, flexWrap: 'wrap', fontSize: 12 }}>
                <a onClick={() => goBack(-2)}>{CATEGORIES.find(c => c.code === categoryCode)?.name}</a>
                {stack.map((s, i) => (
                  <span key={s.id ?? i}>
                    <span style={{ margin: '0 4px', color: '#bbb' }}>/</span>
                    {i === stack.length - 1
                      ? <b>{s.name}</b>
                      : <a onClick={() => goBack(i)}>{s.name}</a>}
                  </span>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {!!vehicleId && (inSearch || categoryCode) && (
        <div style={{ maxHeight: 420, overflow: 'auto', border: '1px solid rgba(128,128,128,0.15)', borderRadius: 4 }}>
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: 30 }}><Spin /></div>
          ) : displayNodes.length === 0 ? (
            <Empty description={inSearch ? '검색 결과 없음' : '하위 항목 없음'} style={{ padding: 30 }} />
          ) : (
            <List size="small" dataSource={displayNodes.slice(0, 100)} renderItem={(n) => {
              const linked = n.material_no ? linkedSet.has(n.material_no) : false
              const canDrill = !!n.has_children
              return (
                <List.Item
                  style={{ padding: '8px 12px', opacity: linked ? 0.6 : 1 }}
                  actions={[
                    linked
                      ? <Tag color="success" style={{ fontSize: 10 }}>연결됨</Tag>
                      : <Button size="small" type="primary" icon={<PlusOutlined />}
                          onClick={() => handleNodeClick(n)}>연결</Button>,
                    canDrill
                      ? <Button size="small" onClick={() => drillDown(n)}>하위 ▸</Button>
                      : null,
                  ].filter(Boolean)}
                >
                  <List.Item.Meta
                    title={<span style={{ fontSize: 13 }}>{n.name}</span>}
                    description={
                      <span style={{ fontSize: 11 }}>
                        <Typography.Text code>{n.material_no || '-'}</Typography.Text>
                        {n.drawing_no && <span style={{ marginLeft: 8 }}>도면 {n.drawing_no}</span>}
                      </span>
                    }
                  />
                </List.Item>
              )
            }} />
          )}
          {displayNodes.length > 100 && (
            <div style={{ textAlign: 'center', padding: 8, color: '#999', fontSize: 12 }}>
              상위 100개만 표시 — 검색어를 좁혀주세요
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}

export default function CatalogPage() {
  const { token: tk } = theme.useToken()
  const [vehicleCode, setVehicleCode] = useState<string | null>(null)
  const [requestPage, setRequestPage] = useState<DiagramPage | null>(null)
  const [linkPage, setLinkPage] = useState<DiagramPage | null>(null)

  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn: vehicleApi.list,
  })

  const { data: pages = [], isLoading } = useQuery({
    queryKey: ['catalog-pages', vehicleCode],
    queryFn: () => diagramPagesApi.allPages(vehicleCode!),
    enabled: !!vehicleCode,
    staleTime: 0,
  })

  const vehicleOptions = vehicles
    .filter(v => VEHICLE_CODE_MAP[v.code])
    .map(v => ({ value: VEHICLE_CODE_MAP[v.code], label: `${v.name} (${v.code})` }))

  // vehicleCode → vehicleId 매핑 (BOM 검색용)
  const currentVehicleId = (() => {
    if (!vehicleCode) return null
    const found = vehicles.find(v => VEHICLE_CODE_MAP[v.code] === vehicleCode)
    return found?.id ?? null
  })()

  return (
    <div style={{ height: 'calc(100vh - 112px)', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* 페이지 헤더 */}
      <div>
        <Title level={4} style={{ marginBottom: 2 }}>
          <SearchOutlined style={{ marginRight: 8, color: '#1677ff' }} />
          차종별 명칭도감
        </Title>
        <Text type="secondary" style={{ fontSize: 12 }}>
          차종을 선택하면 전체 명칭도감 페이지를 갤러리 형태로 볼 수 있습니다
        </Text>
      </div>
      {/* 툴바 */}
      <Card size="small" style={{ flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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
                    {p.drawing_no && (
                      <div style={{ fontSize: 10, color: tk.colorTextSecondary, marginTop: 1, fontFamily: 'monospace' }}>
                        {p.drawing_no}
                      </div>
                    )}
                    {/* BOM 연결 표시 */}
                    {p.linked_bom?.length > 0 ? (
                      <Tooltip title={p.linked_bom.map(b => `${b.material_no ?? ''} ${b.name}`).join('\n')} overlayStyle={{ whiteSpace: 'pre-line' }}>
                        <Tag icon={<LinkOutlined />} color="success" style={{ fontSize: 9, marginTop: 3, cursor: 'default', padding: '0 4px', lineHeight: '16px', height: 16 }}>
                          BOM 연결 {p.linked_bom.length}건
                        </Tag>
                      </Tooltip>
                    ) : (
                      <Tag icon={<DisconnectOutlined />} color="default" style={{ fontSize: 9, marginTop: 3, cursor: 'default', padding: '0 4px', lineHeight: '16px', height: 16 }}>
                        BOM 미연결
                      </Tag>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                      <span style={{ fontSize: 10, color: tk.colorTextSecondary }}>
                        {p.chapter && p.assembly ? p.chapter : ''} · {p.file_no}p
                      </span>
                      <div style={{ display: 'flex', gap: 2 }}>
                        <Button
                          size="small"
                          type="text"
                          icon={<LinkOutlined />}
                          style={{ fontSize: 10, height: 20, padding: '0 4px', color: tk.colorPrimary }}
                          onClick={() => setLinkPage(p)}
                        >
                          BOM연결
                        </Button>
                        <Button
                          size="small"
                          type="text"
                          icon={<EditOutlined />}
                          style={{ fontSize: 10, height: 20, padding: '0 4px', color: tk.colorTextSecondary }}
                          onClick={() => setRequestPage(p)}
                        >
                          수정요청
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </Image.PreviewGroup>
          </div>
        )}
      </div>

      <RequestModal
        page={requestPage}
        vehicle={vehicleCode ?? ''}
        open={requestPage !== null}
        onClose={() => setRequestPage(null)}
      />

      <LinkBomModal
        page={linkPage}
        defaultVehicleId={currentVehicleId}
        vehicles={vehicles}
        vehicleCode={vehicleCode ?? ''}
        open={linkPage !== null}
        onClose={() => setLinkPage(null)}
      />
    </div>
  )
}
