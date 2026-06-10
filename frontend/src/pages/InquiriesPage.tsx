import { useState } from 'react'
import { Card, Table, Tag, Typography, Modal, Input, Select, Space, Button, message, Image, Empty } from 'antd'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { inquiriesApi, type Inquiry } from '../api/inquiries'
import { PLANT_NAMES } from '../types'

const { Title, Text, Paragraph } = Typography
const { TextArea } = Input

const STATUS_LABEL: Record<string, { color: string; text: string }> = {
  pending:     { color: 'orange', text: '대기' },
  in_progress: { color: 'blue',   text: '처리중' },
  resolved:    { color: 'green',  text: '해결' },
  closed:      { color: 'default', text: '종료' },
}

interface Props { role?: string }

export default function InquiriesPage({ role }: Props) {
  const isAdmin = role === 'admin'
  // 기본 필터는 모두 전체 (관리자도 마찬가지 — 드롭다운으로 좁히고 싶을 때만)
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined)
  const [selected, setSelected] = useState<Inquiry | null>(null)
  const [reply, setReply] = useState('')
  const [newStatus, setNewStatus] = useState<string>('resolved')
  const qc = useQueryClient()

  const { data: list = [], isLoading } = useQuery({
    queryKey: ['inquiries', statusFilter],
    queryFn: () => inquiriesApi.list({ status: statusFilter }),
  })

  const m = useMutation({
    mutationFn: (body: { status?: string; admin_reply?: string }) => inquiriesApi.reply(selected!.id, body),
    onSuccess: () => {
      message.success('답변 저장 완료')
      qc.invalidateQueries({ queryKey: ['inquiries'] })
      setSelected(null); setReply('')
    },
    onError: (e: any) => message.error(`저장 실패: ${e?.response?.data?.detail || e?.message || ''}`),
  })

  const openDetail = (r: Inquiry) => {
    setSelected(r)
    setReply(r.admin_reply || '')
    setNewStatus(r.status === 'pending' ? 'resolved' : r.status)
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <Title level={3} style={{ marginTop: 0 }}>문의 / 요청</Title>
      <Text type="secondary">
        {isAdmin
          ? '사용자가 보낸 문의를 조회하고 답변/상태를 관리합니다.'
          : '다른 사용자가 보낸 문의와 관리자 답변을 함께 볼 수 있습니다. 새 문의는 우측 상단 "문의" 버튼으로 보내세요.'}
      </Text>

      <Space style={{ marginTop: 16, marginBottom: 12 }}>
        <Text>상태:</Text>
        <Select
          value={statusFilter ?? 'all'}
          onChange={v => setStatusFilter(v === 'all' ? undefined : v)}
          options={[
            { value: 'all',         label: '전체' },
            { value: 'pending',     label: '대기' },
            { value: 'in_progress', label: '처리중' },
            { value: 'resolved',    label: '해결' },
            { value: 'closed',      label: '종료' },
          ]}
          style={{ width: 140 }}
        />
      </Space>

      <Card size="small">
        <Table
          size="small"
          loading={isLoading}
          pagination={{ pageSize: 20 }}
          rowKey="id"
          scroll={{ x: 800 }}
          dataSource={list}
          onRow={(r) => ({ onClick: () => openDetail(r) , style: { cursor: 'pointer' } })}
          columns={[
            { title: 'ID', dataIndex: 'id', width: 60 },
            { title: '상태', dataIndex: 'status', width: 90,
              render: (v: string) => <Tag color={STATUS_LABEL[v]?.color}>{STATUS_LABEL[v]?.text ?? v}</Tag> },
            { title: '요청자', dataIndex: 'user_id', width: 140,
              render: (v: string, r: Inquiry) => (
                <Space size={4}>
                  <Text style={{ fontFamily: 'monospace' }}>{v}</Text>
                  {r.user_role === 'admin'
                    ? <Tag color="purple">관리자</Tag>
                    : PLANT_NAMES[v] && <Text type="secondary" style={{ fontSize: 11 }}>({PLANT_NAMES[v]})</Text>}
                </Space>
              ) },
            { title: '메시지', dataIndex: 'message', ellipsis: true,
              render: (v: string) => <Text>{v}</Text> },
            { title: '화면', dataIndex: 'page_path', width: 130,
              render: (v: string) => v ? <Text code style={{ fontSize: 10 }}>{v}</Text> : '—' },
            { title: '첨부', dataIndex: 'screenshot_url', width: 60, align: 'center' as const,
              render: (v: string | null) => v ? '📎' : '' },
            { title: '접수일시', dataIndex: 'created_at', width: 140,
              render: (v: string) => <Text style={{ fontSize: 11 }}>{new Date(v).toLocaleString('ko-KR')}</Text> },
          ]}
          locale={{ emptyText: <Empty description="문의 없음" /> }}
        />
      </Card>

      {/* 상세/답변 모달 — 일반 사용자는 읽기 전용 */}
      <Modal
        open={!!selected}
        onCancel={() => { setSelected(null); setReply('') }}
        title={selected ? `문의 #${selected.id}` : '문의'}
        width={640}
        style={{ maxWidth: 'calc(100vw - 32px)' }}
        footer={
          isAdmin ? [
            <Button key="cancel" onClick={() => { setSelected(null); setReply('') }}>닫기</Button>,
            <Button
              key="save"
              type="primary"
              loading={m.isPending}
              onClick={() => m.mutate({ status: newStatus, admin_reply: reply || undefined })}
            >저장</Button>,
          ] : [
            <Button key="cancel" onClick={() => { setSelected(null); setReply('') }}>닫기</Button>,
          ]
        }
      >
        {selected && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <Text type="secondary" style={{ fontSize: 11 }}>요청자</Text>
              <div>
                <Text style={{ fontFamily: 'monospace' }}>{selected.user_id}</Text>
                {selected.user_role === 'admin'
                  ? <Tag color="purple" style={{ marginLeft: 6 }}>관리자</Tag>
                  : PLANT_NAMES[selected.user_id ?? ''] && <Text type="secondary" style={{ marginLeft: 6, fontSize: 12 }}>({PLANT_NAMES[selected.user_id ?? '']})</Text>}
                <Text type="secondary" style={{ marginLeft: 12, fontSize: 11 }}>
                  {new Date(selected.created_at).toLocaleString('ko-KR')}
                </Text>
              </div>
            </div>

            {selected.page_path && (
              <div>
                <Text type="secondary" style={{ fontSize: 11 }}>요청한 화면</Text>
                <div><Text code>{selected.page_path}</Text></div>
              </div>
            )}

            <div>
              <Text type="secondary" style={{ fontSize: 11 }}>메시지</Text>
              <Paragraph style={{ whiteSpace: 'pre-wrap', marginBottom: 0, marginTop: 4 }}>
                {selected.message}
              </Paragraph>
            </div>

            {selected.screenshot_url && (
              <div>
                <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>첨부 스크린샷</Text>
                <Image src={selected.screenshot_url} style={{ maxWidth: '100%', maxHeight: 360, borderRadius: 4, border: '1px solid rgba(128,128,128,0.2)' }} />
              </div>
            )}

            <div style={{ borderTop: '1px solid rgba(128,128,128,0.2)', paddingTop: 12 }}>
              <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 6 }}>
                💬 관리자 답변
              </Text>
              {isAdmin ? (
                <TextArea
                  rows={4}
                  value={reply}
                  onChange={e => setReply(e.target.value)}
                  placeholder="답변 내용을 입력하세요. 저장하면 요청자가 본인 문의 목록에서 볼 수 있습니다."
                  maxLength={2000}
                  showCount
                />
              ) : selected.admin_reply ? (
                <div style={{
                  padding: '8px 10px', background: 'rgba(82,196,26,0.08)',
                  border: '1px solid rgba(82,196,26,0.3)', borderRadius: 4,
                }}>
                  <Paragraph style={{ marginBottom: 4, whiteSpace: 'pre-wrap', fontSize: 13 }}>
                    {selected.admin_reply}
                  </Paragraph>
                  {selected.replied_at && (
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      답변: {new Date(selected.replied_at).toLocaleString('ko-KR')}
                    </Text>
                  )}
                </div>
              ) : (
                <Text type="secondary" style={{ fontSize: 12 }}>⏳ 아직 답변이 없습니다</Text>
              )}
            </div>

            {isAdmin && (
              <Space>
                <Text>처리 상태:</Text>
                <Select
                  value={newStatus}
                  onChange={setNewStatus}
                  options={[
                    { value: 'pending',     label: '대기' },
                    { value: 'in_progress', label: '처리중' },
                    { value: 'resolved',    label: '해결' },
                    { value: 'closed',      label: '종료' },
                  ]}
                  style={{ width: 140 }}
                />
              </Space>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
