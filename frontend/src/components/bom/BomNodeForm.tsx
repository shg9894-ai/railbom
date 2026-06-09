import { useEffect } from 'react'
import { Modal, Form, Input, InputNumber, Select, Divider } from 'antd'
import type { BomNode, NodeType } from '../../types'
import { CATEGORIES } from '../../types'

interface Props {
  open: boolean
  onClose: () => void
  onSubmit: (values: Partial<BomNode>) => void
  loading?: boolean
  initialValues?: Partial<BomNode>
  parentNode?: BomNode | null
  vehicleTypeId: number
}

const NODE_TYPES: { value: NodeType; label: string }[] = [
  { value: 'category', label: '분류 (최상위)' },
  { value: 'assembly', label: '조립체' },
  { value: 'part', label: '부품' },
  { value: 'kit', label: '키트' },
]

const UNITS = ['EA', 'SET', 'm', 'kg', 'L', '식']

export default function BomNodeForm({ open, onClose, onSubmit, loading, initialValues, parentNode, vehicleTypeId }: Props) {
  const [form] = Form.useForm()
  const nodeType = Form.useWatch('node_type', form)

  useEffect(() => {
    if (open) {
      if (initialValues) {
        form.setFieldsValue(initialValues)
      } else {
        form.resetFields()
        if (parentNode?.category_code) {
          form.setFieldValue('category_code', parentNode.category_code)
        }
        form.setFieldValue('node_type', parentNode ? 'assembly' : 'category')
        form.setFieldValue('unit', 'EA')
        form.setFieldValue('quantity', 1)
      }
    }
  }, [open, initialValues, parentNode, form])

  const isLeaf = nodeType === 'part' || nodeType === 'kit'

  return (
    <Modal
      title={initialValues?.id ? '노드 수정' : (parentNode ? `"${parentNode.name}" 하위에 추가` : '최상위 노드 추가')}
      open={open}
      onOk={() => form.submit()}
      onCancel={onClose}
      confirmLoading={loading}
      width={620}
      style={{ maxWidth: 'calc(100vw - 32px)' }}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={(values) => onSubmit({ ...values, vehicle_type_id: vehicleTypeId })}
      >
        <Form.Item name="node_type" label="노드 타입" rules={[{ required: true }]}>
          <Select options={NODE_TYPES} />
        </Form.Item>

        <Form.Item name="category_code" label="8대 분류" rules={[{ required: true }]}>
          <Select
            options={CATEGORIES.map((c) => ({ value: c.code, label: `${c.code}. ${c.name}` }))}
          />
        </Form.Item>

        <div style={{ display: 'flex', gap: 12 }}>
          <Form.Item name="material_no" label="자재번호 (공사)" style={{ flex: 1 }}>
            <Input placeholder="공사 자재관리번호" />
          </Form.Item>
          <Form.Item name="name" label="자재내역" rules={[{ required: true }]} style={{ flex: 2 }}>
            <Input placeholder="자재명 (한글)" />
          </Form.Item>
        </div>

        <Form.Item name="name_en" label="자재내역 (영문)">
          <Input placeholder="Material Description (English)" />
        </Form.Item>

        <Form.Item name="specification" label="규격">
          <Input placeholder="예: 25kV/1MVA, M12×1.5, SUS304" />
        </Form.Item>

        {isLeaf && (
          <>
            <Divider style={{ margin: '12px 0' }} />

            <div style={{ display: 'flex', gap: 12 }}>
              <Form.Item name="quantity" label="수량" style={{ flex: 1 }}>
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="unit" label="단위" style={{ flex: 1 }}>
                <Select options={UNITS.map((u) => ({ value: u, label: u }))} />
              </Form.Item>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <Form.Item name="manufacturer" label="제작사" style={{ flex: 1 }}>
                <Input placeholder="제작사명" />
              </Form.Item>
              <Form.Item name="manufacturer_pn" label="제작사 CPN" style={{ flex: 1 }}>
                <Input placeholder="Component Part Number" />
              </Form.Item>
            </div>

            <Form.Item name="drawing_no" label="도면번호">
              <Input />
            </Form.Item>

            <div style={{ display: 'flex', gap: 12 }}>
              <Form.Item name="weight_kg" label="중량 (kg)" style={{ flex: 1 }}>
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="material" label="재질" style={{ flex: 1 }}>
                <Input placeholder="예: SUS304, Al6061" />
              </Form.Item>
            </div>
          </>
        )}

        <Form.Item name="notes" label="비고">
          <Input.TextArea rows={2} />
        </Form.Item>
      </Form>
    </Modal>
  )
}
