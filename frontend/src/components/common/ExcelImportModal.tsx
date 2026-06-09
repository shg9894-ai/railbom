import { useState } from 'react'
import { Modal, Upload, Button, Alert, Tabs, Select, Tag, Spin, message } from 'antd'
import { InboxOutlined, LinkOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { excelApi } from '../../api/excel'
import type { NativeSheet, ImportResult } from '../../api/excel'
import { vehicleApi } from '../../api/vehicles'

interface Props {
  open: boolean
  onClose: () => void
  vehicleId: number
  vehicleCode?: string
  onSuccess: () => void
}

function ResultAlert({ result }: { result: ImportResult }) {
  const ok = result.errors.length === 0
  return (
    <Alert
      style={{ marginTop: 12 }}
      type={ok ? 'success' : 'warning'}
      message={
        `완료 — 추가 ${result.inserted}건 / 수정 ${result.updated}건` +
        (result.compat_added ? ` / 호환성 ${result.compat_added}건` : '') +
        (result.errors.length ? ` / 오류 ${result.errors.length}건` : '')
      }
      description={
        result.errors.length > 0 ? (
          <ul style={{ marginTop: 6, paddingLeft: 16 }}>
            {result.errors.slice(0, 8).map((e, i) => <li key={i}>{e}</li>)}
            {result.errors.length > 8 && <li>... 외 {result.errors.length - 8}건</li>}
          </ul>
        ) : undefined
      }
    />
  )
}

// ── 시스템 포맷 탭 ────────────────────────────────────────────────────────────
function SystemFormatTab({ vehicleId, onSuccess }: { vehicleId: number; onSuccess: () => void }) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)

  const handleUpload = async (file: File) => {
    setLoading(true)
    setResult(null)
    try {
      const res = await excelApi.importBom(vehicleId, file)
      setResult(res)
      if (res.errors.length === 0) onSuccess()
    } catch (e: any) {
      message.error(e.message)
    } finally {
      setLoading(false)
    }
    return false
  }

  return (
    <>
      <Upload.Dragger
        accept=".xlsx,.xls"
        beforeUpload={handleUpload}
        showUploadList={false}
        disabled={loading}
      >
        {loading ? <Spin /> : (
          <>
            <p><InboxOutlined style={{ fontSize: 36, color: '#1677ff' }} /></p>
            <p>BOM_DATA 시트가 포함된 xlsx 파일</p>
          </>
        )}
      </Upload.Dragger>
      <div style={{ marginTop: 8, textAlign: 'right' }}>
        <Button size="small" onClick={() => excelApi.downloadTemplate()}>템플릿 다운로드</Button>
      </div>
      {result && <ResultAlert result={result} />}
    </>
  )
}

// ── 네이티브 포맷 탭 ──────────────────────────────────────────────────────────
function NativeFormatTab({ vehicleId, onSuccess }: { vehicleId: number; onSuccess: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [sheets, setSheets] = useState<NativeSheet[]>([])
  const [selectedSheet, setSelectedSheet] = useState<string | null>(null)
  const [otherVehicleMap, setOtherVehicleMap] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)

  // 이 파일의 타차종 열 이름들 (미리보기 후 확정)
  const [otherCols, setOtherCols] = useState<string[]>([])

  const { data: vehicles = [] } = useQuery({ queryKey: ['vehicles'], queryFn: vehicleApi.list })

  const handleFileSelect = async (f: File) => {
    setFile(f)
    setResult(null)
    setSelectedSheet(null)
    setOtherCols([])
    setOtherVehicleMap({})
    setLoading(true)
    try {
      const preview = await excelApi.previewNative(f)
      setSheets(preview.sheets)
      if (preview.sheets.length > 0) setSelectedSheet(preview.sheets[0].sheet)
      // 타차종 열은 선택된 시트에서 import 시 자동 감지됨
      // 나머지 시트 이름을 타차종 후보로 제공
      const otherSheetNames = preview.sheets
        .map((s) => s.sheet)
        .filter((s) => s !== preview.sheets[0].sheet)
      setOtherCols(otherSheetNames)
    } catch (e: any) {
      message.error(e.message)
    } finally {
      setLoading(false)
    }
    return false
  }

  const handleSheetChange = (sheet: string) => {
    setSelectedSheet(sheet)
    const others = sheets.map((s) => s.sheet).filter((s) => s !== sheet)
    setOtherCols(others)
    setOtherVehicleMap({})
    setResult(null)
  }

  const handleImport = async () => {
    if (!file || !selectedSheet) return
    setLoading(true)
    setResult(null)
    try {
      const res = await excelApi.importNative(vehicleId, file, selectedSheet, otherVehicleMap)
      setResult(res)
      if (res.errors.length === 0) onSuccess()
    } catch (e: any) {
      message.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="L1~L10 / Lv1~Lv10 / LEVEL 구조의 BOM 파일을 가져옵니다"
        description="분류코드 열이 임시 식별자로 사용됩니다. 타차종 열을 매핑하면 호환성이 자동 등록됩니다."
      />

      <Upload.Dragger
        accept=".xlsx,.xls"
        beforeUpload={handleFileSelect}
        showUploadList={false}
        disabled={loading}
        style={{ marginBottom: 12 }}
      >
        {loading && !sheets.length ? <Spin /> : (
          <>
            <p><InboxOutlined style={{ fontSize: 36, color: '#1677ff' }} /></p>
            <p>{file ? `선택됨: ${file.name}` : 'xlsx 파일을 드래그하거나 클릭'}</p>
          </>
        )}
      </Upload.Dragger>

      {sheets.length > 0 && (
        <>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>가져올 시트 (= 현재 차종 BOM)</div>
            <Select
              style={{ width: '100%' }}
              value={selectedSheet}
              onChange={handleSheetChange}
              options={sheets.map((s) => ({
                value: s.sheet,
                label: `${s.sheet} (약 ${s.rows.toLocaleString()}행)`,
              }))}
            />
          </div>

          {otherCols.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>
                타차종 열 → 차종 매핑
                <span style={{ fontWeight: 400, color: '#888', fontSize: 12, marginLeft: 8 }}>
                  (선택 시 호환성 자동 등록)
                </span>
              </div>
              {otherCols.map((col) => (
                <div key={col} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <Tag icon={<LinkOutlined />} color="blue" style={{ minWidth: 60, textAlign: 'center' }}>
                    {col}
                  </Tag>
                  <span style={{ color: '#aaa' }}>→</span>
                  <Select
                    style={{ flex: 1 }}
                    placeholder="차종 선택 (선택 안 하면 호환성 미등록)"
                    allowClear
                    options={vehicles.map((v) => ({ value: v.id, label: v.name }))}
                    onChange={(val) => {
                      setOtherVehicleMap((prev) => {
                        const next = { ...prev }
                        if (val === undefined) delete next[col]
                        else next[col] = val
                        return next
                      })
                    }}
                  />
                </div>
              ))}
            </div>
          )}

          <Button
            type="primary"
            block
            loading={loading}
            disabled={!selectedSheet}
            onClick={handleImport}
          >
            가져오기 실행
          </Button>
        </>
      )}

      {result && <ResultAlert result={result} />}
    </>
  )
}

// ── 메인 모달 ─────────────────────────────────────────────────────────────────
export default function ExcelImportModal({ open, onClose, vehicleId, onSuccess }: Props) {
  return (
    <Modal
      title="BOM Excel 가져오기"
      open={open}
      onCancel={onClose}
      footer={null}
      width={520}
      style={{ maxWidth: 'calc(100vw - 32px)' }}
    >
      <Tabs
        items={[
          {
            key: 'native',
            label: '네이티브 포맷',
            children: <NativeFormatTab vehicleId={vehicleId} onSuccess={onSuccess} />,
          },
          {
            key: 'system',
            label: '시스템 포맷',
            children: <SystemFormatTab vehicleId={vehicleId} onSuccess={onSuccess} />,
          },
        ]}
      />
    </Modal>
  )
}
