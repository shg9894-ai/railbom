import { useState } from 'react'
import {
  Table, Button, Modal, Form, Input, Space, Popconfirm, message,
  Card, Tag, Descriptions, Tooltip, Badge, Typography, Divider,
} from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  CarOutlined, ToolOutlined, CalendarOutlined,
} from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { vehicleApi } from '../api/vehicles'
import type { Vehicle } from '../types'

const { Text } = Typography

const VEH_COLORS: Record<string, string> = {
  'EMU-320': '#2ecc71',
  'EMU-260': '#3498db',
  'KTX-산천4': '#e74c3c',
  'KTX-산천2': '#9b59b6',
  'KTX-산천1': '#e67e22',
  'KTX-산천3': '#1abc9c',
  'KTX-1': '#95a5a6',
}

function parseDimensions(dim?: string) {
  if (!dim) return null
  const parts = dim.split('*').map(Number)
  if (parts.length === 3) {
    const labels = ['길이', '폭', '높이']
    return parts.map((v, i) => ({ label: labels[i], value: (v / 1000).toFixed(2) + 'm' }))
  }
  return null
}

export default function VehiclesPage() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Vehicle | null>(null)
  const [form] = Form.useForm()

  const { data: vehicles = [], isLoading } = useQuery({
    queryKey: ['vehicles'],
    queryFn: vehicleApi.list,
  })

  const saveMutation = useMutation({
    mutationFn: (values: { code: string; name: string; description?: string }) =>
      editing ? vehicleApi.update(editing.id, values) : vehicleApi.create(values),
    onSuccess: () => {
      message.success(editing ? '수정되었습니다.' : '차종이 추가되었습니다.')
      qc.invalidateQueries({ queryKey: ['vehicles'] })
      setOpen(false)
      form.resetFields()
      setEditing(null)
    },
    onError: (e: Error) => message.error(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: vehicleApi.delete,
    onSuccess: () => {
      message.success('삭제되었습니다.')
      qc.invalidateQueries({ queryKey: ['vehicles'] })
    },
    onError: (e: Error) => message.error(e.message),
  })

  const openAdd = () => { setEditing(null); form.resetFields(); setOpen(true) }
  const openEdit = (v: Vehicle) => { setEditing(v); form.setFieldsValue(v); setOpen(true) }

  const columns = [
    {
      title: '차종',
      key: 'name',
      width: 200,
      render: (_: unknown, v: Vehicle) => (
        <Space>
          <Badge color={VEH_COLORS[v.code] ?? '#aaa'} />
          <Text strong>{v.name}</Text>
          {v.sap_code && <Tag color="default" style={{ fontSize: 11 }}>{v.sap_code}</Tag>}
        </Space>
      ),
    },
    {
      title: '코드',
      dataIndex: 'code',
      key: 'code',
      width: 120,
      render: (c: string) => <Text code>{c}</Text>,
    },
    {
      title: '편성 / 량수',
      key: 'cars',
      width: 130,
      render: (_: unknown, v: Vehicle) => (
        v.total_cars != null ? (
          <Space direction="vertical" size={0}>
            <Text><CarOutlined style={{ color: '#3498db', marginRight: 4 }} />{v.formation_count}편성</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {v.active_cars}량 활성 / 총 {v.total_cars}량
            </Text>
          </Space>
        ) : <Text type="secondary">-</Text>
      ),
    },
    {
      title: '제조사 / 도입연도',
      key: 'mfr',
      width: 180,
      render: (_: unknown, v: Vehicle) => (
        v.manufacturer ? (
          <Space direction="vertical" size={0}>
            <Text><ToolOutlined style={{ marginRight: 4 }} />{v.manufacturer}</Text>
            {v.acquisition_years && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                <CalendarOutlined style={{ marginRight: 4 }} />{v.acquisition_years}
              </Text>
            )}
          </Space>
        ) : <Text type="secondary">-</Text>
      ),
    },
    {
      title: '제원 (길이 × 폭 × 높이)',
      key: 'dims',
      width: 320,
      render: (_: unknown, v: Vehicle) => {
        const dims = parseDimensions(v.dimensions)
        if (!dims) return <Text type="secondary">-</Text>
        return (
          <Tooltip title={`원본: ${v.dimensions}`}>
            <Space split={<Text type="secondary">×</Text>}>
              {dims.map(d => (
                <Tooltip key={d.label} title={d.label}>
                  <Text style={{ fontVariantNumeric: 'tabular-nums' }}>{d.value}</Text>
                </Tooltip>
              ))}
            </Space>
            {v.weight_ton != null && (
              <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                평균 {v.weight_ton}t/량
              </Text>
            )}
          </Tooltip>
        )
      },
    },
    {
      title: '설명',
      dataIndex: 'description',
      key: 'description',
      width: 280,
      render: (d?: string) => d ? <Text type="secondary" style={{ fontSize: 12 }}>{d}</Text> : <Text type="secondary">-</Text>,
    },
    {
      title: '작업',
      key: 'actions',
      width: 90,
      render: (_: unknown, v: Vehicle) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(v)} />
          <Popconfirm title="삭제하시겠습니까?" onConfirm={() => deleteMutation.mutate(v.id)}>
            <Button size="small" icon={<DeleteOutlined />} danger />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  // 요약 통계
  const totalCars   = vehicles.reduce((s, v) => s + (v.total_cars ?? 0), 0)
  const activeCars  = vehicles.reduce((s, v) => s + (v.active_cars ?? 0), 0)
  const totalForms  = vehicles.reduce((s, v) => s + (v.formation_count ?? 0), 0)

  return (
    <>
      {/* 상단 통계 카드 */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { label: '차종', value: vehicles.length, unit: '종', color: '#2c3e50' },
          { label: '총 편성', value: totalForms, unit: '편성', color: '#2980b9' },
          { label: '총 량수', value: totalCars.toLocaleString(), unit: '량', color: '#27ae60' },
          { label: '활성 량수', value: activeCars.toLocaleString(), unit: '량', color: '#e67e22' },
        ].map(s => (
          <Card key={s.label} size="small" style={{ flex: '1 1 120px', minWidth: 110, borderTop: `3px solid ${s.color}` }}>
            <div style={{ fontSize: 11, color: '#888' }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color, lineHeight: 1.2 }}>
              {s.value}<span style={{ fontSize: 12, fontWeight: 400, marginLeft: 2 }}>{s.unit}</span>
            </div>
          </Card>
        ))}
      </div>

      <Card
        title="차종 관리"
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>차종 추가</Button>}
      >
        <Table
          dataSource={vehicles}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          pagination={false}
          size="middle"
          scroll={{ x: 900 }}
          expandable={{
            expandedRowRender: (v: Vehicle) => (
              <Descriptions size="small" column={3} bordered>
                <Descriptions.Item label="SAP 설비번호">{v.sap_code ?? '-'}</Descriptions.Item>
                <Descriptions.Item label="제조사">{v.manufacturer ?? '-'}</Descriptions.Item>
                <Descriptions.Item label="도입연도">{v.acquisition_years ?? '-'}</Descriptions.Item>
                <Descriptions.Item label="총 량수">{v.total_cars != null ? `${v.total_cars}량` : '-'}</Descriptions.Item>
                <Descriptions.Item label="활성 량수">{v.active_cars != null ? `${v.active_cars}량` : '-'}</Descriptions.Item>
                <Descriptions.Item label="편성 수">{v.formation_count != null ? `${v.formation_count}편성` : '-'}</Descriptions.Item>
                <Descriptions.Item label="차량 제원 (L×W×H)">{v.dimensions ?? '-'}</Descriptions.Item>
                <Descriptions.Item label="평균 중량">{v.weight_ton != null ? `${v.weight_ton}t/량` : '-'}</Descriptions.Item>
                <Descriptions.Item label="설명">{v.description ?? '-'}</Descriptions.Item>
              </Descriptions>
            ),
            rowExpandable: () => true,
          }}
        />
      </Card>

      <Modal
        title={editing ? '차종 수정' : '차종 추가'}
        open={open}
        onOk={() => form.submit()}
        onCancel={() => { setOpen(false); setEditing(null) }}
        confirmLoading={saveMutation.isPending}
      >
        <Divider style={{ margin: '8px 0 16px' }} />
        <Form form={form} layout="vertical" onFinish={(v) => saveMutation.mutate(v)}>
          <Form.Item name="code" label="차종 코드" rules={[{ required: true }]}>
            <Input placeholder="예: KTX-BLUE, EMU-250" />
          </Form.Item>
          <Form.Item name="name" label="차종명" rules={[{ required: true }]}>
            <Input placeholder="예: KTX-청룡, EMU-250" />
          </Form.Item>
          <Form.Item name="description" label="설명">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
        <Text type="secondary" style={{ fontSize: 12 }}>
          ※ 편성/량수/제원 등 차적 정보는 SAP 차적 데이터에서 자동 갱신됩니다.
        </Text>
      </Modal>
    </>
  )
}
