import { useState, useRef } from 'react'
import { Modal, Input, Button, Upload, message, Space, Typography, Alert } from 'antd'
import { PaperClipOutlined, UploadOutlined } from '@ant-design/icons'
import { useMutation } from '@tanstack/react-query'
import { useLocation } from 'react-router-dom'
import { inquiriesApi } from '../../api/inquiries'

const { TextArea } = Input
const { Text } = Typography

export default function InquiryModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const location = useLocation()
  const [msg, setMsg] = useState('')
  const [screenshot, setScreenshot] = useState<File | Blob | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const textareaRef = useRef<any>(null)

  const reset = () => { setMsg(''); setScreenshot(null); setPreview(null) }

  const m = useMutation({
    mutationFn: () => inquiriesApi.create({
      message: msg,
      page_path: location.pathname,
      screenshot: screenshot || undefined,
    }),
    onSuccess: () => {
      message.success('문의를 보냈습니다. 관리자가 확인 후 답변드립니다.')
      reset()
      onClose()
    },
    onError: (e: any) => {
      message.error(`문의 전송 실패: ${e?.response?.data?.detail || e?.message || '오류'}`)
    },
  })

  // 클립보드 붙여넣기 처리 — TextArea에 paste 이벤트 후킹
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (const it of items) {
      if (it.type.startsWith('image/')) {
        const file = it.getAsFile()
        if (file) {
          setScreenshot(file)
          setPreview(URL.createObjectURL(file))
          e.preventDefault()
          message.success('스크린샷을 첨부했습니다.')
          return
        }
      }
    }
  }

  return (
    <Modal
      open={open}
      title="관리자에게 문의 / 요청"
      onCancel={() => { reset(); onClose() }}
      style={{ maxWidth: 'calc(100vw - 32px)' }}
      width={520}
      footer={[
        <Button key="cancel" onClick={() => { reset(); onClose() }}>취소</Button>,
        <Button
          key="submit"
          type="primary"
          loading={m.isPending}
          disabled={!msg.trim()}
          onClick={() => m.mutate()}
        >보내기</Button>,
      ]}
    >
      <Alert
        type="info"
        showIcon
        message="문제·건의·자료 요청 무엇이든 보내주세요."
        description="현재 보고 계신 화면 경로가 자동으로 함께 전송됩니다. 스크린샷은 파일 선택 또는 메시지 칸에서 Ctrl+V로 붙여넣기 가능."
        style={{ marginBottom: 12 }}
      />

      <TextArea
        ref={textareaRef}
        rows={5}
        placeholder="예) 자재마스터에서 1125417 검색하면 사진이 안 떠요..."
        value={msg}
        onChange={e => setMsg(e.target.value)}
        onPaste={handlePaste}
        maxLength={2000}
        showCount
        style={{ marginBottom: 12 }}
      />

      <Space wrap>
        <Upload
          accept="image/*"
          maxCount={1}
          showUploadList={false}
          beforeUpload={(file) => {
            setScreenshot(file)
            setPreview(URL.createObjectURL(file))
            return false
          }}
        >
          <Button icon={<UploadOutlined />}>스크린샷 첨부</Button>
        </Upload>
        {screenshot && (
          <Button
            type="text"
            danger
            onClick={() => { setScreenshot(null); setPreview(null) }}
          >첨부 제거</Button>
        )}
        <Text type="secondary" style={{ fontSize: 11 }}>
          <PaperClipOutlined /> Ctrl+V 붙여넣기도 됩니다
        </Text>
      </Space>

      {preview && (
        <div style={{ marginTop: 12, padding: 8, border: '1px solid rgba(128,128,128,0.2)', borderRadius: 6 }}>
          <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 6 }}>첨부 미리보기</Text>
          <img src={preview} alt="screenshot" style={{ maxWidth: '100%', maxHeight: 240, borderRadius: 4 }} />
        </div>
      )}

      <div style={{ marginTop: 12, padding: '6px 10px', background: 'rgba(128,128,128,0.06)', borderRadius: 4, fontSize: 11 }}>
        <Text type="secondary">현재 화면: <Text code style={{ fontSize: 11 }}>{location.pathname}</Text></Text>
      </div>
    </Modal>
  )
}
