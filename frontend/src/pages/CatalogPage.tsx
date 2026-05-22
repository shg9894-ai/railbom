import { useState } from 'react'
import { Select, Card, Spin, Empty, Image, theme, Typography, Button, Modal, Form, Input, Select as AntSelect, message } from 'antd'
import { EditOutlined } from '@ant-design/icons'
import { useQuery, useMutation } from '@tanstack/react-query'
import { vehicleApi } from '../api/vehicles'
import { diagramPagesApi } from '../api/diagramPages'
import { diagramPageRequestsApi } from '../api/diagramPageRequests'
import type { DiagramPage } from '../api/diagramPages'

const { Text } = Typography
const { TextArea } = Input

const VEHICLE_CODE_MAP: Record<string, string> = {
  'EMU-320':    'emu320',
  'EMU-260':    'emu260',
  'KTX-산천1':  'KTX-산천1',
  'KTX-산천2':  'KTX-산천2',
  'KTX-산천4':  'KTX-산천4',
}

const REQUEST_TYPE_LABELS = [
  { value: 'assembly_add',  label: '부품명 추가' },
  { value: 'assembly_edit', label: '부품명 수정' },
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

  const mutation = useMutation({
    mutationFn: (values: {
      request_type: string
      requested_value?: string
      requester_name?: string
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
        requester_name: values.requester_name ?? null,
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
    >
      {page && (
        <div style={{ marginBottom: 12, padding: '8px 12px', background: '#f5f5f5', borderRadius: 6 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>현재 부품명: </Text>
          <Text strong>{page.assembly || '(없음)'}</Text>
          <Text type="secondary" style={{ fontSize: 12, marginLeft: 12 }}>페이지: </Text>
          <Text>{page.file_no}p</Text>
        </div>
      )}
      <Form form={form} layout="vertical">
        <Form.Item name="request_type" label="요청 유형" rules={[{ required: true, message: '요청 유형을 선택해주세요' }]}>
          <AntSelect options={REQUEST_TYPE_LABELS} placeholder="유형 선택" />
        </Form.Item>
        <Form.Item name="requested_value" label="수정 요청값 (부품명 추가/수정 시)">
          <Input placeholder="올바른 부품명을 입력하세요" />
        </Form.Item>
        <Form.Item name="requester_name" label="요청자명">
          <Input placeholder="이름 (선택)" />
        </Form.Item>
        <Form.Item name="requester_note" label="요청 내용">
          <TextArea rows={3} placeholder="수정이 필요한 이유나 추가 설명을 입력하세요" />
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default function CatalogPage() {
  const { token: tk } = theme.useToken()
  const [vehicleCode, setVehicleCode] = useState<string | null>(null)
  const [requestPage, setRequestPage] = useState<DiagramPage | null>(null)

  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn: vehicleApi.list,
  })

  const { data: pages = [], isLoading } = useQuery({
    queryKey: ['catalog-pages', vehicleCode],
    queryFn: () => diagramPagesApi.allPages(vehicleCode!),
    enabled: !!vehicleCode,
    staleTime: 300_000,
  })

  const vehicleOptions = vehicles
    .filter(v => VEHICLE_CODE_MAP[v.code])
    .map(v => ({ value: VEHICLE_CODE_MAP[v.code], label: `${v.name} (${v.code})` }))

  return (
    <div style={{ height: 'calc(100vh - 112px)', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* 툴바 */}
      <Card size="small" style={{ flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>차종별 명칭도감</span>
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
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                      <span style={{ fontSize: 10, color: tk.colorTextSecondary }}>
                        {p.chapter && p.assembly ? p.chapter : ''} · {p.file_no}p
                      </span>
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
    </div>
  )
}
