import { useState } from 'react'
import {
  Button, Modal, Form, Input, Checkbox, Divider, Tag, Popconfirm,
  Typography, Space, InputNumber, message, Spin,
} from 'antd'
import { PlusOutlined, SearchOutlined, DeleteOutlined, ToolOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { bomApi } from '../../api/bom'
import { repairKitApi } from '../../api/repairKits'
import type { BomNode } from '../../types'
import { formatBomCode } from '../../types'

const { Text } = Typography

interface Props {
  node: BomNode
  vehicleTypeId: number
}

export default function RepairKitSection({ node, vehicleTypeId }: Props) {
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)

  const { data: kits = [], isLoading } = useQuery({
    queryKey: ['repair-kits', node.id],
    queryFn: () => repairKitApi.getByParent(node.id),
  })

  const deleteMutation = useMutation({
    mutationFn: repairKitApi.delete,
    onSuccess: () => {
      message.success('수리키트 삭제됨')
      qc.invalidateQueries({ queryKey: ['repair-kits', node.id] })
    },
  })

  const removeItemMutation = useMutation({
    mutationFn: ({ kitId, itemId }: { kitId: number; itemId: number }) =>
      repairKitApi.removeItem(kitId, itemId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['repair-kits', node.id] }),
  })

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Text strong style={{ fontSize: 13 }}>
          <ToolOutlined style={{ marginRight: 6, color: '#fa8c16' }} />
          수리키트
        </Text>
        <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
          수리키트 추가
        </Button>
      </div>

      {isLoading ? <Spin size="small" /> : kits.length === 0 ? (
        <Text type="secondary" style={{ fontSize: 12 }}>등록된 수리키트 없음</Text>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {kits.map(kit => (
            <div key={kit.id} style={{
              border: '1px solid #ffd591', borderRadius: 6,
              background: '#fffbe6', padding: '8px 10px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Space size={6}>
                  <Text style={{ fontFamily: 'monospace', fontSize: 12, color: '#d46b08', fontWeight: 700 }}>
                    {kit.material_no}
                  </Text>
                  <Text style={{ fontSize: 12, fontWeight: 600 }}>{kit.name}</Text>
                </Space>
                <Popconfirm title="수리키트를 삭제하시겠습니까?" onConfirm={() => deleteMutation.mutate(kit.id)}>
                  <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {kit.items.map(item => (
                  <div key={item.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    fontSize: 11, padding: '2px 4px', background: '#fff',
                    borderRadius: 4, border: '1px solid #ffe7ba',
                  }}>
                    <Space size={4}>
                      <Tag style={{ fontSize: 10, margin: 0, fontFamily: 'monospace' }}>
                        {formatBomCode(item.material_no)}
                      </Tag>
                      <span>{item.name}</span>
                      {item.quantity !== 1 && (
                        <Text type="secondary" style={{ fontSize: 10 }}>×{item.quantity}</Text>
                      )}
                    </Space>
                    <Button
                      size="small" type="text" danger
                      icon={<DeleteOutlined style={{ fontSize: 10 }} />}
                      onClick={() => removeItemMutation.mutate({ kitId: kit.id, itemId: item.id })}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {createOpen && (
        <RepairKitCreateModal
          node={node}
          vehicleTypeId={vehicleTypeId}
          onClose={() => setCreateOpen(false)}
          onSuccess={() => {
            setCreateOpen(false)
            qc.invalidateQueries({ queryKey: ['repair-kits', node.id] })
          }}
        />
      )}
    </div>
  )
}

function RepairKitCreateModal({
  node, vehicleTypeId, onClose, onSuccess,
}: {
  node: BomNode
  vehicleTypeId: number
  onClose: () => void
  onSuccess: () => void
}) {
  const [form] = Form.useForm()
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [extraSearch, setExtraSearch] = useState('')
  const [extraResults, setExtraResults] = useState<BomNode[]>([])
  const [extraSearching, setExtraSearching] = useState(false)
  const [quantities, setQuantities] = useState<Record<number, number>>({})

  // 같은 부모의 형제 노드들
  const { data: siblings = [] } = useQuery({
    queryKey: ['bom-children', node.parent_id],
    queryFn: () => node.parent_id ? bomApi.getChildrenLazy(node.parent_id) : Promise.resolve([]),
    enabled: !!node.parent_id,
  })

  // 현재 노드의 자식들
  const { data: children = [] } = useQuery({
    queryKey: ['bom-children', node.id],
    queryFn: () => bomApi.getChildrenLazy(node.id),
  })

  const createMutation = useMutation({
    mutationFn: repairKitApi.create,
    onSuccess,
    onError: (e: Error) => message.error(e.message),
  })

  const handleExtraSearch = async () => {
    if (!extraSearch.trim()) return
    setExtraSearching(true)
    try {
      const results = await bomApi.search(vehicleTypeId, extraSearch.trim())
      setExtraResults(results.filter(r => r.id !== node.id && r.node_type !== 'repair_kit'))
    } finally {
      setExtraSearching(false)
    }
  }

  const toggleId = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleCreate = async () => {
    const values = await form.validateFields()
    if (selectedIds.size === 0) {
      message.warning('구성 부품을 1개 이상 선택하세요.')
      return
    }
    createMutation.mutate({
      parent_id: node.id,
      name: values.name,
      ref_node_ids: Array.from(selectedIds),
      quantities: Object.keys(quantities).length > 0 ? quantities : undefined,
    })
  }

  const allNodes = [
    ...children.filter(n => n.node_type !== 'repair_kit'),
    ...siblings.filter(n => n.id !== node.id && n.node_type !== 'repair_kit'),
    ...extraResults.filter(n => !children.find(c => c.id === n.id) && !siblings.find(s => s.id === n.id)),
  ]

  return (
    <Modal
      title={`수리키트 추가 — ${formatBomCode(node.material_no)}`}
      open
      onOk={handleCreate}
      onCancel={onClose}
      confirmLoading={createMutation.isPending}
      width={560}
      style={{ maxWidth: 'calc(100vw - 32px)' }}
      okText="수리키트 생성"
    >
      <Form form={form} layout="vertical">
        <Form.Item name="name" label="수리키트 명칭" rules={[{ required: true, message: '명칭을 입력하세요' }]}>
          <Input placeholder="예: 베어링 수리키트" />
        </Form.Item>
      </Form>

      <Divider style={{ margin: '12px 0' }}>구성 부품 선택</Divider>

      {/* 하위/형제 부품 목록 */}
      <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #f0f0f0', borderRadius: 6, padding: 8, marginBottom: 12 }}>
        {children.length === 0 && siblings.length === 0 ? (
          <Text type="secondary" style={{ fontSize: 12 }}>하위/형제 부품 없음</Text>
        ) : (
          <>
            {children.filter(n => n.node_type !== 'repair_kit').length > 0 && (
              <>
                <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>하위 부품</Text>
                {children.filter(n => n.node_type !== 'repair_kit').map(n => (
                  <NodeCheckRow key={n.id} node={n} checked={selectedIds.has(n.id)} onToggle={toggleId}
                    quantity={quantities[n.id]} onQuantityChange={q => setQuantities(prev => ({ ...prev, [n.id]: q }))} />
                ))}
              </>
            )}
            {siblings.filter(n => n.id !== node.id && n.node_type !== 'repair_kit').length > 0 && (
              <>
                <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 8, marginBottom: 4 }}>형제 부품 (같은 부모)</Text>
                {siblings.filter(n => n.id !== node.id && n.node_type !== 'repair_kit').map(n => (
                  <NodeCheckRow key={n.id} node={n} checked={selectedIds.has(n.id)} onToggle={toggleId}
                    quantity={quantities[n.id]} onQuantityChange={q => setQuantities(prev => ({ ...prev, [n.id]: q }))} />
                ))}
              </>
            )}
          </>
        )}
      </div>

      {/* 다른 노드 검색 */}
      <Divider style={{ margin: '8px 0' }}>다른 부품 추가</Divider>
      <Space.Compact style={{ width: '100%', marginBottom: 8 }}>
        <Input
          prefix={<SearchOutlined />}
          placeholder="부품명 또는 BOM 코드 검색"
          value={extraSearch}
          onChange={e => setExtraSearch(e.target.value)}
          onPressEnter={handleExtraSearch}
        />
        <Button onClick={handleExtraSearch} loading={extraSearching}>검색</Button>
      </Space.Compact>
      {extraResults.length > 0 && (
        <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #f0f0f0', borderRadius: 6, padding: 8 }}>
          {extraResults.map(n => (
            <NodeCheckRow key={n.id} node={n} checked={selectedIds.has(n.id)} onToggle={toggleId}
              quantity={quantities[n.id]} onQuantityChange={q => setQuantities(prev => ({ ...prev, [n.id]: q }))}
              selectedIds={selectedIds} quantities={quantities}
              setQuantities={setQuantities} setSelectedIds={setSelectedIds} />
          ))}
        </div>
      )}

      {selectedIds.size > 0 && (
        <div style={{ marginTop: 8, color: '#1677ff', fontSize: 12 }}>
          {selectedIds.size}개 선택됨
        </div>
      )}
    </Modal>
  )
}

function NodeCheckRow({
  node, checked, onToggle, quantity, onQuantityChange, indent = 0,
  selectedIds, quantities, setQuantities, setSelectedIds,
}: {
  node: BomNode
  checked: boolean
  onToggle: (id: number) => void
  quantity?: number
  onQuantityChange: (q: number) => void
  indent?: number
  selectedIds?: Set<number>
  quantities?: Record<number, number>
  setQuantities?: React.Dispatch<React.SetStateAction<Record<number, number>>>
  setSelectedIds?: React.Dispatch<React.SetStateAction<Set<number>>>
}) {
  const [expanded, setExpanded] = useState(false)
  const { data: children = [], isFetching } = useQuery({
    queryKey: ['bom-children', node.id],
    queryFn: () => bomApi.getChildrenLazy(node.id),
    enabled: expanded && !!node.has_children,
    staleTime: 300_000,
  })
  const hasChildren = !!node.has_children

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', paddingLeft: indent * 16 }}>
        {hasChildren ? (
          <span
            style={{ cursor: 'pointer', fontSize: 10, color: '#666', width: 12, flexShrink: 0 }}
            onClick={() => setExpanded(v => !v)}
          >
            {isFetching ? '…' : expanded ? '▾' : '▸'}
          </span>
        ) : (
          <span style={{ width: 12, flexShrink: 0 }} />
        )}
        <Checkbox checked={checked} onChange={() => onToggle(node.id)} />
        <Tag style={{ fontSize: 10, margin: 0, fontFamily: 'monospace' }}>{formatBomCode(node.material_no)}</Tag>
        <span style={{ fontSize: 12, flex: 1 }}>{node.name}</span>
        {checked && (
          <InputNumber
            size="small" min={1} value={quantity ?? 1}
            onChange={v => onQuantityChange(v ?? 1)}
            style={{ width: 60 }}
            addonAfter="개"
          />
        )}
      </div>
      {expanded && children.filter(c => c.node_type !== 'repair_kit').map(c => (
        <NodeCheckRow
          key={c.id}
          node={c}
          checked={selectedIds?.has(c.id) ?? false}
          onToggle={id => {
            if (!setSelectedIds) return
            setSelectedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
          }}
          quantity={quantities?.[c.id]}
          onQuantityChange={q => setQuantities?.(prev => ({ ...prev, [c.id]: q }))}
          indent={indent + 1}
          selectedIds={selectedIds}
          quantities={quantities}
          setQuantities={setQuantities}
          setSelectedIds={setSelectedIds}
        />
      ))}
    </>
  )
}
