import { useState } from 'react'
import {
  Modal, Form, Input, Button, Divider,
  Upload, message, InputNumber, Typography, Tag, Checkbox,
  Select, theme,
} from 'antd'
import { PlusOutlined, MinusCircleOutlined, UploadOutlined } from '@ant-design/icons'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { changeRequestsApi } from '../../api/changeRequests'
import { bomApi } from '../../api/bom'
import { diagramPagesApi } from '../../api/diagramPages'
import type { BomNode } from '../../types'
import { VEHICLE_DB_CODE } from '../../types'

const { Text } = Typography
const API_BASE = '/api'

// ── 공통: 단일 부품 입력 폼 ─────────────────────────────────────
function NewNodeRow({ name, index, removable, remove }: {
  name: number; index: number; removable: boolean; remove: (n: number) => void
}) {
  const { token: tk } = theme.useToken()
  return (
    <div style={{ border: `1px solid ${tk.colorBorder}`, borderRadius: 6, padding: '10px 12px', marginBottom: 8, background: tk.colorFillAlter }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <Text style={{ fontSize: 12, fontWeight: 600, color: '#1677ff' }}>신규 부품 {index + 1}</Text>
        {removable && (
          <Button type="text" danger size="small" icon={<MinusCircleOutlined />} onClick={() => remove(name)} />
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px' }}>
        {[
          { fname: 'name',            label: '부품명',    placeholder: '부품명', required: true },
          { fname: 'manufacturer',    label: '제작사',    placeholder: '제작사' },
          { fname: 'manufacturer_pn', label: 'CPN',       placeholder: '제작사 부품번호' },
          { fname: 'specification',   label: '규격/사양', placeholder: '규격' },
          { fname: 'unit',            label: '단위',      placeholder: '개, EA, set...' },
          { fname: 'material',        label: '재질',      placeholder: '재질' },
          { fname: 'notes',           label: '비고',      placeholder: '비고' },
        ].map(({ fname, label, placeholder, required }) => (
          <Form.Item key={fname} name={[name, fname]} label={label} style={{ marginBottom: 4 }}
            rules={required ? [{ required: true, message: '필수' }] : undefined}>
            <Input placeholder={placeholder} size="small" />
          </Form.Item>
        ))}
        <Form.Item name={[name, 'quantity']} label="수량" style={{ marginBottom: 4 }}>
          <InputNumber placeholder="수량" size="small" style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name={[name, 'weight_kg']} label="중량(kg)" style={{ marginBottom: 4 }}>
          <InputNumber placeholder="kg" size="small" style={{ width: '100%' }} step={0.01} />
        </Form.Item>
      </div>
    </div>
  )
}

// ── 공통: 제출 훅 ────────────────────────────────────────────────
function useSubmit(onDone: () => void) {
  const qc = useQueryClient()
  const [submitting, setSubmitting] = useState(false)

  const simpleMut = useMutation({
    mutationFn: changeRequestsApi.create,
    onSuccess: () => {
      message.success('수정 요청이 제출되었습니다')
      onDone()
      qc.invalidateQueries({ queryKey: ['change-requests'] })
    },
    onError: () => message.error('제출 중 오류가 발생했습니다'),
  })

  return { submitting, setSubmitting, simpleMut, qc }
}

// ══════════════════════════════════════════════════════════════════
// 1) BOM 수정 버튼 (빨간)
// ══════════════════════════════════════════════════════════════════
const BOM_TYPES = [
  { value: 'bom_node_add',      label: '하위 부품 추가' },
  { value: 'bom_kit_add',       label: '수리 키트 추가 (구성 부품 묶음 생성)' },
  { value: 'bom_node_revision', label: '부품 개량 추가 (.N 생성)' },
  { value: 'bom_node_edit',     label: 'BOM 내용 수정' },
  { value: 'bom_node_delete',   label: 'BOM 노드 삭제' },
]

export function BomRequestButton({ node, vehicleTypeId }: { node: BomNode; vehicleTypeId: number }) {
  const { token: tk } = theme.useToken()
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm()
  const requestType: string | undefined = Form.useWatch('request_type', form)
  const close = () => { form.resetFields(); setOpen(false) }
  const { submitting, setSubmitting, simpleMut } = useSubmit(close)

  const handleSubmit = async (values: Record<string, unknown>) => {
    setSubmitting(true)
    try {
      if (requestType === 'bom_node_add') {
        const newNodes = (values.new_nodes as unknown[] | undefined) ?? []
        simpleMut.mutate({
          node_id: node.id, request_type: 'bom_node_add',
          node_data: JSON.stringify({ new_nodes: newNodes }),
          requester_note: (values.requester_note as string) || null,
        })
        return
      }
      if (requestType === 'bom_kit_add') {
        simpleMut.mutate({
          node_id: node.id, request_type: 'bom_node_add',
          node_data: JSON.stringify({ kit: true, kit_name: values.kit_name, kit_node_ids: values.kit_node_ids }),
          requester_note: (values.requester_note as string) || null,
        })
        return
      }
      if (requestType === 'bom_node_revision') {
        const revNodes = (values.revision_node as unknown[] | undefined) ?? []
        simpleMut.mutate({
          node_id: node.id, request_type: 'bom_node_revision',
          node_data: JSON.stringify({ node: revNodes[0] ?? {} }),
          requester_note: (values.requester_note as string) || null,
        })
        return
      }
      if (requestType === 'bom_node_edit') {
        const fields: Record<string, unknown> = {}
        const map: Record<string, string> = {
          edit_name: 'name', edit_manufacturer: 'manufacturer',
          edit_manufacturer_pn: 'manufacturer_pn', edit_specification: 'specification',
        }
        for (const [k, v] of Object.entries(map)) {
          if (values[k] !== undefined && values[k] !== '') fields[v] = values[k]
        }
        simpleMut.mutate({
          node_id: node.id, request_type: 'bom_node_edit',
          node_data: JSON.stringify(fields),
          requester_note: (values.requester_note as string) || null,
        })
        return
      }
      if (requestType === 'bom_node_delete') {
        simpleMut.mutate({
          node_id: node.id, request_type: 'bom_node_delete',
          requested_value: values.move_to_node_id ? String(values.move_to_node_id) : null,
          requester_note: (values.requester_note as string) || null,
        })
        return
      }
    } catch (e: unknown) {
      message.error(`제출 실패: ${e instanceof Error ? e.message : '오류'}`)
    } finally {
      setSubmitting(false)
    }
  }

  const isWide = ['bom_node_add', 'bom_kit_add', 'bom_node_revision', 'bom_node_edit', 'bom_node_delete'].includes(requestType ?? '')

  return (
    <>
      <Button
        size="small" type="default"
        style={{ color: '#cf1322', borderColor: '#ffccc7', fontSize: 11, background: '#fff2f0', minWidth: 80 }}
        onClick={() => setOpen(true)}
      >
        BOM 수정
      </Button>

      <Modal
        open={open}
        title={`BOM 수정 요청 — ${node.name}`}
        okText="제출" cancelText="취소"
        width={isWide ? 660 : 460}
        onCancel={close}
        onOk={() => form.submit()}
        confirmLoading={submitting || simpleMut.isPending}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit} style={{ marginTop: 12 }}>
          <div style={{ background: tk.colorFillAlter, borderRadius: 6, padding: '6px 10px', marginBottom: 12, fontSize: 12 }}>
            <Text type="secondary">대상: </Text>
            <Text strong>{node.name}</Text>
            {node.material_no && <Text code style={{ marginLeft: 8 }}>{node.material_no}</Text>}
          </div>

          <Form.Item name="request_type" label="요청 유형" rules={[{ required: true }]}>
            <Select
              options={BOM_TYPES}
              placeholder="유형 선택"
              onChange={() => {
                form.resetFields([
                  'new_nodes', 'kit_node_ids', 'kit_name', 'revision_node',
                  'requester_note', 'edit_name', 'edit_manufacturer',
                  'edit_manufacturer_pn', 'edit_specification', 'move_to_node_id',
                ])
              }}
            />
          </Form.Item>

          {requestType === 'bom_node_add' && <BomNodeAddSection node={node} />}
          {requestType === 'bom_kit_add' && <BomKitAddSection node={node} />}
          {requestType === 'bom_node_revision' && <BomNodeRevisionSection node={node} />}
          {requestType === 'bom_node_edit' && <BomNodeEditSection node={node} />}
          {requestType === 'bom_node_delete' && <BomNodeDeleteSection node={node} vehicleTypeId={vehicleTypeId} />}

          {requestType && (
            <>
              <Divider style={{ margin: '8px 0' }} />
              <Form.Item name="requester_note" label="요청 의견 / 사유">
                <Input.TextArea rows={2} placeholder="추가 설명을 입력하세요" />
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>
    </>
  )
}

// ── BOM 하위 부품 추가 ───────────────────────────────────────────
function BomNodeAddSection({ node }: { node: BomNode }) {
  const { token: tk } = theme.useToken()
  const { data: siblings = [] } = useQuery({
    queryKey: ['children', node.id],
    queryFn: () => bomApi.getChildrenLazy(node.id),
    staleTime: 30_000,
  })
  const nextSeq = siblings.length + 1
  const nextCode = node.material_no ? `${node.material_no}-${nextSeq}` : `(연번 ${nextSeq})`

  return (
    <>
      <div style={{ background: tk.colorInfoBg, border: `1px solid ${tk.colorInfoBorder}`, borderRadius: 6, padding: '8px 12px', marginBottom: 10, fontSize: 12 }}>
        <Text>
          <Text strong code>{node.material_no ?? node.name}</Text> 아래에 추가됩니다.
          현재 하위 {siblings.length}개 → 다음 연번:{' '}
          <Text strong style={{ color: '#1677ff' }}>{nextCode}</Text>
        </Text>
      </div>
      <Form.List name="new_nodes" initialValue={[{}]}>
        {(fields, { add, remove }) => (
          <>
            {fields.map(({ name }, index) => (
              <NewNodeRow key={name} name={name} index={index} removable={fields.length > 1} remove={remove} />
            ))}
            <Button type="dashed" onClick={() => add({})} icon={<PlusOutlined />} block size="small" style={{ marginBottom: 8 }}>
              부품 추가
            </Button>
          </>
        )}
      </Form.List>
    </>
  )
}

// ── 수리키트 구성 추가 ───────────────────────────────────────────
function BomKitAddSection({ node }: { node: BomNode }) {
  const { token: tk } = theme.useToken()
  const { data: siblings = [], isLoading } = useQuery({
    queryKey: ['children', node.id],
    queryFn: () => bomApi.getChildrenLazy(node.id),
    staleTime: 30_000,
  })

  return (
    <>
      <div style={{ background: tk.colorInfoBg, border: `1px solid ${tk.colorInfoBorder}`, borderRadius: 6, padding: '8px 12px', marginBottom: 10, fontSize: 12 }}>
        <Text>
          <Text strong code>{node.material_no ?? node.name}</Text>의 하위 부품 중 수리키트를 구성할 항목을 선택하세요.
        </Text>
      </div>
      {isLoading ? (
        <Text type="secondary" style={{ fontSize: 12 }}>불러오는 중...</Text>
      ) : siblings.length === 0 ? (
        <div style={{ color: '#bbb', fontSize: 12, marginBottom: 8 }}>하위 부품이 없습니다.</div>
      ) : (
        <Form.Item name="kit_node_ids" label="수리키트 구성 부품 선택" rules={[{ required: true, message: '하나 이상 선택하세요' }]}>
          <Checkbox.Group style={{ width: '100%' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {siblings.map((s) => (
                <Checkbox key={s.id} value={s.id}>
                  <Text code style={{ fontSize: 12 }}>{s.material_no}</Text>
                  <Text style={{ marginLeft: 6, fontSize: 12 }}>{s.name}</Text>
                  {s.manufacturer && <Text type="secondary" style={{ fontSize: 11, marginLeft: 4 }}>({s.manufacturer})</Text>}
                </Checkbox>
              ))}
            </div>
          </Checkbox.Group>
        </Form.Item>
      )}
      <Form.Item name="kit_name" label="수리키트 명칭" rules={[{ required: true }]}>
        <Input placeholder="예: 오일펌프 수리키트" />
      </Form.Item>
    </>
  )
}

// ── BOM 개량 추가 ────────────────────────────────────────────────
function BomNodeRevisionSection({ node }: { node: BomNode }) {
  const { token: tk } = theme.useToken()
  const { data: parentChildren = [] } = useQuery({
    queryKey: ['children-of-parent', node.id],
    queryFn: async () => {
      const nodeData = await bomApi.getNode(node.id)
      if (!nodeData.parent_id) return []
      return bomApi.getChildrenLazy(nodeData.parent_id)
    },
    staleTime: 30_000,
  })

  const baseCode = node.material_no ?? ''
  const existingRevisions = parentChildren
    .map((c) => c.material_no ?? '')
    .filter((m) => m.startsWith(baseCode + '.'))
    .map((m) => parseInt(m.slice(baseCode.length + 1), 10))
    .filter((n) => !isNaN(n))

  const nextRevNum = existingRevisions.length > 0 ? Math.max(...existingRevisions) + 1 : 1
  const nextRevCode = `${baseCode}.${nextRevNum}`

  return (
    <>
      <div style={{ background: tk.colorWarningBg, border: `1px solid ${tk.colorWarningBorder}`, borderRadius: 6, padding: '8px 12px', marginBottom: 10, fontSize: 12 }}>
        <Text>
          현재 노드 <Text strong code>{baseCode}</Text>는 그대로 유지되고,
          개량 버전 <Text strong code style={{ color: '#d46b08' }}>{nextRevCode}</Text>이 신규 생성됩니다.
        </Text>
      </div>
      <Form.List name="revision_node" initialValue={[{}]}>
        {(fields) => (
          <>
            {fields.map(({ name }, index) => (
              <NewNodeRow key={name} name={name} index={index} removable={false} remove={() => {}} />
            ))}
          </>
        )}
      </Form.List>
    </>
  )
}

// ── BOM 노드 수정 ────────────────────────────────────────────────
function BomNodeEditSection({ node }: { node: BomNode }) {
  return (
    <>
      <div style={{ marginBottom: 8, fontSize: 12 }}>
        <Text type="secondary">변경할 필드만 입력하세요. 비워두면 현재 값이 유지됩니다.</Text>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px' }}>
        {[
          { name: 'edit_name',            label: '부품명',    placeholder: node.name },
          { name: 'edit_manufacturer',    label: '제작사',    placeholder: node.manufacturer ?? '—' },
          { name: 'edit_manufacturer_pn', label: 'CPN',       placeholder: node.manufacturer_pn ?? '—' },
          { name: 'edit_specification',   label: '규격/사양', placeholder: node.specification ?? '—' },
        ].map(({ name, label, placeholder }) => (
          <Form.Item key={name} name={name} label={label} style={{ marginBottom: 4 }}>
            <Input placeholder={placeholder} size="small" />
          </Form.Item>
        ))}
      </div>
    </>
  )
}

// ── BOM 노드 삭제 ────────────────────────────────────────────────
function BomNodeDeleteSection({ node, vehicleTypeId }: { node: BomNode; vehicleTypeId: number }) {
  const { token: tk } = theme.useToken()
  const [searchQ, setSearchQ] = useState('')

  const { data: children = [] } = useQuery({
    queryKey: ['children', node.id],
    queryFn: () => bomApi.getChildrenLazy(node.id),
    staleTime: 30_000,
  })

  const { data: searchResults = [], isFetching: searching } = useQuery({
    queryKey: ['bom-search', vehicleTypeId, searchQ],
    queryFn: () => bomApi.search(vehicleTypeId, searchQ),
    enabled: searchQ.length >= 2,
    staleTime: 10_000,
  })

  return (
    <>
      <div style={{ background: tk.colorErrorBg, border: `1px solid ${tk.colorErrorBorder}`, borderRadius: 6, padding: '8px 12px', marginBottom: 10 }}>
        <Text type="danger" style={{ fontSize: 12 }}>
          이 노드의 삭제를 요청합니다. 관리자가 검토 후 승인 시 처리됩니다.
        </Text>
        {children.length > 0 && (
          <div style={{ marginTop: 6 }}>
            <Text style={{ fontSize: 12 }}>하위 부품 {children.length}개:</Text>
            <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {children.map((c) => (
                <Tag key={c.id} style={{ fontSize: 11 }}>
                  {c.material_no ? `[${c.material_no}] ` : ''}{c.name}
                </Tag>
              ))}
            </div>
          </div>
        )}
      </div>
      {children.length > 0 && (
        <>
          <div style={{ fontSize: 12, marginBottom: 6 }}>
            <Text type="secondary">하위 부품을 다른 노드로 이동할 경우 이동 대상을 검색해 지정하세요.</Text>
          </div>
          <Input
            placeholder="이동할 상위 노드 검색 (2자 이상)"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            size="small"
            style={{ marginBottom: 8 }}
            suffix={searching ? <Text style={{ fontSize: 11 }}>검색중...</Text> : null}
          />
          <Form.Item name="move_to_node_id" label="하위 부품 이동 대상 노드 (선택)">
            <Select
              allowClear
              placeholder="이동할 부모 노드 선택"
              options={searchResults.map((r) => ({
                value: r.id,
                label: `${r.material_no ? `[${r.material_no}] ` : ''}${r.name}`,
              }))}
              style={{ width: '100%' }}
            />
          </Form.Item>
        </>
      )}
    </>
  )
}


// ══════════════════════════════════════════════════════════════════
// 2) 자재번호 수정 버튼 (파란)
// ══════════════════════════════════════════════════════════════════
const CORP_MAT_TYPES = [
  { value: 'corp_material_no_add',    label: '추가' },
  { value: 'corp_material_no_edit',   label: '수정' },
  { value: 'corp_material_no_delete', label: '삭제' },
]

export function CorpMatRequestButton({ node }: { node: BomNode }) {
  const { token: tk } = theme.useToken()
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm()
  const requestType: string | undefined = Form.useWatch('request_type', form)
  const close = () => { form.resetFields(); setOpen(false) }
  const { submitting, setSubmitting, simpleMut } = useSubmit(close)

  const handleSubmit = async (values: Record<string, unknown>) => {
    setSubmitting(true)
    try {
      simpleMut.mutate({
        node_id: node.id,
        request_type: requestType!,
        current_value: node.corp_material_no ?? null,
        requested_value: (values.requested_value as string) || null,
        requester_note: (values.requester_note as string) || null,
      })
    } catch (e: unknown) {
      message.error(`제출 실패: ${e instanceof Error ? e.message : '오류'}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Button
        size="small" type="default"
        style={{ color: '#0958d9', borderColor: '#adc6ff', fontSize: 11, background: '#f0f5ff', marginRight: 30, minWidth: 80 }}
        onClick={() => setOpen(true)}
      >
        자재번호 수정
      </Button>

      <Modal
        open={open}
        title={`공사 자재번호 수정 요청 — ${node.name}`}
        okText="제출" cancelText="취소"
        width={420}
        style={{ maxWidth: 'calc(100vw - 32px)' }}
        onCancel={close}
        onOk={() => form.submit()}
        confirmLoading={submitting || simpleMut.isPending}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit} style={{ marginTop: 12 }}>
          <div style={{ background: tk.colorFillAlter, borderRadius: 6, padding: '6px 10px', marginBottom: 12, fontSize: 12 }}>
            <Text type="secondary">현재: </Text>
            <Text strong code>{node.corp_material_no ?? '(미등록)'}</Text>
          </div>

          <Form.Item name="request_type" label="요청 유형" rules={[{ required: true }]}>
            <Select
              options={CORP_MAT_TYPES}
              placeholder="유형 선택"
              onChange={() => form.resetFields(['requested_value', 'requester_note'])}
            />
          </Form.Item>

          {(requestType === 'corp_material_no_add' || requestType === 'corp_material_no_edit') && (
            <Form.Item name="requested_value" label="공사 자재번호" rules={[{ required: true }]}>
              <Input placeholder="예: 777-12345-6" />
            </Form.Item>
          )}

          {requestType && (
            <>
              <Divider style={{ margin: '8px 0' }} />
              <Form.Item name="requester_note" label="요청 의견 / 사유">
                <Input.TextArea rows={2} placeholder="추가 설명을 입력하세요" />
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>
    </>
  )
}


// ══════════════════════════════════════════════════════════════════
// 3) 사진 수정 버튼 (초록)
// ══════════════════════════════════════════════════════════════════
export function PhotoRequestButton({
  node, vehicleTypeId, onUpload, uploading: externalUploading,
}: {
  node: BomNode
  vehicleTypeId: number
  onUpload?: (file: File) => Promise<boolean | void>
  uploading?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm()
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const requestType: string | undefined = Form.useWatch('request_type', form)
  const close = () => { form.resetFields(); setPhotoFile(null); setOpen(false) }
  const { submitting, setSubmitting, simpleMut } = useSubmit(close)

  const vehicleCode = VEHICLE_DB_CODE[vehicleTypeId]
  const drawingNo = node.drawing_no || node.manufacturer_pn

  const { data: uploadedPhotos = [] } = useQuery({
    queryKey: ['photos', node.id],
    queryFn: async (): Promise<string[]> => {
      const res = await fetch(`${API_BASE}/bom/nodes/${node.id}/photos`)
      if (!res.ok) return []
      return res.json()
    },
    enabled: open,
    staleTime: 30_000,
  })

  const { data: diagramPages = [] } = useQuery({
    queryKey: ['diagram-pages', 'drawing', drawingNo, vehicleCode],
    queryFn: () => diagramPagesApi.byDrawingNo(drawingNo!, vehicleCode),
    enabled: open && !!drawingNo,
    staleTime: 300_000,
  })

  const deleteOptions = [
    ...uploadedPhotos.map((fn) => ({ value: `upload:${fn}`, label: `📷 ${fn}` })),
    ...diagramPages.map((dp) => ({
      value: `diagram:${dp.id}`,
      label: `📖 명칭도감 ${dp.book_page ?? dp.file_no}p${dp.assembly ? ` (${dp.assembly})` : ''}`,
    })),
  ]

  const qc = useQueryClient()

  const handleSubmit = async (values: Record<string, unknown>) => {
    setSubmitting(true)
    try {
      if (requestType === 'photo_add') {
        if (!photoFile) { message.warning('사진을 선택해주세요'); setSubmitting(false); return }
        // 직접 업로드 가능하면 즉시 업로드, 아니면 수정 요청으로 제출
        if (onUpload) {
          await onUpload(photoFile)
          close()
        } else {
          const fd = new FormData()
          fd.append('node_id', String(node.id))
          fd.append('request_type', 'photo_add')
          if (values.requester_note) fd.append('requester_note', values.requester_note as string)
          fd.append('photo', photoFile)
          const res = await fetch(`${API_BASE}/change-requests/with-photo`, { method: 'POST', body: fd })
          if (!res.ok) throw new Error(await res.text())
          message.success('사진 추가 요청이 제출되었습니다')
          close()
          qc.invalidateQueries({ queryKey: ['change-requests'] })
        }
        return
      }
      if (requestType === 'photo_delete') {
        const selected = values.current_value as string[] | undefined
        simpleMut.mutate({
          node_id: node.id, request_type: 'photo_delete',
          current_value: selected ? JSON.stringify(selected) : null,
          requester_note: (values.requester_note as string) || null,
        })
        return
      }
    } catch (e: unknown) {
      message.error(`제출 실패: ${e instanceof Error ? e.message : '오류'}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Button
        size="small" type="default"
        style={{ color: '#389e0d', borderColor: '#b7eb8f', fontSize: 11, background: '#f6ffed', marginRight: 30, minWidth: 80 }}
        loading={externalUploading}
        onClick={() => setOpen(true)}
      >
        사진 수정
      </Button>

      <Modal
        open={open}
        title={`사진 수정 요청 — ${node.name}`}
        okText="제출" cancelText="취소"
        width={440}
        style={{ maxWidth: 'calc(100vw - 32px)' }}
        onCancel={close}
        onOk={() => form.submit()}
        confirmLoading={submitting || simpleMut.isPending}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit} style={{ marginTop: 12 }}>
          <Form.Item name="request_type" label="요청 유형" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'photo_add',    label: '사진 추가' },
                { value: 'photo_delete', label: '사진 삭제' },
              ]}
              placeholder="유형 선택"
              onChange={() => { form.resetFields(['current_value', 'requester_note']); setPhotoFile(null) }}
            />
          </Form.Item>

          {requestType === 'photo_add' && (
            <Form.Item label="첨부 사진" required>
              <Upload accept="image/*" maxCount={1}
                beforeUpload={(file) => { setPhotoFile(file); return false }}
                onRemove={() => setPhotoFile(null)}>
                <Button icon={<UploadOutlined />}>사진 선택</Button>
              </Upload>
            </Form.Item>
          )}

          {requestType === 'photo_delete' && (
            deleteOptions.length === 0 ? (
              <div style={{ color: '#bbb', fontSize: 12, marginBottom: 8 }}>연결된 사진이 없습니다.</div>
            ) : (
              <Form.Item name="current_value" label="삭제할 사진 선택" rules={[{ required: true }]}>
                <Checkbox.Group style={{ width: '100%' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {deleteOptions.map((o) => (
                      <Checkbox key={o.value} value={o.value}>{o.label}</Checkbox>
                    ))}
                  </div>
                </Checkbox.Group>
              </Form.Item>
            )
          )}

          {requestType && (
            <>
              <Divider style={{ margin: '8px 0' }} />
              <Form.Item name="requester_note" label="요청 의견 / 사유">
                <Input.TextArea rows={2} placeholder="추가 설명을 입력하세요" />
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>
    </>
  )
}


// ── 하위 호환: 기존 default export 유지 (사용처가 있을 경우 대비) ─
export default function ChangeRequestForm({ node, vehicleTypeId }: { node: BomNode; vehicleTypeId: number }) {
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', borderTop: '1px solid #f0f0f0', paddingTop: 10 }}>
      <BomRequestButton node={node} vehicleTypeId={vehicleTypeId} />
      <CorpMatRequestButton node={node} />
      <PhotoRequestButton node={node} vehicleTypeId={vehicleTypeId} />
    </div>
  )
}
