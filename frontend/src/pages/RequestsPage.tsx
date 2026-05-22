import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Table, Tabs, Button, Modal, Input, Tag, Space, Typography, message } from 'antd'
import { CheckOutlined, CloseOutlined } from '@ant-design/icons'
import { changeRequestsApi } from '../api/changeRequests'
import type { ChangeRequest } from '../api/changeRequests'
import { diagramPageRequestsApi } from '../api/diagramPageRequests'
import type { DiagramPageRequest } from '../api/diagramPageRequests'

const { Text } = Typography
const { TextArea } = Input

const TYPE_LABELS: Record<string, string> = {
  corp_material_no_add: '공사 자재번호 추가',
  corp_material_no_edit: '공사 자재번호 수정',
  corp_material_no_delete: '공사 자재번호 삭제',
  bom_code_add: 'BOM 코드 추가',
  bom_code_edit: 'BOM 코드 수정',
  bom_code_delete: 'BOM 코드 삭제',
  photo_add: '사진 추가',
  photo_delete: '사진 삭제',
}

const STATUS_TAG: Record<string, { color: string; text: string }> = {
  pending: { color: 'orange', text: '대기중' },
  approved: { color: 'green', text: '승인됨' },
  rejected: { color: 'red', text: '반려됨' },
}

function ReviewModal({
  open, request, action, onCancel, onOk,
}: {
  open: boolean
  request: ChangeRequest | null
  action: 'approve' | 'reject'
  onCancel: () => void
  onOk: (note: string) => void
}) {
  const [note, setNote] = useState('')

  const handleOk = () => {
    onOk(note)
    setNote('')
  }

  return (
    <Modal
      open={open}
      title={action === 'approve' ? '요청 승인' : '요청 반려'}
      okText={action === 'approve' ? '승인' : '반려'}
      cancelText="취소"
      okButtonProps={{ danger: action === 'reject' }}
      onCancel={() => { setNote(''); onCancel() }}
      onOk={handleOk}
    >
      {request && (
        <div style={{ marginBottom: 12 }}>
          <Text strong>{request.vehicle_name}</Text>
          {' — '}
          <Text>{request.node_name}</Text>
          <br />
          <Text type="secondary">{TYPE_LABELS[request.request_type] ?? request.request_type}</Text>
          {request.requested_value && (
            <>
              <br />
              <Text>요청값: <Text code>{request.requested_value}</Text></Text>
            </>
          )}
        </div>
      )}
      <TextArea
        rows={3}
        placeholder="검토 의견 (선택)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
    </Modal>
  )
}

function RequestTable({ statusFilter }: { statusFilter?: string }) {
  const qc = useQueryClient()
  const [modal, setModal] = useState<{ action: 'approve' | 'reject'; request: ChangeRequest } | null>(null)

  const { data = [], isLoading } = useQuery({
    queryKey: ['change-requests', statusFilter],
    queryFn: () => changeRequestsApi.list(statusFilter),
    staleTime: 10_000,
  })

  const approveMut = useMutation({
    mutationFn: ({ id, note }: { id: number; note: string }) =>
      changeRequestsApi.approve(id, note),
    onSuccess: () => {
      message.success('승인되었습니다')
      qc.invalidateQueries({ queryKey: ['change-requests'] })
    },
    onError: () => message.error('처리 중 오류가 발생했습니다'),
  })

  const rejectMut = useMutation({
    mutationFn: ({ id, note }: { id: number; note: string }) =>
      changeRequestsApi.reject(id, note),
    onSuccess: () => {
      message.success('반려되었습니다')
      qc.invalidateQueries({ queryKey: ['change-requests'] })
    },
    onError: () => message.error('처리 중 오류가 발생했습니다'),
  })

  const handleReview = (note: string) => {
    if (!modal) return
    const { action, request } = modal
    if (action === 'approve') approveMut.mutate({ id: request.id, note })
    else rejectMut.mutate({ id: request.id, note })
    setModal(null)
  }

  const columns = [
    {
      title: '차종',
      dataIndex: 'vehicle_name',
      width: 100,
      render: (v: string | null) => v ?? '—',
    },
    {
      title: '노드명',
      dataIndex: 'node_name',
      width: 200,
    },
    {
      title: '요청 유형',
      dataIndex: 'request_type',
      width: 160,
      render: (v: string) => TYPE_LABELS[v] ?? v,
    },
    {
      title: '현재값',
      dataIndex: 'current_value',
      width: 140,
      render: (v: string | null) => v ? <Text code>{v}</Text> : <Text type="secondary">—</Text>,
    },
    {
      title: '요청값',
      dataIndex: 'requested_value',
      width: 140,
      render: (v: string | null) => v ? <Text code style={{ color: '#1677ff' }}>{v}</Text> : <Text type="secondary">—</Text>,
    },
    {
      title: '요청자',
      dataIndex: 'requester_name',
      width: 100,
      render: (v: string | null) => v ?? '—',
    },
    {
      title: '요청 의견',
      dataIndex: 'requester_note',
      ellipsis: true,
      render: (v: string | null) => v ?? '—',
    },
    {
      title: '상태',
      dataIndex: 'status',
      width: 80,
      render: (v: string) => {
        const s = STATUS_TAG[v] ?? { color: 'default', text: v }
        return <Tag color={s.color}>{s.text}</Tag>
      },
    },
    {
      title: '요청일시',
      dataIndex: 'created_at',
      width: 140,
      render: (v: string) => v?.replace('T', ' ').slice(0, 16),
    },
    {
      title: '처리',
      width: 120,
      render: (_: unknown, record: ChangeRequest) =>
        record.status === 'pending' ? (
          <Space>
            <Button
              size="small"
              type="primary"
              icon={<CheckOutlined />}
              onClick={() => setModal({ action: 'approve', request: record })}
            >
              승인
            </Button>
            <Button
              size="small"
              danger
              icon={<CloseOutlined />}
              onClick={() => setModal({ action: 'reject', request: record })}
            >
              반려
            </Button>
          </Space>
        ) : (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.reviewer_note ?? '—'}
          </Text>
        ),
    },
  ]

  return (
    <>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={isLoading}
        size="small"
        pagination={{ pageSize: 20 }}
        scroll={{ x: 1100 }}
      />
      <ReviewModal
        open={modal !== null}
        request={modal?.request ?? null}
        action={modal?.action ?? 'approve'}
        onCancel={() => setModal(null)}
        onOk={handleReview}
      />
    </>
  )
}

const DIAGRAM_REQ_TYPE_LABELS: Record<string, string> = {
  assembly_add:  '부품명 추가',
  assembly_edit: '부품명 수정',
  page_delete:   '페이지 삭제 요청',
  other:         '기타',
}

function DiagramRequestTable({ statusFilter }: { statusFilter?: string }) {
  const qc = useQueryClient()
  const [modal, setModal] = useState<{ action: 'approve' | 'reject'; request: DiagramPageRequest } | null>(null)
  const [note, setNote] = useState('')

  const { data = [], isLoading } = useQuery({
    queryKey: ['diagram-page-requests', statusFilter],
    queryFn: () => diagramPageRequestsApi.list(statusFilter),
    staleTime: 10_000,
  })

  const approveMut = useMutation({
    mutationFn: ({ id, n }: { id: number; n: string }) => diagramPageRequestsApi.approve(id, n),
    onSuccess: () => { message.success('승인되었습니다'); qc.invalidateQueries({ queryKey: ['diagram-page-requests'] }) },
    onError: () => message.error('처리 중 오류가 발생했습니다'),
  })
  const rejectMut = useMutation({
    mutationFn: ({ id, n }: { id: number; n: string }) => diagramPageRequestsApi.reject(id, n),
    onSuccess: () => { message.success('반려되었습니다'); qc.invalidateQueries({ queryKey: ['diagram-page-requests'] }) },
    onError: () => message.error('처리 중 오류가 발생했습니다'),
  })

  const handleReview = () => {
    if (!modal) return
    const { action, request } = modal
    if (action === 'approve') approveMut.mutate({ id: request.id, n: note })
    else rejectMut.mutate({ id: request.id, n: note })
    setModal(null)
    setNote('')
  }

  const columns = [
    { title: '차종', dataIndex: 'vehicle', width: 100 },
    { title: '페이지', dataIndex: 'file_no', width: 70, render: (v: number) => `${v}p` },
    { title: '현재 부품명', dataIndex: 'assembly', width: 180, render: (v: string | null) => v ?? <Text type="secondary">—</Text> },
    { title: '요청 유형', dataIndex: 'request_type', width: 130, render: (v: string) => DIAGRAM_REQ_TYPE_LABELS[v] ?? v },
    { title: '수정 요청값', dataIndex: 'requested_value', width: 180, render: (v: string | null) => v ? <Text code style={{ color: '#1677ff' }}>{v}</Text> : <Text type="secondary">—</Text> },
    { title: '요청자', dataIndex: 'requester_name', width: 90, render: (v: string | null) => v ?? '—' },
    { title: '요청 내용', dataIndex: 'requester_note', ellipsis: true, render: (v: string | null) => v ?? '—' },
    { title: '상태', dataIndex: 'status', width: 80, render: (v: string) => { const s = STATUS_TAG[v] ?? { color: 'default', text: v }; return <Tag color={s.color}>{s.text}</Tag> } },
    { title: '요청일시', dataIndex: 'created_at', width: 130, render: (v: string) => v?.replace('T', ' ').slice(0, 16) },
    { title: '처리일시', dataIndex: 'reviewed_at', width: 130, render: (v: string | null) => v ? v.replace('T', ' ').slice(0, 16) : <Text type="secondary">—</Text> },
    { title: '검토의견', dataIndex: 'reviewer_note', width: 140, ellipsis: true, render: (v: string | null) => v ?? <Text type="secondary">—</Text> },
    {
      title: '처리', width: 120,
      render: (_: unknown, record: DiagramPageRequest) =>
        record.status === 'pending' ? (
          <Space>
            <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => setModal({ action: 'approve', request: record })}>승인</Button>
            <Button size="small" danger icon={<CloseOutlined />} onClick={() => setModal({ action: 'reject', request: record })}>반려</Button>
          </Space>
        ) : null,
    },
  ]

  return (
    <>
      <Table rowKey="id" columns={columns} dataSource={data} loading={isLoading} size="small" pagination={{ pageSize: 20 }} scroll={{ x: 1100 }} />
      <Modal
        open={modal !== null}
        title={modal?.action === 'approve' ? '요청 승인' : '요청 반려'}
        okText={modal?.action === 'approve' ? '승인' : '반려'}
        cancelText="취소"
        okButtonProps={{ danger: modal?.action === 'reject' }}
        onCancel={() => { setModal(null); setNote('') }}
        onOk={handleReview}
      >
        {modal && (
          <div style={{ marginBottom: 12 }}>
            <Text strong>{modal.request.vehicle}</Text> {modal.request.file_no}p
            {' — '}<Text>{DIAGRAM_REQ_TYPE_LABELS[modal.request.request_type] ?? modal.request.request_type}</Text>
            {modal.request.requested_value && <><br /><Text>요청값: <Text code>{modal.request.requested_value}</Text></Text></>}
          </div>
        )}
        <Input.TextArea rows={3} placeholder="검토 의견 (선택)" value={note} onChange={(e) => setNote(e.target.value)} />
      </Modal>
    </>
  )
}

export default function RequestsPage() {
  const { data: pending = [] } = useQuery({
    queryKey: ['change-requests', 'pending'],
    queryFn: () => changeRequestsApi.list('pending'),
    staleTime: 10_000,
  })

  const { data: diagPending = [] } = useQuery({
    queryKey: ['diagram-page-requests', 'pending'],
    queryFn: () => diagramPageRequestsApi.list('pending'),
    staleTime: 10_000,
  })

  return (
    <div>
      <Typography.Title level={4} style={{ marginBottom: 16 }}>
        데이터 수정 승인
      </Typography.Title>
      <Tabs
        defaultActiveKey="pending"
        items={[
          {
            key: 'pending',
            label: (
              <span>
                BOM 대기중
                {pending.length > 0 && <Tag color="orange" style={{ marginLeft: 6 }}>{pending.length}</Tag>}
              </span>
            ),
            children: <RequestTable statusFilter="pending" />,
          },
          {
            key: 'diagram-pending',
            label: (
              <span>
                명칭도감 대기중
                {diagPending.length > 0 && <Tag color="orange" style={{ marginLeft: 6 }}>{diagPending.length}</Tag>}
              </span>
            ),
            children: <DiagramRequestTable statusFilter="pending" />,
          },
          {
            key: 'approved',
            label: '승인됨',
            children: <RequestTable statusFilter="approved" />,
          },
          {
            key: 'rejected',
            label: '반려됨',
            children: <RequestTable statusFilter="rejected" />,
          },
          {
            key: 'all',
            label: '전체',
            children: <RequestTable />,
          },
        ]}
      />
    </div>
  )
}
