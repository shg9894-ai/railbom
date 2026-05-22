import { useState } from 'react'
import {
  Card, Select, Table, Button, Space, Popconfirm, Modal, Form,
  InputNumber, message, Tag, Typography, Badge, Tooltip,
} from 'antd'
import { PlusOutlined, CalendarOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { vehicleApi } from '../api/vehicles'
import { formationApi } from '../api/formations'
import type { Formation, Vehicle } from '../types'

const { Text } = Typography

const STATUS_LABELS: Record<string, string> = {
  active: '운행중',
  maintenance: '정비중',
  retired: '퇴역',
}
const STATUS_COLOR: Record<string, string> = {
  active: 'green',
  maintenance: 'orange',
  retired: 'red',
}

const VEH_COLORS: Record<string, string> = {
  'EMU-320': '#2ecc71',
  'EMU-260': '#3498db',
  'KTX-산천4': '#e74c3c',
  'KTX-산천2': '#9b59b6',
  'KTX-산천1': '#e67e22',
  'KTX-산천3': '#1abc9c',
  'KTX-1': '#95a5a6',
}

export default function FormationsPage() {
  const qc = useQueryClient()
  const [vehicleId, setVehicleId] = useState<number | null>(null)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkForm] = Form.useForm()

  const { data: vehicles = [] } = useQuery({ queryKey: ['vehicles'], queryFn: vehicleApi.list })
  const { data: formations = [], isLoading } = useQuery({
    queryKey: ['formations', vehicleId],
    queryFn: () => formationApi.list(vehicleId!),
    enabled: !!vehicleId,
  })

  const selectedVehicle = vehicles.find((v) => v.id === vehicleId)

  const bulkMutation = useMutation({
    mutationFn: ({ count }: { count: number }) => formationApi.createBulk(vehicleId!, count),
    onSuccess: (data) => {
      message.success(`${data.length}개 편성이 추가되었습니다.`)
      qc.invalidateQueries({ queryKey: ['formations', vehicleId] })
      setBulkOpen(false)
    },
    onError: (e: Error) => message.error(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: formationApi.delete,
    onSuccess: () => {
      message.success('편성이 삭제되었습니다.')
      qc.invalidateQueries({ queryKey: ['formations', vehicleId] })
    },
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      formationApi.update(id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['formations', vehicleId] }),
  })

  const statusCounts = formations.reduce(
    (acc, f) => { acc[f.status] = (acc[f.status] ?? 0) + 1; return acc },
    {} as Record<string, number>
  )

  const acqDates = formations.filter((f) => f.acquisition_date).map((f) => f.acquisition_date!)
  const minAcq   = acqDates.length ? acqDates.reduce((a, b) => a < b ? a : b) : null
  const maxAcq   = acqDates.length ? acqDates.reduce((a, b) => a > b ? a : b) : null

  const columns = [
    {
      title: '편성',
      key: 'formation_no',
      width: 80,
      render: (_: unknown, f: Formation) => (
        <Text strong style={{ fontVariantNumeric: 'tabular-nums' }}>
          {f.formation_no}편성
        </Text>
      ),
    },
    {
      title: 'SAP 코드',
      dataIndex: 'formation_code',
      key: 'formation_code',
      width: 110,
      render: (c?: string) =>
        c ? <Text code style={{ fontSize: 12 }}>{c}</Text>
          : <Text type="secondary" style={{ fontSize: 12 }}>미등록</Text>,
    },
    {
      title: '량수',
      dataIndex: 'car_count',
      key: 'car_count',
      width: 65,
      align: 'center' as const,
      render: (n?: number) =>
        n != null ? <Text>{n}량</Text> : <Text type="secondary">-</Text>,
    },
    {
      title: '취득일',
      dataIndex: 'acquisition_date',
      key: 'acquisition_date',
      width: 115,
      render: (d?: string) =>
        d ? (
          <Text style={{ fontSize: 12 }}>
            <CalendarOutlined style={{ marginRight: 4, color: '#888' }} />
            {d}
          </Text>
        ) : <Text type="secondary">-</Text>,
    },
    {
      title: 'SAP 편성명',
      dataIndex: 'sap_description',
      key: 'sap_description',
      render: (d?: string) =>
        d ? <Text type="secondary" style={{ fontSize: 12 }}>{d}</Text>
          : <Text type="secondary">-</Text>,
    },
    {
      title: '상태',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (s: string, r: Formation) => (
        <Select
          value={s}
          size="small"
          style={{ width: 90 }}
          onChange={(val) => statusMutation.mutate({ id: r.id, status: val })}
          options={Object.entries(STATUS_LABELS).map(([k, v]) => ({ value: k, label: v }))}
        />
      ),
    },
    { title: '비고', dataIndex: 'notes', key: 'notes', render: (n?: string) => n ?? '' },
    {
      title: '',
      key: 'del',
      width: 55,
      render: (_: unknown, r: Formation) => (
        <Popconfirm title="삭제하시겠습니까?" onConfirm={() => deleteMutation.mutate(r.id)}>
          <Button size="small" danger type="text">삭제</Button>
        </Popconfirm>
      ),
    },
  ]

  return (
    <>
      {/* 차종 선택 */}
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap>
          <Text strong>차종 선택</Text>
          <Select
            placeholder="차종을 선택하세요"
            style={{ width: 220 }}
            value={vehicleId}
            options={vehicles.map((v: Vehicle) => ({
              value: v.id,
              label: (
                <Space>
                  <Badge color={VEH_COLORS[v.code] ?? '#aaa'} />
                  {v.name}
                  {v.formation_count != null && (
                    <Text type="secondary" style={{ fontSize: 11 }}>({v.formation_count}편성)</Text>
                  )}
                </Space>
              ),
            }))}
            onChange={(v) => setVehicleId(v)}
          />
          {selectedVehicle && (
            <Space split={<Text type="secondary">·</Text>}>
              {selectedVehicle.total_cars != null && (
                <Text type="secondary" style={{ fontSize: 12 }}>총 {selectedVehicle.total_cars}량</Text>
              )}
              {selectedVehicle.manufacturer && (
                <Text type="secondary" style={{ fontSize: 12 }}>{selectedVehicle.manufacturer}</Text>
              )}
              {selectedVehicle.acquisition_years && (
                <Text type="secondary" style={{ fontSize: 12 }}>{selectedVehicle.acquisition_years} 도입</Text>
              )}
              {selectedVehicle.dimensions && (
                <Text type="secondary" style={{ fontSize: 12 }}>제원 {selectedVehicle.dimensions}</Text>
              )}
            </Space>
          )}
        </Space>
      </Card>

      <Card
        title={
          vehicleId ? (
            <Space wrap>
              <span>편성 목록</span>
              {Object.entries(statusCounts).map(([s, cnt]) => (
                <Tag key={s} color={STATUS_COLOR[s]}>{STATUS_LABELS[s]} {cnt}</Tag>
              ))}
              {minAcq && maxAcq && (
                <Tooltip title={`최초 취득: ${minAcq} / 최근 취득: ${maxAcq}`}>
                  <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
                    취득 {minAcq.slice(0, 4)}~{maxAcq.slice(0, 4)}
                  </Text>
                </Tooltip>
              )}
            </Space>
          ) : '편성 관리'
        }
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            disabled={!vehicleId}
            onClick={() => setBulkOpen(true)}
          >
            편성 추가
          </Button>
        }
      >
        {vehicleId ? (
          <Table
            dataSource={formations}
            columns={columns}
            rowKey="id"
            loading={isLoading}
            pagination={false}
            size="small"
            scroll={{ y: 520 }}
            summary={() => (
              <Table.Summary fixed>
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={8}>
                    총 <strong>{formations.length}</strong>편성 ·{' '}
                    <strong>{formations.reduce((s, f) => s + (f.car_count ?? 0), 0)}</strong>량
                  </Table.Summary.Cell>
                </Table.Summary.Row>
              </Table.Summary>
            )}
          />
        ) : (
          <div style={{ textAlign: 'center', color: '#aaa', padding: 40 }}>
            위에서 차종을 선택하세요
          </div>
        )}
      </Card>

      <Modal
        title="편성 추가"
        open={bulkOpen}
        onOk={() => bulkForm.submit()}
        onCancel={() => setBulkOpen(false)}
        confirmLoading={bulkMutation.isPending}
      >
        <Form form={bulkForm} layout="vertical" onFinish={(v) => bulkMutation.mutate(v)}>
          <Form.Item name="count" label="추가할 편성 수" rules={[{ required: true }]}>
            <InputNumber min={1} max={99} style={{ width: '100%' }} placeholder="예: 2" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
