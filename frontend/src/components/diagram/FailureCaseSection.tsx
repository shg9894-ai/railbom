import { useState } from 'react'
import { Button, Collapse, Form, Input, Modal, Popconfirm, Space, Tag, Typography, message, Select } from 'antd'
import { WarningOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { failureCasesApi } from '../../api/failureCases'
import type { FailureCase } from '../../api/failureCases'

const { Text } = Typography
const { TextArea } = Input

// ── 공통 훅: 모달 열기/닫기 + 제출 로직 ─────────────────────────
function useFailureCaseModal(nodeId: number) {
  const qc = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [mode, setMode] = useState<'add' | 'edit' | 'delete'>('add')
  const [editing, setEditing] = useState<FailureCase | null>(null)
  const [form] = Form.useForm()

  const { data: cases = [] } = useQuery({
    queryKey: ['failure-cases', nodeId],
    queryFn: () => failureCasesApi.listByNode(nodeId),
    staleTime: 60_000,
  })

  const openAdd = () => {
    setMode('add'); setEditing(null); form.resetFields(); setModalOpen(true)
  }
  const openEdit = (fc: FailureCase) => {
    setMode('edit'); setEditing(fc)
    form.setFieldsValue({ title: fc.title, symptom: fc.symptom, cause: fc.cause, action: fc.action })
    setModalOpen(true)
  }
  const openManage = () => {
    setMode('add'); setEditing(null); form.resetFields(); setModalOpen(true)
  }

  const handleSubmit = async (values: any) => {
    try {
      if (mode === 'edit' && editing) {
        await failureCasesApi.update(editing.id, values)
        message.success('수정됐어요')
      } else {
        await failureCasesApi.create({ node_id: nodeId, ...values, author: localStorage.getItem('user_id') ?? undefined })
        message.success('등록됐어요')
      }
      qc.invalidateQueries({ queryKey: ['failure-cases', nodeId] })
      setModalOpen(false)
    } catch {
      message.error('저장 실패')
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await failureCasesApi.delete(id)
      message.success('삭제됐어요')
      qc.invalidateQueries({ queryKey: ['failure-cases', nodeId] })
    } catch {
      message.error('삭제 실패')
    }
  }

  return { cases, modalOpen, setModalOpen, mode, setMode, editing, setEditing, form, openAdd, openEdit, openManage, handleSubmit, handleDelete }
}

// ── 모달 컴포넌트 ─────────────────────────────────────────────────
function FailureCaseModal({ nodeId, open, onClose, mode, editing, setEditing, form, handleSubmit, handleDelete, cases }: {
  nodeId: number
  open: boolean
  onClose: () => void
  mode: 'add' | 'edit' | 'delete'
  editing: FailureCase | null
  setEditing: (fc: FailureCase | null) => void
  form: any
  handleSubmit: (values: any) => void
  handleDelete: (id: number) => void
  cases: FailureCase[]
}) {
  const modalTitle = mode === 'add' ? '고장 사례 등록' : mode === 'edit' ? '고장 사례 수정' : '고장 사례 삭제'
  const okText = mode === 'add' ? '등록' : '수정'

  return (
    <Modal
      title={modalTitle}
      open={open}
      onCancel={onClose}
      onOk={mode === 'delete' ? undefined : () => form.submit()}
      footer={mode === 'delete' ? null : undefined}
      okText={okText}
      cancelText="취소"
      destroyOnHidden
      width={mode === 'delete' ? 400 : 480}
    >
      {mode === 'delete' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          {cases.length === 0 ? (
            <Text type="secondary" style={{ fontSize: 13 }}>삭제할 고장 사례가 없습니다.</Text>
          ) : (
            cases.map(fc => (
              <div key={fc.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 10px', border: '1px solid #f0f0f0', borderRadius: 6, background: '#fafafa',
              }}>
                <div>
                  <Text strong style={{ fontSize: 13 }}>{fc.title}</Text>
                  {fc.author && <Tag style={{ fontSize: 10, marginLeft: 6 }}>{fc.author}</Tag>}
                  <div style={{ fontSize: 11, color: '#aaa' }}>{new Date(fc.created_at).toLocaleDateString('ko-KR')}</div>
                </div>
                <Popconfirm title="삭제할까요?" onConfirm={() => { handleDelete(fc.id); onClose() }} okText="삭제" cancelText="취소">
                  <Button size="small" danger icon={<DeleteOutlined />}>삭제</Button>
                </Popconfirm>
              </div>
            ))
          )}
        </div>
      ) : (
        <Form form={form} layout="vertical" onFinish={handleSubmit} style={{ marginTop: 12 }}>
          {mode === 'edit' && (
            <Form.Item label="수정할 항목 선택" style={{ marginBottom: 12 }}>
              <Select
                value={editing?.id}
                onChange={(id) => {
                  const fc = cases.find(c => c.id === id)
                  if (fc) {
                    setEditing(fc)
                    form.setFieldsValue({ title: fc.title, symptom: fc.symptom, cause: fc.cause, action: fc.action })
                  }
                }}
                options={cases.map(fc => ({ value: fc.id, label: fc.title }))}
                style={{ width: '100%' }}
                placeholder="수정할 사례 선택"
              />
            </Form.Item>
          )}
          <Form.Item name="title" label="제목" rules={[{ required: true, message: '제목을 입력해주세요' }]}>
            <Input placeholder="예: 절연 파손으로 인한 아크 발생" />
          </Form.Item>
          <Form.Item name="symptom" label="증상">
            <TextArea rows={2} placeholder="어떤 증상이 나타났는지 설명" />
          </Form.Item>
          <Form.Item name="cause" label="원인">
            <TextArea rows={2} placeholder="발생 원인" />
          </Form.Item>
          <Form.Item name="action" label="조치 방법">
            <TextArea rows={3} placeholder="조치 방법 및 주의사항" />
          </Form.Item>
        </Form>
      )}
    </Modal>
  )
}

// ── 우측 버튼 컬럼용: 버튼만 (모달 포함) ────────────────────────
export function FailureCaseSectionButton({ nodeId }: { nodeId: number }) {
  const { cases, modalOpen, setModalOpen, mode, setMode, editing, setEditing, form, handleSubmit, handleDelete } = useFailureCaseModal(nodeId)

  return (
    <>
      <Button
        size="small" type="default"
        style={{ color: '#d46b08', borderColor: '#ffd591', fontSize: 11, background: '#fff7e6' }}
        onClick={() => { setMode('add'); form.resetFields(); setModalOpen(true) }}
      >
        고장 사례
      </Button>

      <FailureCaseModal
        nodeId={nodeId} open={modalOpen} onClose={() => setModalOpen(false)}
        mode={mode} editing={editing} setEditing={setEditing}
        form={form} handleSubmit={handleSubmit} handleDelete={handleDelete} cases={cases}
      />
    </>
  )
}

// ── 인라인 섹션 (Collapse 목록 + 수정버튼) ──────────────────────
export default function FailureCaseSection({ nodeId }: { nodeId: number }) {
  const { cases, modalOpen, setModalOpen, mode, setMode, editing, setEditing, form, openEdit, handleSubmit, handleDelete } = useFailureCaseModal(nodeId)

  const items = cases.map(fc => ({
    key: String(fc.id),
    label: (
      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
        <Space>
          <WarningOutlined style={{ color: '#fa8c16' }} />
          <Text strong style={{ fontSize: 13 }}>{fc.title}</Text>
        </Space>
        <Space size={4} onClick={e => e.stopPropagation()}>
          {fc.author && <Tag style={{ fontSize: 10 }}>{fc.author}</Tag>}
          <Button size="small" type="text" icon={<EditOutlined />} onClick={() => openEdit(fc)} />
          <Popconfirm title="삭제할까요?" onConfirm={() => handleDelete(fc.id)} okText="삭제" cancelText="취소">
            <Button size="small" type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      </Space>
    ),
    children: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '4px 0' }}>
        {fc.symptom && (
          <div>
            <Text type="secondary" style={{ fontSize: 11 }}>증상</Text>
            <div style={{ fontSize: 13, marginTop: 2, whiteSpace: 'pre-wrap' }}>{fc.symptom}</div>
          </div>
        )}
        {fc.cause && (
          <div>
            <Text type="secondary" style={{ fontSize: 11 }}>원인</Text>
            <div style={{ fontSize: 13, marginTop: 2, whiteSpace: 'pre-wrap' }}>{fc.cause}</div>
          </div>
        )}
        {fc.action && (
          <div>
            <Text type="secondary" style={{ fontSize: 11 }}>조치 방법</Text>
            <div style={{ fontSize: 13, marginTop: 2, whiteSpace: 'pre-wrap' }}>{fc.action}</div>
          </div>
        )}
        <Text type="secondary" style={{ fontSize: 10 }}>
          {new Date(fc.created_at).toLocaleDateString('ko-KR')}
        </Text>
      </div>
    ),
  }))

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <Text type="secondary" style={{ fontSize: 11 }}>
          <WarningOutlined style={{ marginRight: 4, color: '#fa8c16' }} />
          고장 사례{cases.length > 0 ? ` (${cases.length}건)` : ''}
        </Text>
        <Button
          size="small" type="default"
          style={{ color: '#d46b08', borderColor: '#ffd591', fontSize: 11, background: '#fff7e6', marginRight: 30, minWidth: 80 }}
          onClick={() => { setMode('add'); form.resetFields(); setModalOpen(true) }}
        >
          고장 사례 수정
        </Button>
      </div>

      {cases.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '12px 0', color: '#bbb',
          border: '1px dashed #ddd', borderRadius: 6, fontSize: 12, marginRight: 30 }}>
          등록된 고장 사례가 없어요
        </div>
      ) : (
        <Collapse size="small" items={items} style={{ fontSize: 12 }} />
      )}

      <FailureCaseModal
        nodeId={nodeId} open={modalOpen} onClose={() => setModalOpen(false)}
        mode={mode} editing={editing} setEditing={setEditing}
        form={form} handleSubmit={handleSubmit} handleDelete={handleDelete} cases={cases}
      />
    </div>
  )
}
