import { useState } from 'react'
import {
  Card, Descriptions, Tag, Button, Space, Popconfirm, Empty,
  Divider, Input, Select, Form, message, Tooltip, Image,
} from 'antd'
import {
  EditOutlined, DeleteOutlined, PlusOutlined, StarFilled, StarOutlined, BookOutlined,
} from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { compatApi } from '../../api/compatibility'
import { nodeMaterialsApi } from '../../api/nodeMaterials'
import { vehicleApi } from '../../api/vehicles'
import { diagramPagesApi } from '../../api/diagramPages'
import { bomApi } from '../../api/bom'
import type { BomNode, NodeMaterial } from '../../types'
import { CATEGORIES, CATEGORY_COLORS, formatBomCode } from '../../types'

interface Props {
  node: BomNode | null
  loading?: boolean
  onEdit: () => void
  onDelete: () => void
  onAddChild: () => void
}

const COMPAT_COLORS: Record<string, string> = {
  compatible: 'green',
  partial: 'orange',
  incompatible: 'red',
}
const COMPAT_LABELS: Record<string, string> = {
  compatible: '호환',
  partial: '부분호환',
  incompatible: '비호환',
}

function MaterialsSection({ node }: { node: BomNode }) {
  const qc = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form] = Form.useForm()

  const { data: materials = [] } = useQuery({
    queryKey: ['node-materials', node.id],
    queryFn: () => nodeMaterialsApi.list(node.id),
    staleTime: 30_000,
  })

  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn: vehicleApi.list,
    staleTime: 300_000,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['node-materials', node.id] })

  const addMutation = useMutation({
    mutationFn: (vals: any) => nodeMaterialsApi.add(node.id, vals),
    onSuccess: () => { message.success('추가되었습니다.'); invalidate(); setAdding(false); form.resetFields() },
    onError: (e: any) => message.error(e.response?.data?.detail ?? e.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({ matId, vals }: { matId: number; vals: any }) =>
      nodeMaterialsApi.update(node.id, matId, vals),
    onSuccess: () => { message.success('수정되었습니다.'); invalidate(); setEditingId(null) },
    onError: (e: any) => message.error(e.response?.data?.detail ?? e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (matId: number) => nodeMaterialsApi.delete(node.id, matId),
    onSuccess: () => { message.success('삭제되었습니다.'); invalidate() },
  })

  const vehicleOptions = vehicles.map((v) => ({ value: v.id, label: `${v.name} (${v.code})` }))

  const formFields = (initialValues?: Partial<NodeMaterial>) => (
    <Form
      form={form}
      size="small"
      layout="inline"
      initialValues={initialValues}
      onFinish={(vals) => {
        const data = {
          corp_material_no: vals.corp_material_no,
          vehicle_type_id: vals.vehicle_type_id ?? null,
          is_primary: vals.is_primary ?? false,
          notes: vals.notes ?? null,
        }
        if (editingId != null) {
          updateMutation.mutate({ matId: editingId, vals: data })
        } else {
          addMutation.mutate(data)
        }
      }}
      style={{ marginTop: 8, flexWrap: 'wrap', gap: 4 }}
    >
      <Form.Item name="corp_material_no" rules={[{ required: true, message: '자재번호 필수' }]} style={{ marginBottom: 4 }}>
        <Input placeholder="공사 자재번호" style={{ width: 130, fontFamily: 'monospace' }} />
      </Form.Item>
      <Form.Item name="vehicle_type_id" style={{ marginBottom: 4 }}>
        <Select placeholder="차종 (선택)" allowClear style={{ width: 150 }} options={vehicleOptions} />
      </Form.Item>
      <Form.Item name="notes" style={{ marginBottom: 4 }}>
        <Input placeholder="비고" style={{ width: 100 }} />
      </Form.Item>
      <Form.Item style={{ marginBottom: 4 }}>
        <Space>
          <Button
            size="small" type="primary" htmlType="submit"
            loading={addMutation.isPending || updateMutation.isPending}
          >
            저장
          </Button>
          <Button size="small" onClick={() => { setAdding(false); setEditingId(null); form.resetFields() }}>
            취소
          </Button>
        </Space>
      </Form.Item>
    </Form>
  )

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontWeight: 600, color: '#555', fontSize: 13 }}>공사 자재번호</span>
        {!adding && editingId == null && (
          <Button size="small" icon={<PlusOutlined />} onClick={() => { setAdding(true); form.resetFields() }}>
            추가
          </Button>
        )}
      </div>

      {materials.length === 0 && !adding && (
        <span style={{ color: '#bbb', fontSize: 12 }}>등록된 자재번호 없음</span>
      )}

      {materials.map((m) =>
        editingId === m.id ? (
          <div key={m.id}>
            {formFields({ corp_material_no: m.corp_material_no, vehicle_type_id: m.vehicle_type_id ?? undefined, notes: m.notes ?? undefined })}
          </div>
        ) : (
          <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <Tooltip title={m.is_primary ? '대표 자재번호' : ''}>
              {m.is_primary
                ? <StarFilled style={{ color: '#faad14', fontSize: 11 }} />
                : <StarOutlined style={{ color: '#ccc', fontSize: 11 }} />}
            </Tooltip>
            <Tag color="geekblue" style={{ fontFamily: 'monospace', fontSize: 12, margin: 0 }}>
              {m.corp_material_no}
            </Tag>
            {m.vehicle_code && (
              <Tag style={{ fontSize: 11, margin: 0 }}>{m.vehicle_code}</Tag>
            )}
            {m.notes && (
              <span style={{ fontSize: 11, color: '#888' }}>{m.notes}</span>
            )}
            <Space size={2} style={{ marginLeft: 'auto' }}>
              <Button
                size="small" type="text" icon={<EditOutlined />}
                onClick={() => {
                  setEditingId(m.id)
                  setAdding(false)
                  form.setFieldsValue({
                    corp_material_no: m.corp_material_no,
                    vehicle_type_id: m.vehicle_type_id,
                    notes: m.notes,
                  })
                }}
              />
              <Popconfirm title="삭제하시겠습니까?" onConfirm={() => deleteMutation.mutate(m.id)}>
                <Button size="small" type="text" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </Space>
          </div>
        )
      )}

      {adding && formFields()}
    </div>
  )
}

function DiagramPagesSection({ nodeId }: { nodeId: number }) {
  const qc = useQueryClient()
  const { data: linked = [], isLoading } = useQuery({
    queryKey: ['node-diagrams', nodeId],
    queryFn: () => bomApi.getDiagrams(nodeId),
    staleTime: 60_000,
  })

  const unlinkMutation = useMutation({
    mutationFn: (linkId: number) => bomApi.unlinkDiagram(nodeId, linkId),
    onSuccess: () => { message.success('연결 해제됨'); qc.invalidateQueries({ queryKey: ['node-diagrams', nodeId] }) },
  })

  if (isLoading) return <div style={{ color: '#aaa', fontSize: 12 }}>로딩 중...</div>
  if (linked.length === 0) return <div style={{ color: '#bbb', fontSize: 12 }}>연결된 명칭도감 페이지 없음</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {linked.map((p: any) => (
        <div key={p.link_id} style={{ border: '1px solid #f0f0f0', borderRadius: 6, overflow: 'hidden' }}>
          <div style={{ padding: '6px 10px', background: '#fafafa', fontSize: 12, color: '#555', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {p.chapter && <Tag style={{ margin: 0 }}>{p.chapter}</Tag>}
            {p.assembly && <span style={{ fontWeight: 500 }}>{p.assembly}</span>}
            {p.match_type !== 'manual' && (
              <Tag color="default" style={{ margin: 0, fontSize: 10 }}>{p.match_type}</Tag>
            )}
            <span style={{ marginLeft: 'auto', color: '#aaa' }}>p.{p.book_page ?? p.file_no}</span>
            <Popconfirm title="연결을 해제하시겠습니까?" onConfirm={() => unlinkMutation.mutate(p.link_id)}>
              <Button size="small" type="text" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </div>
          <Image
            src={diagramPagesApi.imageUrl(p.file_no, p.vehicle)}
            alt={`명칭도감 ${p.file_no}`}
            style={{ width: '100%', display: 'block' }}
            preview={{ src: diagramPagesApi.imageUrl(p.file_no, p.vehicle) }}
          />
        </div>
      ))}
    </div>
  )
}

export default function BomNodeDetail({ node, onEdit, onDelete, onAddChild }: Props) {
  const { data: compat = [] } = useQuery({
    queryKey: ['compat', 'node', node?.id],
    queryFn: () => compatApi.byNode(node!.id),
    enabled: !!node,
  })

  if (!node) return <Empty description="노드를 선택하세요" style={{ marginTop: 60 }} />

  const categoryName = CATEGORIES.find((c) => c.code === node.category_code)?.name

  return (
    <Card
      size="small"
      title={
        <Space>
          {node.category_code && (
            <Tag color={CATEGORY_COLORS[node.category_code]}>{categoryName}</Tag>
          )}
          <span>{node.name}</span>
          {formatBomCode(node.material_no) && (
            <Tag color="blue" style={{ fontFamily: 'monospace' }}>{formatBomCode(node.material_no)}</Tag>
          )}
        </Space>
      }
      extra={
        <Space>
          <Button size="small" icon={<PlusOutlined />} onClick={onAddChild}>하위 추가</Button>
          <Button size="small" icon={<EditOutlined />} onClick={onEdit}>수정</Button>
          <Popconfirm title="하위 노드 포함 삭제됩니다. 계속하시겠습니까?" onConfirm={onDelete}>
            <Button size="small" icon={<DeleteOutlined />} danger>삭제</Button>
          </Popconfirm>
        </Space>
      }
      style={{ height: '100%', overflow: 'auto' }}
    >
      <Descriptions column={2} size="small" bordered>
        <Descriptions.Item label="단계">{node.depth + 1}단계</Descriptions.Item>
        <Descriptions.Item label="노드 타입">{node.node_type}</Descriptions.Item>
        {formatBomCode(node.material_no) && (
          <Descriptions.Item label="BOM 코드" span={2}>
            <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{formatBomCode(node.material_no)}</span>
          </Descriptions.Item>
        )}
        <Descriptions.Item label="자재내역" span={2}>{node.name}</Descriptions.Item>
        {node.name_en && (
          <Descriptions.Item label="자재내역 (영문)" span={2}>{node.name_en}</Descriptions.Item>
        )}
        {node.specification && (
          <Descriptions.Item label="규격" span={2}>{node.specification}</Descriptions.Item>
        )}
        <Descriptions.Item label="수량">{node.quantity}</Descriptions.Item>
        <Descriptions.Item label="단위">{node.unit}</Descriptions.Item>
        {node.manufacturer && <Descriptions.Item label="제작사">{node.manufacturer}</Descriptions.Item>}
        {node.manufacturer_pn && (
          <Descriptions.Item label="제작사 CPN">
            <span style={{ fontFamily: 'monospace' }}>{node.manufacturer_pn}</span>
          </Descriptions.Item>
        )}
        {(node.drawing_no || node.manufacturer_pn) && (
          <Descriptions.Item label="도면번호" span={2}>
            <span style={{ fontFamily: 'monospace' }}>{node.drawing_no || node.manufacturer_pn}</span>
          </Descriptions.Item>
        )}
        {node.weight_kg != null && <Descriptions.Item label="중량">{node.weight_kg} kg</Descriptions.Item>}
        {node.material && <Descriptions.Item label="재질">{node.material}</Descriptions.Item>}
        {node.notes && <Descriptions.Item label="비고" span={2}>{node.notes}</Descriptions.Item>}
      </Descriptions>

      <MaterialsSection node={node} />

      {compat.length > 0 && (
        <>
          <Divider style={{ margin: '12px 0' }} />
          <div style={{ fontWeight: 600, marginBottom: 8, color: '#555', fontSize: 13 }}>호환 차종</div>
          <Space wrap>
            {compat.map((c) => (
              <Tag key={c.id} color={COMPAT_COLORS[c.compat_type]}>
                {c.vehicle_name} ({COMPAT_LABELS[c.compat_type]})
              </Tag>
            ))}
          </Space>
        </>
      )}

      <Divider style={{ margin: '12px 0' }} />
      <div style={{ fontWeight: 600, marginBottom: 8, color: '#555', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
        <BookOutlined />
        명칭도감
      </div>
      <DiagramPagesSection nodeId={node.id} />
    </Card>
  )
}
