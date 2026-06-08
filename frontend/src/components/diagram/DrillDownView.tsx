import React, { useState, useEffect, useCallback, useRef, useMemo, useSyncExternalStore } from 'react'
import {
  Breadcrumb, Card, Row, Col, Spin, Empty, Tag, Button, Typography,
  Space, Input, Image, message, Upload, Modal, Tooltip, Popover, List, theme, Popconfirm,
} from 'antd'
import {
  LeftOutlined, RightOutlined, HomeOutlined, FileOutlined, AppstoreOutlined,
  ToolOutlined, GoldOutlined, SearchOutlined, CopyOutlined,
  PictureOutlined, CameraOutlined, UploadOutlined, DeleteOutlined, LinkOutlined,
} from '@ant-design/icons'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { bomApi } from '../../api/bom'
import { compatApi } from '../../api/compatibility'
import { diagramPagesApi } from '../../api/diagramPages'
import { changeRequestsApi } from '../../api/changeRequests'
import { ecatApi } from '../../api/materialMaster'
import { BomRequestButton, CorpMatRequestButton, PhotoRequestButton } from './ChangeRequestForm'
import FailureCaseSection, { FailureCaseSectionButton } from './FailureCaseSection'
import { repairKitApi } from '../../api/repairKits'
import type { BomNode } from '../../types'
import { CATEGORY_COLORS, CATEGORIES, VEHICLE_DB_CODE, formatBomCode, getCategoryCode } from '../../types'

const { Text, Title } = Typography
const API_BASE = '/api'

/* ─── 카테고리코드 → PDF key 매핑 ──────────────────────────── */
const CAT_TO_KEY: Record<string, string> = {
  '1': 'cat1', '2': 'cat2', '3': 'cat3', '4': 'cat4',
  '5': 'cat5', '6': 'cat6', '7': 'cat7', '8': 'cat8',
}

/* ─── index.json 타입 ────────────────────────────────────────── */
interface PageInfo { page: number; file: string; mat_nos: string[]; preview: string }
interface ManifestEntry { label: string; pages: PageInfo[] }
interface NameIndexEntry { file: string; page: number; callout_no: number; cat: string }
interface DiagramIndex {
  mat_index:  Record<string, { cat: string; label: string; page: number; file: string }[]>
  name_index: Record<string, NameIndexEntry[]>
  manifest:   Record<string, ManifestEntry>
}

// 이름 정규화 (Python normalize()와 동일 로직)
function normalizeName(s: string) {
  return s.replace(/<[^>]+>/g, '').replace(/[\s()\[\]/,_·\-　、。]/g, '').toLowerCase()
}

/* ─── 사진 인덱스 타입 ──────────────────────────────────────── */
type PhotoIndex = Record<string, string[]>   // node_id(str) → filename[]

/* ─── vehicle_type_id → 명칭도감 폴더명 ────────────────────── */
// index.json 및 정적 이미지 폴더용 코드
const VEHICLE_DIAG_FOLDER: Record<number, string> = {
  1: 'emu320',   // KTX-청룡
  2: 'emu260',   // KTX-이음
  3: 'ktx750',   // KTX-원강
  4: 'ktx730',   // KTX-호남
  5: 'KTX-1',   // KTX-1세대
  6: 'ktx720',   // KTX-산천1
  7: 'KTX-산천3', // KTX-SRT
  8: 'ITX-마음',  // ITX-마음
}


/* ─── 명칭도감 인덱스 훅 ────────────────────────────────────── */
function useDiagramIndex(vehicleTypeId: number) {
  const [index, setIndex] = useState<DiagramIndex | null>(null)
  const folder = VEHICLE_DIAG_FOLDER[vehicleTypeId] ?? 'emu320'
  useEffect(() => {
    setIndex(null)
    fetch(`/diagrams/${folder}/index.json`).then(r => r.json()).then(setIndex).catch(() => {})
  }, [folder])
  return { index, folder }
}

/* ─── 조립체 사진 인덱스 훅 ─────────────────────────────────── */
function usePhotoIndex() {
  const [index, setIndex] = useState<PhotoIndex>({})
  const reload = useCallback(() => {
    fetch(`/assembly_photos/index.json?t=${Date.now()}`)
      .then(r => r.json()).then(setIndex).catch(() => {})
  }, [])
  useEffect(() => { reload() }, [reload])
  return { index, reload }
}

/* ─── 타입 ──────────────────────────────────────────────────── */
interface BreadcrumbItem { id: number; name: string; material_no?: string | null; drawing_no?: string | null }
interface Props {
  vehicleTypeId: number
  categoryCode: string
  onBack: () => void
  onChangeCategory: (categoryCode: string, searchName?: string) => void
  initialSearch?: string
}

const NODE_TYPE_ICON: Record<string, React.ReactNode> = {
  category: <AppstoreOutlined />, assembly: <GoldOutlined />,
  part: <ToolOutlined />, kit: <FileOutlined />, repair_kit: <ToolOutlined />,
}
const NODE_TYPE_LABEL: Record<string, string> = {
  category: '분류', assembly: '조립체', part: '부품', kit: '키트', repair_kit: '수리키트',
}

/* ─── 사진 업로드 모달 ──────────────────────────────────────── */
function PhotoModal({
  node, onClose, photoIndex, onReload,
}: {
  node: BomNode
  onClose: () => void
  photoIndex: PhotoIndex
  onReload: () => void
}) {
  const [uploading, setUploading] = useState(false)
  const filenames = photoIndex[String(node.id)] ?? []

  const handleUpload = async (file: File) => {
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    try {
      const res = await fetch(`${API_BASE}/bom/nodes/${node.id}/photos`, {
        method: 'POST', body: fd,
      })
      if (!res.ok) throw new Error(await res.text())
      message.success('사진 업로드 완료')
      onReload()
    } catch (e: any) {
      message.error(`업로드 실패: ${e.message}`)
    } finally {
      setUploading(false)
    }
    return false  // antd Upload: 자동 업로드 방지
  }

  const handleDelete = async (filename: string) => {
    try {
      const res = await fetch(`${API_BASE}/bom/nodes/${node.id}/photos/${filename}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error(await res.text())
      message.success('삭제 완료')
      onReload()
    } catch (e: any) {
      message.error(`삭제 실패: ${e.message}`)
    }
  }

  return (
    <Modal
      open
      title={
        <Space>
          <CameraOutlined style={{ color: '#1677ff' }} />
          <span>{node.name} — 조립체 사진</span>
          {formatBomCode(node.material_no) && (
            <Tag style={{ fontFamily: 'monospace', fontSize: 11 }}>{formatBomCode(node.material_no)}</Tag>
          )}
        </Space>
      }
      onCancel={onClose}
      footer={null}
      width={720}
    >
      {/* 업로드 */}
      <div style={{ marginBottom: 16 }}>
        <Upload
          accept="image/*"
          showUploadList={false}
          beforeUpload={handleUpload}
          disabled={uploading}
        >
          <Button icon={<UploadOutlined />} loading={uploading} type="dashed" block>
            사진 추가 (클릭하거나 파일을 드래그)
          </Button>
        </Upload>
      </div>

      {/* 갤러리 */}
      {filenames.length === 0 ? (
        <Empty
          image={<CameraOutlined style={{ fontSize: 48, color: '#ccc' }} />}
          description="등록된 사진이 없습니다"
          style={{ padding: '32px 0' }}
        />
      ) : (
        <Image.PreviewGroup>
          <Row gutter={[12, 12]}>
            {filenames.map(fn => (
              <Col key={fn} xs={12} sm={8}>
                <div style={{ position: 'relative', borderRadius: 6, overflow: 'hidden',
                  border: '1px solid #eee', background: '#fafafa' }}>
                  <Image
                    src={`/assembly_photos/${fn}`}
                    style={{ width: '100%', display: 'block', aspectRatio: '4/3', objectFit: 'cover' }}
                    preview={{ mask: '확대' }}
                  />
                  <Button
                    danger size="small" icon={<DeleteOutlined />}
                    style={{ position: 'absolute', top: 4, right: 4,
                      opacity: 0.85, background: 'rgba(255,255,255,0.9)' }}
                    onClick={() => handleDelete(fn)}
                  />
                  <div style={{ padding: '3px 6px', fontSize: 10,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: 0.6 }}>
                    {fn.split('_').pop()}
                  </div>
                </div>
              </Col>
            ))}
          </Row>
        </Image.PreviewGroup>
      )}
    </Modal>
  )
}

/* ─── 도면 갤러리 ────────────────────────────────────────────── */
function DiagramGallery({
  categoryCode, highlightFile, onHighlightClear, index, diagFolder, onMatNoClick, filteredFiles,
}: {
  categoryCode: string
  highlightFile: string | null
  onHighlightClear: () => void
  index: DiagramIndex | null
  diagFolder: string
  onMatNoClick: (matNo: string) => void
  filteredFiles?: Set<string> | null  // null = 전체 표시, Set = 해당 파일만
}) {
  const { token: dgt } = theme.useToken()
  const key      = CAT_TO_KEY[categoryCode]
  const manifest = index?.manifest[key]
  const pages    = manifest?.pages ?? []
  const allPages = pages.filter(p => p.page > 1)
  const diagPages = filteredFiles
    ? allPages.filter(p => filteredFiles.has(p.file))
    : allPages

  const [previewCur, setPreviewCur] = useState(0)
  const hlRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (highlightFile && hlRef.current) {
      hlRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [highlightFile])

  if (diagPages.length === 0) return null
  const total = diagPages.length

  return (
    <Card
      size="small"
      title={
        <Space>
          <PictureOutlined />
          <span>명칭도감 — {manifest?.label} ({total}페이지{filteredFiles ? ` / 전체 ${allPages.length}` : ''})</span>
          {filteredFiles && (
            <Tag color="geekblue">현재 어셈블리 관련</Tag>
          )}
          {highlightFile && (
            <Tag color="blue" closable onClose={onHighlightClear}>
              자재번호 매칭 페이지 표시 중
            </Tag>
          )}
        </Space>
      }
      style={{ marginBottom: 8 }}
      styles={{ body: { padding: '8px 12px' } }}
    >
      <Image.PreviewGroup
        preview={{
          current: previewCur,
          onChange: (cur) => setPreviewCur(cur),
          toolbarRender: (originalNode, info) => {
            const cur = (info as { current?: number; total?: number }).current ?? previewCur
            const t   = (info as { current?: number; total?: number }).total ?? 1
            return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              {originalNode}
              <Space>
                <Button
                  size="small"
                  icon={<LeftOutlined />}
                  disabled={cur === 0}
                  onClick={() => setPreviewCur(c => Math.max(0, c - 1))}
                  style={{ background: '#333', borderColor: '#555', color: '#fff' }}
                >
                  이전
                </Button>
                <Text style={{ color: '#ccc', minWidth: 64, textAlign: 'center' }}>
                  {cur + 1} / {t}
                </Text>
                <Button
                  size="small"
                  icon={<RightOutlined />}
                  iconPosition="end"
                  disabled={cur === t - 1}
                  onClick={() => setPreviewCur(c => Math.min(t - 1, c + 1))}
                  style={{ background: '#333', borderColor: '#555', color: '#fff' }}
                >
                  다음
                </Button>
              </Space>
            </div>
          )},
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {diagPages.map((p, i) => {
            const isHL = highlightFile === p.file
            return (
              <div
                key={p.file}
                ref={isHL ? hlRef : null}
                style={{
                  border: isHL ? '2px solid #1677ff' : '1px solid #eee',
                  borderRadius: 6, overflow: 'hidden',
                  boxShadow: isHL ? '0 0 8px #1677ff55' : undefined,
                }}
              >
                <Image
                  src={`/diagrams/${diagFolder}/${p.file}`}
                  alt={`p${p.page}`}
                  style={{ width: '100%', display: 'block' }}
                  preview={{ mask: `p${p.page} 확대`, onVisibleChange: (vis) => { if (vis) setPreviewCur(i) } }}
                />
                <div style={{ padding: '4px 6px', background: isHL ? dgt.colorPrimaryBg : undefined }}>
                  <div style={{ fontSize: 10, opacity: 0.55, marginBottom: p.mat_nos.length > 0 ? 3 : 0 }}>
                    {p.page}p
                    {isHL && <Text strong style={{ color: '#1677ff', marginLeft: 4 }}>← 해당 부품</Text>}
                  </div>
                  {p.mat_nos.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                      {p.mat_nos.map(mn => (
                        <Tag
                          key={mn}
                          style={{ fontSize: 10, margin: 0, cursor: 'pointer', fontFamily: 'monospace',
                            padding: '0 4px', lineHeight: '16px' }}
                          color="blue"
                          onClick={(e) => { e.stopPropagation(); onMatNoClick(mn) }}
                          title={`"${mn}" BOM에서 찾기`}
                        >
                          {mn}
                        </Tag>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </Image.PreviewGroup>
    </Card>
  )
}

/* ─── 부품 카드 ──────────────────────────────────────────────── */
function NodeCard({
  node, onClick, onDrillDown, hasPage,
}: {
  node: BomNode
  onClick: () => void
  onDrillDown?: () => void
  hasPage: boolean
}) {
  const { token: t } = theme.useToken()
  const color       = CATEGORY_COLORS[getCategoryCode(node) ?? ''] ?? '#999'
  const hasChildren = !!node.has_children

  const copyMatNo = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (node.material_no) {
      navigator.clipboard.writeText(node.material_no)
      message.success('자재번호 복사됨')
    }
  }

  return (
    <Card
      size="small"
      hoverable
      onClick={onClick}
      style={{ borderLeft: `4px solid ${color}`, minHeight: 80, cursor: 'pointer' }}
      styles={{ body: { padding: '10px 12px' } }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* 타입 태그 + 자재번호 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4, flexWrap: 'wrap' }}>
            <Tag color="default" icon={NODE_TYPE_ICON[node.node_type]}
              style={{ fontSize: 10, margin: 0, lineHeight: '16px' }}>
              {NODE_TYPE_LABEL[node.node_type] ?? node.node_type}
            </Tag>
            {formatBomCode(node.material_no) && (
              <span
                style={{
                  fontSize: 10, fontFamily: 'monospace',
                  background: hasPage ? t.colorPrimaryBg : undefined,
                  border: hasPage ? `1px solid ${t.colorPrimaryBorder}` : '1px solid transparent',
                  padding: '1px 5px', borderRadius: 3, cursor: 'copy', opacity: 0.85,
                }}
                onClick={copyMatNo} title="클릭하여 복사"
              >
                {formatBomCode(node.material_no)}
                {hasPage && <PictureOutlined style={{ marginLeft: 3, fontSize: 9, color: '#1677ff' }} />}
                <CopyOutlined style={{ marginLeft: 3, fontSize: 9 }} />
              </span>
            )}
          </div>

          {/* 이름 */}
          <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 5 }}>
            {node.name}
            {hasPage && (
              <Tooltip title="명칭도감 있음">
                <span style={{ flexShrink: 0, fontSize: 11, background: '#1677ff', color: '#fff', borderRadius: 3, padding: '0 4px', lineHeight: '16px' }}>
                  📖
                </span>
              </Tooltip>
            )}
          </div>
          {node.name_en && (
            <div style={{ fontSize: 11, opacity: 0.55, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {node.name_en}
            </div>
          )}

          {/* 수량·공사자재번호·사양 */}
          <div style={{ marginTop: 4, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {node.corp_material_no && (
              <Tooltip title="공사 자재번호">
                <span style={{
                  fontSize: 10, fontFamily: 'monospace', color: t.colorPrimary,
                  background: t.colorPrimaryBg, border: `1px solid ${t.colorPrimaryBorder}`,
                  padding: '1px 5px', borderRadius: 3, flexShrink: 0,
                }}>
                  {node.corp_material_no}
                </span>
              </Tooltip>
            )}
            {node.quantity != null && node.quantity !== 1 && (
              <Text strong style={{ fontSize: 11, color, flexShrink: 0 }}>×{node.quantity} {node.unit}</Text>
            )}
            {node.specification && (
              <Text type="secondary" style={{ fontSize: 11 }} ellipsis>{node.specification}</Text>
            )}
          </div>
        </div>

        {/* 우측 버튼 영역 */}
        <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          {hasChildren ? (
            <button
              onClick={e => { e.stopPropagation(); onDrillDown?.() }}
              style={{
                width: 44, height: 44,
                border: 'none', borderRadius: 8,
                background: t.colorPrimaryBg,
                color: t.colorPrimary,
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, fontWeight: 700,
                WebkitTapHighlightColor: 'transparent',
                flexShrink: 0,
              }}
            >
              ›
            </button>
          ) : (
            <div style={{ width: 44, height: 44 }} />
          )}
        </div>
      </div>
    </Card>
  )
}

/* ─── 부품명 → BOM 연결 팝오버 ─────────────────────────────────── */
function PartBomLink({
  partName, vehicleTypeId, onSelectNode,
}: {
  partName: string
  vehicleTypeId: number
  onSelectNode: (categoryCode: string, nodeName: string) => void
}) {
  const { token: tok } = theme.useToken()
  const [open, setOpen] = useState(false)
  const { data: results = [], isFetching } = useQuery({
    queryKey: ['bom-search', vehicleTypeId, partName],
    queryFn: () => bomApi.search(vehicleTypeId, partName),
    enabled: open,
    staleTime: 300_000,
  })

  const content = (
    <div style={{ width: 280 }}>
      {isFetching ? (
        <div style={{ textAlign: 'center', padding: 12 }}><Spin size="small" /></div>
      ) : results.length === 0 ? (
        <Text type="secondary" style={{ fontSize: 12 }}>BOM에서 찾을 수 없음</Text>
      ) : (
        <List
          size="small"
          dataSource={results.slice(0, 6)}
          renderItem={(n) => (
            <List.Item
              style={{ padding: '6px 0', cursor: n.category_code ? 'pointer' : 'default' }}
              onClick={() => {
                if (!n.category_code) return
                setOpen(false)
                onSelectNode(n.category_code, n.name)
              }}
            >
              <div style={{ width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {getCategoryCode(n) && (
                    <Tag color={CATEGORY_COLORS[getCategoryCode(n)!]} style={{ fontSize: 10, margin: 0, padding: '0 4px' }}>
                      {CATEGORIES.find(c => c.code === getCategoryCode(n))?.name ?? getCategoryCode(n)}
                    </Tag>
                  )}
                  <span style={{ fontSize: 12, fontWeight: 500 }}>{n.name}</span>
                </div>
                {n.manufacturer_pn && (
                  <div style={{ fontSize: 11, opacity: 0.55, fontFamily: 'monospace', marginTop: 2 }}>{n.manufacturer_pn}</div>
                )}
                {n.category_code && (
                  <div style={{ fontSize: 10, color: '#1677ff', marginTop: 2 }}>클릭하여 해당 계통으로 이동 →</div>
                )}
              </div>
            </List.Item>
          )}
        />
      )}
    </div>
  )

  return (
    <Popover
      content={content}
      title={<span style={{ fontSize: 12 }}><LinkOutlined style={{ marginRight: 4 }} />BOM 연결</span>}
      trigger="click"
      open={open}
      onOpenChange={setOpen}
    >
      <span style={{
        background: tok.colorPrimaryBg, border: `1px solid ${tok.colorPrimaryBorder}`,
        padding: '1px 6px', borderRadius: 3, fontSize: 11,
        cursor: 'pointer', color: tok.colorPrimary,
      }}>
        {partName}
      </span>
    </Popover>
  )
}

/* ─── 명칭도감 연결 페이지 ────────────────────────────────────── */
function NodeDiagramSection({ nodeId }: { nodeId: number }) {
  const qc = useQueryClient()
  const { data: linked = [], isLoading } = useQuery({
    queryKey: ['node-diagrams', nodeId],
    queryFn: () => bomApi.getDiagrams(nodeId),
    staleTime: 60_000,
  })
  const unlinkMutation = useMutation({
    mutationFn: (linkId: number) => bomApi.unlinkDiagram(nodeId, linkId),
    onSuccess: () => { message.success('연결 해제됨'); qc.invalidateQueries({ queryKey: ['node-diagrams', nodeId] }) },
  })
  const { token: t } = theme.useToken()

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontWeight: 600, fontSize: 13, color: t.colorTextSecondary, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
        📖 명칭도감
      </div>
      {isLoading ? (
        <div style={{ color: '#aaa', fontSize: 12 }}>로딩 중...</div>
      ) : linked.length === 0 ? (
        <div style={{ color: '#bbb', fontSize: 12 }}>연결된 명칭도감 페이지 없음</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {linked.map((p: any) => (
            <div key={p.link_id} style={{ border: '1px solid rgba(128,128,128,0.2)', borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ padding: '4px 8px', background: 'rgba(128,128,128,0.08)', fontSize: 11, color: '#aaa', display: 'flex', alignItems: 'center', gap: 6 }}>
                {p.chapter && <Tag style={{ margin: 0, fontSize: 10 }}>{p.chapter}</Tag>}
                {p.assembly && <span style={{ color: t.colorText, fontWeight: 500 }}>{p.assembly}</span>}
                <span style={{ marginLeft: 'auto' }}>p.{p.book_page ?? p.file_no}</span>
                <Popconfirm title="연결을 해제하시겠습니까?" onConfirm={() => unlinkMutation.mutate(p.link_id)}>
                  <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </div>
              <Image
                src={diagramPagesApi.imageUrl(p.file_no, p.vehicle)}
                alt={`명칭도감 p${p.file_no}`}
                style={{ width: '100%', display: 'block' }}
                preview={{ src: diagramPagesApi.imageUrl(p.file_no, p.vehicle) }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── 수리키트 구성 부품 목록 ────────────────────────────────── */
function RepairKitItemList({ kitId }: { kitId: number }) {
  const { token: t } = theme.useToken()
  const { data: kit, isLoading } = useQuery({
    queryKey: ['repair-kit', kitId],
    queryFn: () => repairKitApi.get(kitId),
    staleTime: 60_000,
  })

  if (isLoading) return <Spin size="small" />
  if (!kit || kit.items.length === 0) return (
    <Text type="secondary" style={{ fontSize: 12 }}>구성 부품 없음</Text>
  )

  return (
    <div>
      <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 6 }}>
        <ToolOutlined style={{ marginRight: 4, color: '#fa8c16' }} />
        구성 부품 ({kit.items.length}개)
      </Text>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {kit.items.map(item => (
          <div key={item.id} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 12, padding: '4px 8px',
            borderRadius: 4, border: `1px solid ${t.colorBorder}`,
          }}>
            <Tag style={{ fontSize: 10, margin: 0, fontFamily: 'monospace' }}>
              {formatBomCode(item.material_no)}
            </Tag>
            <span style={{ flex: 1 }}>{item.name}</span>
            {item.quantity !== 1 && (
              <Text type="secondary" style={{ fontSize: 11 }}>×{item.quantity}</Text>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── 상세 패널 (카드 목록 위에 펼쳐지는 가로형) ──────────────── */
function LeafDetail({
  node, onClose, photoFilenames, onPhotoReload, vehicleTypeId, onSelectNode,
}: {
  node: BomNode
  onClose: () => void
  photoFilenames: string[]
  onPhotoReload: () => void
  vehicleTypeId: number
  onSelectNode: (categoryCode: string, nodeName: string) => void
}) {
  const { token: tok2 } = theme.useToken()
  const [uploading, setUploading] = useState(false)

  const { data: compatList = [] } = useQuery({
    queryKey: ['compat', node.id],
    queryFn: () => compatApi.byNode(node.id),
    staleTime: 60_000,
  })

  // manufacturer_pn을 도면번호로 사용 (drawing_no가 있으면 우선)
  const drawingNo = node.drawing_no || node.manufacturer_pn

  const vehicleCode = VEHICLE_DB_CODE[vehicleTypeId]
  const { data: byDrawingPages = [], isLoading: drawingLoading } = useQuery({
    queryKey: ['diagram-pages', 'drawing', drawingNo, vehicleCode],
    queryFn: () => diagramPagesApi.byDrawingNo(drawingNo!, vehicleCode),
    enabled: !!drawingNo,
    staleTime: 300_000,
  })
  const { data: byAssemblyPages = [], isLoading: assemblyLoading } = useQuery({
    queryKey: ['diagram-pages', 'assembly', node.name, vehicleCode],
    queryFn: () => diagramPagesApi.byAssembly(node.name, vehicleCode!),
    enabled: !drawingNo && !!vehicleCode,
    staleTime: 300_000,
  })
  const { data: linkedDiagrams = [], isLoading: linkedLoading } = useQuery({
    queryKey: ['node-diagrams', node.id],
    queryFn: () => bomApi.getDiagrams(node.id),
    staleTime: 60_000,
  })

  // ecat 자재 사진 (corp_material_no가 있으면 ecat에서 사진 가져옴)
  const { data: ecatData } = useQuery({
    queryKey: ['ecat', node.corp_material_no],
    queryFn: () => ecatApi.material(node.corp_material_no!),
    enabled: !!node.corp_material_no,
    staleTime: 5 * 60_000,
    retry: 0,
  })
  const ecatImages = ecatData?.images ?? []

  const diagramsLoading = drawingLoading || assemblyLoading || linkedLoading

  // bom_node_diagrams로 직접 연결된 페이지의 link_id 맵 (해제 시 사용)
  const linkIdByFileNo: Record<number, number> = {}
  linkedDiagrams.forEach((d: any) => { linkIdByFileNo[d.file_no] = d.link_id })

  const role = localStorage.getItem('role') ?? ''
  const userId = localStorage.getItem('user_id') ?? ''
  const isAdmin = role === 'admin'

  const qcLeaf = useQueryClient()
  const unlinkMutation = useMutation({
    mutationFn: (linkId: number) => bomApi.unlinkDiagram(node.id, linkId),
    onSuccess: () => {
      message.success('명칭도감 연결 해제됨')
      qcLeaf.invalidateQueries({ queryKey: ['node-diagrams', node.id] })
    },
    onError: () => message.error('연결 해제 실패'),
  })

  const unlinkRequestMutation = useMutation({
    mutationFn: (linkId: number) => changeRequestsApi.create({
      node_id: node.id,
      request_type: 'diagram_link_delete',
      requested_value: String(linkId),
      requester_name: userId || null,
    }),
    onSuccess: () => message.success('연결 해제 요청이 제출되었습니다'),
    onError: () => message.error('요청 제출 실패'),
  })

  const [linkModalOpen, setLinkModalOpen] = useState(false)
  const linkedPages: any[] = linkedDiagrams.map((d: any) => ({
    id: d.id, file_no: d.file_no, vehicle: d.vehicle,
    assembly: d.assembly, chapter: d.chapter, book_page: d.book_page, parts: [] as any[],
  }))
  const basePages = byDrawingPages.length > 0 ? byDrawingPages : byAssemblyPages
  const dbDiagramPages = [
    ...basePages,
    ...linkedPages.filter((lp: any) => !basePages.some((bp: any) => bp.file_no === lp.file_no)),
  ]

  const compatCodes = node.compat_codes ?? []

  const meta = [
    { label: 'BOM 코드',      value: formatBomCode(node.material_no),   mono: true, color: '#1677ff' },
    { label: '공사 자재번호',  value: node.corp_material_no ?? '미등록', mono: true, color: node.corp_material_no ? '#0958d9' : undefined, dim: !node.corp_material_no, always: true },
    { label: '단계',           value: node.depth != null ? `Depth ${node.depth}` : null, mono: false },
    { label: '제작사',         value: node.manufacturer,                  mono: false },
    { label: 'CPN',            value: node.manufacturer_pn,               mono: true },
    { label: '도면번호',       value: drawingNo,                          mono: true },
    { label: '영문명',         value: node.name_en,                       mono: false },
    { label: '규격/사양',      value: node.specification,                 mono: false },
    { label: '수량',           value: node.quantity != null ? `${node.quantity} ${node.unit ?? ''}`.trim() : null, mono: false },
    { label: '중량(kg)',       value: node.weight_kg != null ? `${node.weight_kg} kg` : null, mono: false },
    { label: '재질',           value: node.material,                      mono: false },
    { label: '비고',           value: node.notes,                         mono: false },
  ]

  const copyAll = () => {
    navigator.clipboard.writeText(meta.map(r => `${r.label}: ${r.value ?? '—'}`).join('\n'))
    message.success('전체 복사됨')
  }

  const handleUpload = async (file: File) => {
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    try {
      const res = await fetch(`${API_BASE}/bom/nodes/${node.id}/photos`, { method: 'POST', body: fd })
      if (!res.ok) throw new Error(await res.text())
      message.success('사진 업로드 완료')
      onPhotoReload()
    } catch (e: any) { message.error(`업로드 실패: ${e.message}`) }
    finally { setUploading(false) }
    return false
  }

  const handleDelete = async (fn: string) => {
    try {
      await fetch(`${API_BASE}/bom/nodes/${node.id}/photos/${fn}`, { method: 'DELETE' })
      message.success('삭제 완료'); onPhotoReload()
    } catch { message.error('삭제 실패') }
  }

  return (
    <Card
      size="small"
      style={{ borderTop: '2px solid #1677ff', flex: 1 }}
      styles={{ body: { padding: '10px 14px' } }}
      title={
        <Space size={6}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>{node.name}</span>
          {!!node.has_children && <Tag color="blue" style={{ fontSize: 10, margin: 0 }}>조립체</Tag>}
          {node.corp_material_no && (
            <Tooltip title={`ecat에서 ${node.corp_material_no} 보기 (새 창)`}>
              <a
                href={`http://ecat.korail.com/nsl/nomalSearchMatnrView.do?matnr=${encodeURIComponent(node.corp_material_no)}`}
                target="_blank"
                rel="external noopener noreferrer"
                onClick={(e) => {
                  // PWA standalone 모드에서 HTTP 링크 차단 회피: window.open 명시 호출
                  e.preventDefault()
                  const url = `http://ecat.korail.com/nsl/nomalSearchMatnrView.do?matnr=${encodeURIComponent(node.corp_material_no!)}`
                  const w = window.open(url, '_blank', 'noopener,noreferrer')
                  if (!w) {
                    // 차단된 경우 안내 + 클립보드 복사
                    navigator.clipboard?.writeText(url)
                    message.warning('새 창이 차단되었습니다. URL이 복사되었으니 브라우저 주소창에 붙여넣으세요.')
                  }
                }}
                style={{
                  fontSize: 10, fontWeight: 600, color: '#d46b08',
                  background: '#fff7e6', border: '1px solid #ffd591',
                  borderRadius: 4, padding: '1px 6px',
                  textDecoration: 'none', lineHeight: '16px',
                }}
              >
                ecat ↗
              </a>
            </Tooltip>
          )}
        </Space>
      }
      extra={
        <Space size={6}>
          <BomRequestButton node={node} vehicleTypeId={vehicleTypeId} />
          <Button size="small" type="text" onClick={onClose}>✕</Button>
        </Space>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* 속성 2열 그리드 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 20px' }}>
          {meta.filter(r => (r as any).always || r.value != null).map(r => (
            <div key={r.label} style={{ borderBottom: '1px solid #f0f0f0', paddingBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text type="secondary" style={{ fontSize: 11 }}>{r.label}</Text>
                {r.label === '공사 자재번호' && <CorpMatRequestButton node={node} />}
              </div>
              <div style={{
                fontFamily: r.mono ? 'monospace' : undefined,
                fontWeight: r.mono ? 700 : 500,
                fontSize: 13,
                color: r.color,
                opacity: (r as any).dim ? 0.4 : undefined,
                marginTop: 3,
                wordBreak: 'break-all',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}>
                {r.label === '공사 자재번호' && node.corp_material_no ? (
                  <Tooltip title="자재 마스터에서 검색 (새 창)">
                    <a
                      href={`/material-master?q=${encodeURIComponent(node.corp_material_no)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: r.color,
                        fontFamily: 'monospace',
                        fontWeight: 700,
                        textDecoration: 'none',
                        borderBottom: `1px dashed ${r.color}`,
                      }}
                    >
                      {r.value}
                    </a>
                  </Tooltip>
                ) : r.value}
              </div>
            </div>
          ))}
          {compatCodes.length > 0 && (
            <div style={{ borderBottom: '1px solid #f0f0f0', paddingBottom: 10, gridColumn: '1 / -1' }}>
              <Text type="secondary" style={{ fontSize: 11 }}>호환 BOM 코드</Text>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                {compatCodes.map(c => (
                  <span key={c} style={{
                    fontFamily: 'monospace', fontWeight: 700, fontSize: 12,
                    color: '#389e0d', background: '#f6ffed',
                    border: '1px solid #b7eb8f', borderRadius: 4, padding: '1px 6px',
                  }}>{formatBomCode(c)}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 호환성 */}
        {compatList.length > 0 && (
          <div>
            <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 6 }}>
              호환 차종
            </Text>
            <Space wrap size={4}>
              {compatList.map(c => {
                const color = c.compat_type === 'compatible' ? 'success'
                            : c.compat_type === 'incompatible' ? 'error' : 'warning'
                const label = c.compat_type === 'compatible' ? '호환'
                            : c.compat_type === 'incompatible' ? '비호환' : '부분호환'
                return (
                  <Tag key={c.id} color={color} style={{ fontSize: 11 }}>
                    {c.vehicle_name ?? c.vehicle_code}
                    <Text style={{ fontSize: 10, marginLeft: 4, opacity: 0.75 }}>
                      {label}
                    </Text>
                  </Tag>
                )
              })}
            </Space>
          </div>
        )}

        {/* 사진 */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text type="secondary" style={{ fontSize: 11 }}>
              <CameraOutlined style={{ marginRight: 4 }} />
              사진{photoFilenames.length + dbDiagramPages.length + ecatImages.length > 0
                ? ` (${photoFilenames.length + dbDiagramPages.length + ecatImages.length}장)` : ''}
            </Text>
            <Space size={4}>
              <Button size="small" type="dashed" icon={<LinkOutlined />} onClick={() => setLinkModalOpen(true)}>
                명칭도감 연결
              </Button>
              <PhotoRequestButton node={node} vehicleTypeId={vehicleTypeId} onUpload={handleUpload} uploading={uploading} />
            </Space>
          </div>

          {photoFilenames.length === 0 && dbDiagramPages.length === 0 && ecatImages.length === 0 ? (
            diagramsLoading ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: '#bbb',
                border: '1px dashed #ddd', borderRadius: 6, fontSize: 12, marginRight: 30 }}>
                <Spin size="small" />
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px 0', color: '#bbb',
                border: '1px dashed #ddd', borderRadius: 6, fontSize: 12, marginRight: 30 }}>
                <CameraOutlined style={{ fontSize: 24, display: 'block', marginBottom: 4 }} />
                사진 없음
              </div>
            )
          ) : (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Image.PreviewGroup>
                {photoFilenames.map(fn => (
                  <div key={fn} style={{ position: 'relative', width: 130, height: 98,
                    borderRadius: 6, overflow: 'hidden', border: '1px solid #e0e0e0' }}>
                    <Image src={`/assembly_photos/${fn}`}
                      style={{ width: 130, height: 98, objectFit: 'cover' }}
                      preview={{ mask: '확대' }} />
                    <Button danger size="small" icon={<DeleteOutlined />}
                      style={{ position: 'absolute', top: 3, right: 3, opacity: 0.85,
                        background: 'rgba(255,255,255,0.9)', padding: '0 3px' }}
                      onClick={() => handleDelete(fn)} />
                  </div>
                ))}
              </Image.PreviewGroup>

              {/* ecat 자재 사진 (corp_material_no로 연계) */}
              {ecatImages.length > 0 && (
                <Image.PreviewGroup>
                  {ecatImages.map((img: any, i: number) => (
                    <div key={`ecat-${i}`} style={{ position: 'relative', width: 130,
                      borderRadius: 6, overflow: 'hidden', border: '1px solid #ffd591' }}>
                      <Image src={img.url}
                        style={{ width: 130, height: 98, objectFit: 'cover' }}
                        preview={{ mask: 'ecat 사진' }} />
                      <div style={{ padding: '2px 5px', background: '#fff7e6', fontSize: 10, color: '#d46b08',
                        textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        🛒 ecat
                      </div>
                    </div>
                  ))}
                </Image.PreviewGroup>
              )}

              <Image.PreviewGroup>
                {dbDiagramPages.map(dp => {
                  const linkId = linkIdByFileNo[dp.file_no]
                  return (
                    <div key={dp.id} style={{ position: 'relative', width: 130,
                      borderRadius: 6, overflow: 'hidden', border: '1px solid #91caff' }}>
                      <Image src={diagramPagesApi.imageUrl(dp.file_no, vehicleCode)}
                        style={{ width: 130, height: 98, objectFit: 'cover', objectPosition: 'top' }}
                        preview={{ mask: `${dp.book_page ?? dp.file_no}p 확대` }} />
                      <div style={{ padding: '2px 5px', background: tok2.colorPrimaryBg, fontSize: 10, color: tok2.colorPrimary,
                        textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        📖 {dp.book_page ?? dp.file_no}p
                      </div>
                      {linkId && (
                        <Popconfirm
                          title={isAdmin ? "명칭도감 연결을 해제하시겠습니까?" : "연결 해제 요청을 제출하시겠습니까?"}
                          onConfirm={() => isAdmin ? unlinkMutation.mutate(linkId) : unlinkRequestMutation.mutate(linkId)}>
                          <Button danger size="small" icon={<DeleteOutlined />}
                            style={{ position: 'absolute', top: 3, right: 3, opacity: 0.85,
                              background: 'rgba(255,255,255,0.9)', padding: '0 3px' }} />
                        </Popconfirm>
                      )}
                    </div>
                  )
                })}
              </Image.PreviewGroup>
            </div>
          )}
        </div>

        {/* 명칭도감 부품 목록 → BOM 연결 */}
        {dbDiagramPages.some(dp => dp.parts.length > 0) && (
          <div>
            <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 6 }}>
              <LinkOutlined style={{ marginRight: 4 }} />명칭도감 부품 목록 (클릭하면 BOM에서 검색)
            </Text>
            {dbDiagramPages.filter(dp => dp.parts.length > 0).map(dp => (
              <div key={dp.id} style={{ marginBottom: 8 }}>
                {dp.assembly && (
                  <div style={{ fontSize: 11, opacity: 0.55, marginBottom: 4 }}>{dp.assembly}</div>
                )}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {dp.parts.map((pt: any, i: number) => (
                    <PartBomLink key={i} partName={pt.part_name} vehicleTypeId={vehicleTypeId} onSelectNode={onSelectNode} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 고장 사례 */}
        <FailureCaseSection nodeId={node.id} />

        {/* 수리키트 구성 부품 목록 (repair_kit 노드일 때만) */}
        {node.node_type === 'repair_kit' && (
          <RepairKitItemList kitId={node.id} />
        )}

      </div>

      <LinkDiagramModal
        open={linkModalOpen}
        onClose={() => setLinkModalOpen(false)}
        nodeId={node.id}
        nodeName={node.name}
        vehicleCode={vehicleCode}
        alreadyLinkedFileNos={Object.keys(linkIdByFileNo).map(Number)}
        isAdmin={isAdmin}
        userId={userId}
      />
    </Card>
  )
}

/* ─── 명칭도감 페이지 연결 모달 ────────────────────────────── */
function LinkDiagramModal({
  open, onClose, nodeId, nodeName, vehicleCode, alreadyLinkedFileNos, isAdmin, userId,
}: {
  open: boolean
  onClose: () => void
  nodeId: number
  nodeName: string
  vehicleCode: string
  alreadyLinkedFileNos: number[]
  isAdmin: boolean
  userId: string
}) {
  const { token: tok } = theme.useToken()
  const [search, setSearch] = useState('')
  const qc = useQueryClient()

  const { data: pages = [], isLoading } = useQuery({
    queryKey: ['all-diagram-pages', vehicleCode],
    queryFn: () => diagramPagesApi.allPages(vehicleCode),
    enabled: open && !!vehicleCode,
    staleTime: 5 * 60_000,
  })

  const linkMutation = useMutation({
    mutationFn: (pageId: number) => bomApi.linkDiagram(nodeId, { diagram_page_id: pageId, match_type: 'manual' }),
    onSuccess: () => {
      message.success('명칭도감 연결됨')
      qc.invalidateQueries({ queryKey: ['node-diagrams', nodeId] })
    },
    onError: (e: any) => message.error(`연결 실패: ${e.message}`),
  })

  const linkRequestMutation = useMutation({
    mutationFn: (pageId: number) => changeRequestsApi.create({
      node_id: nodeId,
      request_type: 'diagram_link_add',
      requested_value: String(pageId),
      requester_name: userId || null,
    }),
    onSuccess: () => message.success('명칭도감 연결 요청이 제출되었습니다'),
    onError: (e: any) => message.error(`요청 제출 실패: ${e.message}`),
  })

  // 기본 검색어를 노드 이름으로 세팅
  useEffect(() => {
    if (open) setSearch(nodeName)
  }, [open, nodeName])

  const linkedSet = new Set(alreadyLinkedFileNos)

  const filtered = pages.filter(p => {
    if (!search.trim()) return true
    const q = search.trim().toLowerCase()
    return (
      (p.assembly ?? '').toLowerCase().includes(q) ||
      (p.chapter ?? '').toLowerCase().includes(q) ||
      String(p.file_no).includes(q) ||
      String(p.book_page ?? '').includes(q) ||
      (p.drawing_no ?? '').toLowerCase().includes(q)
    )
  })

  return (
    <Modal
      open={open}
      onCancel={() => { setSearch(''); onClose() }}
      title={`명칭도감 페이지 연결 — ${nodeName}`}
      footer={null}
      width={720}
    >
      {!isAdmin && (
        <div style={{ marginBottom: 8, padding: '6px 10px', borderRadius: 4,
          background: 'rgba(250, 173, 20, 0.12)', fontSize: 12, color: '#d48806' }}>
          ⚠️ 일반 사용자: 페이지 선택 시 연결 <b>요청</b>이 제출되며, 관리자 승인 후 적용됩니다.
        </div>
      )}
      <Input.Search
        placeholder="페이지 번호 / 챕터 / assembly / 도면번호로 검색"
        value={search}
        onChange={e => setSearch(e.target.value)}
        allowClear
        style={{ marginBottom: 12 }}
      />
      <div style={{ maxHeight: 480, overflow: 'auto', paddingRight: 4 }}>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
        ) : filtered.length === 0 ? (
          <Empty description="검색 결과 없음" />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
            {filtered.slice(0, 100).map(p => {
              const linked = linkedSet.has(p.file_no)
              return (
                <div key={p.id} style={{
                  border: `1px solid ${linked ? '#52c41a' : tok.colorBorder}`,
                  borderRadius: 6, overflow: 'hidden',
                  background: tok.colorBgContainer,
                  cursor: linked ? 'default' : 'pointer',
                  opacity: linked ? 0.7 : 1,
                }}
                  onClick={() => !linked && (isAdmin ? linkMutation.mutate(p.id) : linkRequestMutation.mutate(p.id))}
                >
                  <Image
                    src={diagramPagesApi.imageUrl(p.file_no, vehicleCode)}
                    style={{ width: '100%', height: 100, objectFit: 'cover', objectPosition: 'top' }}
                    preview={false}
                  />
                  <div style={{ padding: '4px 6px' }}>
                    <div style={{ fontSize: 10, color: tok.colorTextSecondary, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.assembly || p.chapter || '-'}
                    </div>
                    <div style={{ fontSize: 10, marginTop: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: tok.colorPrimary, fontWeight: 600 }}>p.{p.book_page ?? p.file_no}</span>
                      {linked && <Tag color="success" style={{ fontSize: 9, margin: 0 }}>연결됨</Tag>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        {filtered.length > 100 && (
          <div style={{ textAlign: 'center', padding: 12, color: tok.colorTextSecondary, fontSize: 12 }}>
            상위 100개만 표시됩니다. 검색어를 좁혀주세요.
          </div>
        )}
      </div>
    </Modal>
  )
}

function useIsMobile() {
  return useSyncExternalStore(
    cb => { window.addEventListener('resize', cb); return () => window.removeEventListener('resize', cb) },
    () => window.innerWidth < 768,
  )
}

/* ─── 메인 ───────────────────────────────────────────────────── */
export default function DrillDownView({ vehicleTypeId, categoryCode, onBack, onChangeCategory, initialSearch }: Props) {
  const [stack, setStack]                 = useState<BreadcrumbItem[]>([])
  const [currentNodeId, setCurrentNodeId] = useState<number | null>(null)
  const [selectedLeaf, setSelectedLeaf]   = useState<BomNode | null>(null)
  const [search, setSearch]               = useState(initialSearch ?? '')
  const [highlightFile, setHighlightFile] = useState<string | null>(null)

  useEffect(() => {
    if (initialSearch) setSearch(initialSearch)
  }, [initialSearch])

  const { index: diagramIndex, folder: diagFolder } = useDiagramIndex(vehicleTypeId)
  const { index: photoIndex, reload: reloadPhotos } = usePhotoIndex()

  const isMobile = useIsMobile()
  const catName = CATEGORIES.find(c => c.code === categoryCode)?.name ?? categoryCode
  const color   = CATEGORY_COLORS[categoryCode] ?? '#999'
  const depth   = stack.length

  const { data: roots, isLoading: rootsLoading } = useQuery({
    queryKey: ['bom-roots', vehicleTypeId, categoryCode],
    queryFn:  () => bomApi.getRoots(vehicleTypeId, categoryCode),
    enabled:  currentNodeId === null,
  })
  const { data: children, isLoading: childLoading } = useQuery({
    queryKey: ['bom-children', currentNodeId],
    queryFn:  () => bomApi.getChildrenLazy(currentNodeId!),
    enabled:  currentNodeId !== null,
  })

  // 루트가 자식 있는 노드 1개뿐이면 그 자식을 카테고리 직속 자식처럼 표시 (전력추진=전력추진장치 동일시)
  // currentNodeId === null 인 상태에서도 single root의 자식들과 명칭도감을 미리 로드 → 화면 깜빡임 없음
  const singleRootNode = roots?.length === 1 && roots[0].has_children ? roots[0] : null
  const { data: singleRootChildren = [] } = useQuery({
    queryKey: ['bom-children', singleRootNode?.id],
    queryFn:  () => bomApi.getChildrenLazy(singleRootNode!.id),
    enabled:  currentNodeId === null && !!singleRootNode,
  })

  const isLoading    = rootsLoading || childLoading
  const rawNodes     = currentNodeId === null
    ? (singleRootNode ? singleRootChildren : (roots ?? []))
    : (children ?? [])
  const displayNodes = search.trim()
    ? rawNodes.filter(n =>
        n.name.includes(search) ||
        (n.material_no ?? '').includes(search) ||
        (n.name_en ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (n.drawing_no ?? '').includes(search) ||
        (n.manufacturer_pn ?? '').includes(search))
    : rawNodes

  // 현재 노드 목록의 drawing_no / 이름 → DB에서 명칭도감 있는 것 일괄 조회
  // drawing_no가 없는 노드만 이름으로 assembly 매칭 (호남처럼 drawing_no가 null인 차종)
  const drawingNos = displayNodes.map(n => n.drawing_no || n.manufacturer_pn).filter(Boolean) as string[]
  const nodeNamesWithoutDrawing = displayNodes
    .filter(n => !n.drawing_no && !n.manufacturer_pn)
    .map(n => n.name)
  const vehicleCode = VEHICLE_DB_CODE[vehicleTypeId]
  const { data: hasPageResult } = useQuery({
    queryKey: ['diagram-pages', 'has-pages', drawingNos.join(','), nodeNamesWithoutDrawing.join(','), vehicleCode],
    queryFn: () => diagramPagesApi.hasPages(drawingNos, vehicleCode, nodeNamesWithoutDrawing),
    enabled: displayNodes.length > 0,
    staleTime: 300_000,
  })
  const hasPageDrawingNos = new Set(
    (hasPageResult?.matched_drawing_nos ?? []).flatMap(dno => [dno, dno.split('-')[0]])
  )
  const hasPageNames = new Set(hasPageResult?.matched_node_names ?? [])

  // 도면번호/OEM PN/이름 → 명칭도감 페이지 조회
  const getPages = useCallback((node: BomNode) => {
    if (!diagramIndex) return []
    const seen = new Set<string>()
    type Entry = { file: string; page: number; cat: string; label: string; callout_no?: number }
    const results: Entry[] = []

    // 1) mat_index: drawing_no → manufacturer_pn
    const mi = diagramIndex.mat_index
    for (const key of [node.drawing_no, node.manufacturer_pn]) {
      if (!key) continue
      for (const entry of mi[key] ?? []) {
        if (!seen.has(entry.file)) { seen.add(entry.file); results.push(entry) }
      }
    }

    // 2) name_index: 노드 이름으로 조회 (같은 카테고리 우선)
    const ni = diagramIndex.name_index ?? {}
    const nk = normalizeName(node.name)
    for (const entry of ni[nk] ?? []) {
      if (!seen.has(entry.file)) {
        seen.add(entry.file)
        results.push({ ...entry, label: entry.cat })
      }
    }

    return results
  }, [diagramIndex])

  // 드릴다운 상태면 현재 노드(stack 마지막)의 도면번호로 index.json mat_index 필터링
  const galleryFilter = useMemo((): Set<string> | null => {
    if (!currentNodeId || !diagramIndex) return null

    const files = new Set<string>()
    const cur = stack.length > 0 ? stack[stack.length - 1] : null
    if (cur) {
      const mi = diagramIndex.mat_index
      for (const key of [cur.material_no, cur.drawing_no]) {
        if (!key) continue
        for (const entry of mi[key] ?? []) {
          files.add(entry.file)
        }
      }
    }
    return files
  }, [currentNodeId, diagramIndex, stack])

  // 현재 드릴다운 노드의 도면번호로 DB 기반 명칭도감 페이지 조회
  const curNode = stack.length > 0 ? stack[stack.length - 1] : null
  const curDrawingNo = curNode?.drawing_no ?? null
  const { data: curDbPagesByDrawing = [] } = useQuery({
    queryKey: ['diagram-pages', 'by-drawing', curDrawingNo, vehicleCode],
    queryFn: () => diagramPagesApi.byDrawingNo(curDrawingNo!, vehicleCode),
    enabled: !!curDrawingNo && !!currentNodeId,
    staleTime: 300_000,
  })
  // 현재 노드(currentNodeId 또는 자동인식된 singleRootNode)에 bom_node_diagrams로 직접 연결된 페이지
  const effectiveNodeId = currentNodeId ?? singleRootNode?.id ?? null
  const { data: curLinkedDiagrams = [] } = useQuery({
    queryKey: ['node-diagrams', effectiveNodeId],
    queryFn: () => bomApi.getDiagrams(effectiveNodeId!),
    enabled: !!effectiveNodeId,
    staleTime: 60_000,
  })
  const curDbPages = [
    ...curDbPagesByDrawing,
    ...curLinkedDiagrams.filter((ld: any) => !curDbPagesByDrawing.some((bp: any) => bp.file_no === ld.file_no)),
  ]

  // node_id → 사진 목록
  const getPhotos = (nodeId: number) => photoIndex[String(nodeId)] ?? []

  const handleClickNode = useCallback((node: BomNode) => {
    // category 타입 노드는 카드 클릭 시 바로 드릴다운
    if (node.node_type === 'category') {
      setCurrentNodeId(node.id)
      setStack(prev => [...prev, { id: node.id, name: node.name, material_no: node.material_no, drawing_no: node.drawing_no }])
      setSelectedLeaf(null)
      setSearch('')
      setHighlightFile(null)
      return
    }
    const pages = getPages(node)
    setHighlightFile(pages.length > 0 ? pages[0].file : null)
    setSelectedLeaf(node)
  }, [diagramIndex, categoryCode, getPages])

  const handleDrillDown = useCallback((node: BomNode) => {
    setCurrentNodeId(node.id)
    setStack(prev => [...prev, { id: node.id, name: node.name, material_no: node.material_no, drawing_no: node.drawing_no }])
    setSelectedLeaf(null)
    setSearch('')
    setHighlightFile(null)
  }, [])

  const handleBreadcrumb = (index: number) => {
    if (index < 0) { setCurrentNodeId(null); setStack([]) }
    else { setCurrentNodeId(stack[index].id); setStack(prev => prev.slice(0, index + 1)) }
    setSelectedLeaf(null); setSearch(''); setHighlightFile(null)
  }

  const breadcrumbItems = [
    { title: <span style={{ cursor: 'pointer' }} onClick={onBack}><HomeOutlined /> 부품 탐색</span> },
    { title: <span style={{ cursor: 'pointer', color }} onClick={() => handleBreadcrumb(-1)}>{catName}</span> },
    ...stack.map((item, idx) => ({
      title: (
        <span
          style={{ cursor: idx < stack.length - 1 ? 'pointer' : 'default',
                   fontWeight: idx === stack.length - 1 ? 600 : 400 }}
          onClick={() => idx < stack.length - 1 ? handleBreadcrumb(idx) : undefined}
        >
          {item.name.length > 18 ? item.name.slice(0, 18) + '…' : item.name}
        </span>
      ),
    })),
  ]

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0, overflow: 'hidden' }}>
      {/* 브레드크럼 */}
      <Card size="small" style={{ flexShrink: 0, borderLeft: `4px solid ${color}`, overflow: 'hidden' }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
          <Breadcrumb items={breadcrumbItems} />
          <Space>
            <Tag color={color} style={{ fontSize: 11 }}>
              {depth === 0 ? '최상위' : `${depth}단계`}
            </Tag>
            <Button size="small" onClick={onBack}>← 부품 탐색으로</Button>
          </Space>
        </Space>
      </Card>

      {/* 좌: 카드 목록 / 우: 명칭도감 or 상세 패널 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 8, overflow: isMobile ? 'auto' : 'hidden' }}>

        {/* 왼쪽: 헤더 + 검색 + 카드 목록 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: isMobile ? 'visible' : 'hidden', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginBottom: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
            <Title level={5} style={{ margin: 0, flex: 1 }}>
              {stack.length > 0 ? stack[stack.length - 1].name : catName}
              {rawNodes.length > 0 && (
                <Text type="secondary" style={{ fontSize: 12, fontWeight: 400, marginLeft: 6 }}>
                  ({displayNodes.length}{search ? `/${rawNodes.length}` : ''}건)
                </Text>
              )}
            </Title>
            <Input
              prefix={<SearchOutlined />}
              placeholder="자재명 / 자재번호 / 도면번호"
              size="small"
              style={{ width: 190, maxWidth: '45%', flexShrink: 1, borderColor: search ? '#1677ff' : undefined }}
              value={search}
              onChange={e => setSearch(e.target.value)}
              allowClear
              suffix={search ? (
                <Tooltip title="도면 태그 클릭으로 자동 검색됨">
                  <PictureOutlined style={{ color: '#1677ff', fontSize: 11 }} />
                </Tooltip>
              ) : undefined}
            />
          </div>

          <div style={{ flex: 1, overflow: isMobile ? 'visible' : 'auto' }}>
            {isLoading ? (
              <div style={{ textAlign: 'center', paddingTop: 80 }}><Spin size="large" /></div>
            ) : displayNodes.length === 0 ? (
              <Empty description={search ? '검색 결과 없음' : '하위 항목이 없습니다'} style={{ paddingTop: 60 }} />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
                {displayNodes.map(node => (
                  <React.Fragment key={node.id}>
                    <NodeCard
                      node={node}
                      hasPage={(() => {
                        const dno = node.drawing_no || node.manufacturer_pn
                        if (dno && (hasPageDrawingNos.has(dno) || hasPageDrawingNos.has(dno.split('-')[0]))) return true
                        return hasPageNames.has(node.name)
                      })()}
                      onClick={() => handleClickNode(node)}
                      onDrillDown={() => handleDrillDown(node)}
                    />
                    {isMobile && selectedLeaf?.id === node.id && (
                      <div key={`detail-${node.id}`} style={{ gridColumn: '1 / -1' }}>
                        <LeafDetail
                          node={selectedLeaf}
                          onClose={() => setSelectedLeaf(null)}
                          photoFilenames={getPhotos(selectedLeaf.id)}
                          onPhotoReload={reloadPhotos}
                          vehicleTypeId={vehicleTypeId}
                          onSelectNode={(catCode, nodeName) => { onChangeCategory(catCode, nodeName) }}
                        />
                      </div>
                    )}
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 오른쪽: 명칭도감 or 상세 패널 (데스크탑만) */}
        {!isMobile && <div style={{ width: 460, flexShrink: 0, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
          {selectedLeaf ? (
            <LeafDetail
              node={selectedLeaf}
              onClose={() => setSelectedLeaf(null)}
              photoFilenames={getPhotos(selectedLeaf.id)}
              onPhotoReload={reloadPhotos}
              vehicleTypeId={vehicleTypeId}
              onSelectNode={(catCode, nodeName) => {
                onChangeCategory(catCode, nodeName)
              }}
            />
          ) : (
            <>
              <DiagramGallery
                categoryCode={categoryCode}
                highlightFile={highlightFile}
                onHighlightClear={() => setHighlightFile(null)}
                index={diagramIndex}
                diagFolder={diagFolder}
                onMatNoClick={(mn) => { setSearch(mn); setSelectedLeaf(null) }}
                filteredFiles={galleryFilter}
              />
              {curDbPages.length > 0 && (
                <Card
                  size="small"
                  title={<Space><PictureOutlined /><span>명칭도감 — 현재 어셈블리 ({curDbPages.length}페이지)</span></Space>}
                  style={{ marginBottom: 8 }}
                  styles={{ body: { padding: '8px 12px' } }}
                >
                  <Image.PreviewGroup>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {curDbPages.map(dp => (
                        <div key={dp.id}>
                          <Image
                            src={diagramPagesApi.imageUrl(dp.file_no, vehicleCode)}
                            style={{ width: '100%', borderRadius: 4 }}
                            preview={{ src: diagramPagesApi.imageUrl(dp.file_no, vehicleCode) }}
                          />
                          {dp.book_page && (
                            <div style={{ textAlign: 'center', fontSize: 11, opacity: 0.55, marginTop: 2 }}>
                              {dp.book_page}p
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </Image.PreviewGroup>
                </Card>
              )}
            </>
          )}
        </div>}
      </div>

    </div>
  )
}
