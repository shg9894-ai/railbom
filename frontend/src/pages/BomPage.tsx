import { useState, useMemo, useCallback, useRef } from 'react'
import {
  Select, Card, Spin, Empty, Input, Button, Space, Tooltip,
  Typography, theme,
} from 'antd'
import {
  SearchOutlined, DownloadOutlined, RightOutlined, DownOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { vehicleApi } from '../api/vehicles'
import { bomApi } from '../api/bom'
import { excelApi } from '../api/excel'
import type { BomNode } from '../types'
import { CATEGORY_COLORS, formatBomCode } from '../types'

const { Text } = Typography

const DEPTH_COLORS = [
  { bg: '#1677ff', fg: '#fff' },  // 0 - 파랑
  { bg: '#52c41a', fg: '#fff' },  // 1 - 초록
  { bg: '#fa8c16', fg: '#fff' },  // 2 - 주황
  { bg: '#722ed1', fg: '#fff' },  // 3 - 보라
  { bg: '#eb2f96', fg: '#fff' },  // 4 - 핑크
  { bg: '#13c2c2', fg: '#fff' },  // 5 - 청록
  { bg: '#faad14', fg: '#fff' },  // 6 - 노랑
  { bg: '#f5222d', fg: '#fff' },  // 7 - 빨강
]

// ── 열 정의 ──────────────────────────────────────────────────────────────────
const COLUMNS = [
  { key: 'material_no',      label: 'BOM 코드',    width: 130, mono: true },
  { key: 'corp_material_no', label: '공사 자재번호', width: 120, mono: true },
  { key: 'manufacturer_pn',  label: 'CPN',         width: 130, mono: true },
  { key: 'drawing_no',       label: '도면번호',     width: 130, mono: true },
  { key: 'quantity',         label: '수량',         width: 60  },
  { key: 'unit',             label: '단위',         width: 50  },
  { key: 'compat_codes',     label: '호환 코드',    width: 200 },
  { key: 'manufacturer',     label: '제작사',       width: 110 },
  { key: 'specification',    label: '규격/사양',    width: 160 },
  { key: 'material',         label: '재질',         width: 80  },
  { key: 'weight_kg',        label: '중량(kg)',     width: 70  },
  { key: 'notes',            label: '비고',         width: 120 },
] as const
type ColKey = (typeof COLUMNS)[number]['key']

// ── 셀 렌더 ──────────────────────────────────────────────────────────────────
function CellValue({ colKey, node }: { colKey: ColKey; node: BomNode }) {
  const { token: tk } = theme.useToken()
  if (colKey === 'compat_codes') {
    const codes = node.compat_codes ?? []
    if (codes.length === 0) return <span style={{ opacity: 0.2 }}>—</span>
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        {codes.map(c => (
          <span key={c} style={{
            fontFamily: 'monospace', fontSize: 10, color: tk.colorSuccess,
            background: tk.colorSuccessBg, border: `1px solid ${tk.colorSuccessBorder}`,
            borderRadius: 3, padding: '0 4px', whiteSpace: 'nowrap',
          }}>{formatBomCode(c)}</span>
        ))}
      </div>
    )
  }
  const raw = (node as any)[colKey]
  if (raw == null || raw === '') return <span style={{ opacity: 0.2 }}>—</span>
  if (colKey === 'material_no')
    return <span style={{ fontFamily: 'monospace', fontSize: 11, color: tk.colorPrimary }}>{formatBomCode(raw)}</span>
  if (colKey === 'corp_material_no')
    return <span style={{ fontFamily: 'monospace', fontSize: 11, color: tk.colorPrimaryActive }}>{raw}</span>
  if (colKey === 'manufacturer_pn' || colKey === 'drawing_no')
    return <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{raw}</span>
  return <span style={{ fontSize: 12 }}>{String(raw)}</span>
}

// ── 평탄화 ────────────────────────────────────────────────────────────────────
interface FlatRow { node: BomNode; depth: number; hasChildren: boolean; isExpanded: boolean }

function flattenTree(
  nodes: BomNode[],
  childrenMap: Map<number, BomNode[]>,
  expandedIds: Set<number>,
  depth = 0,
): FlatRow[] {
  const result: FlatRow[] = []
  for (const node of nodes) {
    const hasChildren = !!node.has_children
    const isExpanded  = hasChildren && expandedIds.has(node.id)
    result.push({ node, depth, hasChildren, isExpanded })
    if (isExpanded) {
      const kids = childrenMap.get(node.id) ?? []
      result.push(...flattenTree(kids, childrenMap, expandedIds, depth + 1))
    }
  }
  return result
}

// ── 검색 ──────────────────────────────────────────────────────────────────────
function matchesSearch(node: BomNode, q: string): boolean {
  const lq = q.toLowerCase()
  return (
    node.name.toLowerCase().includes(lq) ||
    (node.material_no ?? '').toLowerCase().includes(lq) ||
    (node.manufacturer_pn ?? '').toLowerCase().includes(lq) ||
    (node.drawing_no ?? '').toLowerCase().includes(lq) ||
    (node.corp_material_no ?? '').toLowerCase().includes(lq) ||
    (node.name_en ?? '').toLowerCase().includes(lq)
  )
}

function collectMatchIds(roots: BomNode[], childrenMap: Map<number, BomNode[]>, q: string): Set<number> {
  const ids = new Set<number>()
  function walk(ns: BomNode[]) {
    for (const n of ns) {
      if (matchesSearch(n, q)) ids.add(n.id)
      const kids = childrenMap.get(n.id)
      if (kids) walk(kids)
    }
  }
  walk(roots)
  return ids
}

// ── 메인 ──────────────────────────────────────────────────────────────────────
export default function BomPage() {
  const { token: tk } = theme.useToken()
  const [vehicleId,    setVehicleId]   = useState<number | null>(null)
  const [inputValue,   setInputValue]  = useState('')
  const [search,       setSearch]      = useState('')
  const [isSearching,  setIsSearching] = useState(false)
  const [expandedIds,  setExpandedIds] = useState<Set<number>>(new Set())
  const [loadingIds,   setLoadingIds]  = useState<Set<number>>(new Set())
  const [isExpandingAll, setIsExpandingAll] = useState(false)

  // 자식 캐시: nodeId → BomNode[]
  // useRef로 관리해서 setState 루프 없이 트리 수정 가능
  const [childrenMap, setChildrenMap] = useState<Map<number, BomNode[]>>(new Map())
  const childrenMapRef = useRef(childrenMap)
  childrenMapRef.current = childrenMap

  const { data: vehicles = [] } = useQuery({ queryKey: ['vehicles'], queryFn: vehicleApi.list })
  const selectedVehicle = vehicles.find(v => v.id === vehicleId)

  const { data: roots = [], isLoading } = useQuery({
    queryKey: ['bom-roots', vehicleId],
    queryFn:  () => bomApi.getRoots(vehicleId!),
    enabled:  !!vehicleId,
    staleTime: 120_000,
  })

  // 차종/카테고리 변경 시 자식 캐시·펼침 초기화
  const handleVehicleChange = (v: number) => {
    setVehicleId(v)
    setExpandedIds(new Set())
    setChildrenMap(new Map())
    setSearch('')
    setInputValue('')
  }

  // 노드 펼치기/접기
  const handleToggle = useCallback(async (node: BomNode) => {
    const id = node.id
    if (!node.has_children) return

    if (expandedIds.has(id)) {
      setExpandedIds(prev => { const s = new Set(prev); s.delete(id); return s })
      return
    }

    // 이미 로드된 경우
    if (childrenMapRef.current.has(id)) {
      setExpandedIds(prev => new Set([...prev, id]))
      return
    }

    // 자식 로드
    setLoadingIds(prev => new Set([...prev, id]))
    try {
      const children = await bomApi.getChildrenLazy(id)
      setChildrenMap(prev => new Map([...prev, [id, children]]))
      setExpandedIds(prev => new Set([...prev, id]))
    } finally {
      setLoadingIds(prev => { const s = new Set(prev); s.delete(id); return s })
    }
  }, [expandedIds])

  // 전체 트리를 재귀적으로 로드하는 공통 함수
  const loadFullTree = useCallback(async (): Promise<Map<number, BomNode[]>> => {
    const newMap = new Map(childrenMapRef.current)

    // BFS로 전체 트리 로드
    const queue: BomNode[] = [...roots.filter(n => n.has_children)]
    while (queue.length > 0) {
      const batch = queue.splice(0, 10) // 10개씩 병렬 fetch
      const toFetch = batch.filter(n => !newMap.has(n.id))
      if (toFetch.length > 0) {
        const results = await Promise.all(
          toFetch.map(n => bomApi.getChildrenLazy(n.id).then(c => [n.id, c] as [number, BomNode[]]))
        )
        results.forEach(([id, children]) => {
          newMap.set(id, children)
          children.filter(c => c.has_children).forEach(c => queue.push(c))
        })
      }
      // 이미 로드된 것들도 자식을 큐에 추가
      batch
        .filter(n => newMap.has(n.id) && !toFetch.includes(n))
        .forEach(n => {
          newMap.get(n.id)!
            .filter(c => c.has_children && !newMap.has(c.id))
            .forEach(c => queue.push(c))
        })
    }

    return newMap
  }, [roots])

  // 전체 펼치기: BFS로 모든 레벨 재귀 로드 후 펼침
  const expandAll = useCallback(async () => {
    setIsExpandingAll(true)
    try {
      const newMap = await loadFullTree()
      const newExpanded = new Set<number>()
      newMap.forEach((kids, id) => {
        // 실제로 자식이 있는 노드만 expanded에 추가
        if (kids.length > 0) newExpanded.add(id)
      })
      // roots의 has_children인 것도 추가 (자식이 있으나 빈 배열로 온 경우 대비)
      roots.filter(n => n.has_children).forEach(n => newExpanded.add(n.id))
      setChildrenMap(newMap)
      setExpandedIds(newExpanded)
    } finally {
      setIsExpandingAll(false)
    }
  }, [roots, loadFullTree])

  const collapseAll = useCallback(() => setExpandedIds(new Set()), [])

  // 검색 확정 (엔터 또는 버튼)
  const handleSearch = useCallback(async () => {
    const q = inputValue.trim()
    if (!q) {
      setSearch('')
      return
    }
    setIsSearching(true)
    try {
      const newMap = await loadFullTree()
      setChildrenMap(newMap)
      setSearch(q)
    } finally {
      setIsSearching(false)
    }
  }, [inputValue, loadFullTree])

  // 검색 초기화
  const handleSearchClear = useCallback(() => {
    setInputValue('')
    setSearch('')
  }, [])

  // 검색 매칭
  const matchIds = useMemo(() => {
    if (!search.trim()) return null
    return collectMatchIds(roots, childrenMap, search.trim())
  }, [search, roots, childrenMap])

  // 평탄화 행
  const flatRows = useMemo((): FlatRow[] => {
    if (matchIds && matchIds.size > 0) {
      // 검색 시: 로드된 전체 펼침 후 매칭 행만
      const allExpanded = new Set<number>([...expandedIds])
      roots.forEach(n => { if (n.has_children) allExpanded.add(n.id) })
      childrenMap.forEach((kids) => kids.forEach(n => { if (n.has_children) allExpanded.add(n.id) }))
      return flattenTree(roots, childrenMap, allExpanded).filter(r => matchIds.has(r.node.id))
    }
    return flattenTree(roots, childrenMap, expandedIds)
  }, [roots, childrenMap, expandedIds, matchIds])

  const NAME_COL_WIDTH = 280
  const totalWidth = NAME_COL_WIDTH + COLUMNS.reduce((s, c) => s + c.width, 0)

  return (
    <div style={{ height: 'calc(100vh - 112px)', display: 'flex', flexDirection: 'column', gap: 8 }}>

      {/* 툴바 */}
      <Card size="small" style={{ flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Select
            placeholder="차종 선택"
            style={{ width: 200 }}
            options={vehicles.map(v => ({ value: v.id, label: `${v.name} (${v.code})` }))}
            value={vehicleId}
            onChange={handleVehicleChange}
          />

          <div style={{ flex: 1 }} />

          <Input
            prefix={<SearchOutlined />}
            placeholder="자재명 / BOM코드 / 도면번호"
            size="small"
            style={{ width: 220 }}
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onPressEnter={handleSearch}
            allowClear
            onClear={handleSearchClear}
            suffix={
              <Button
                type="link"
                size="small"
                loading={isSearching}
                disabled={!vehicleId || !inputValue.trim()}
                onClick={handleSearch}
                style={{ padding: 0, height: 'auto', fontSize: 11 }}
              >
                검색
              </Button>
            }
          />

          <Space size={4}>
            <Button size="small" onClick={expandAll} disabled={!vehicleId} loading={isExpandingAll}>모두 펼치기</Button>
            <Button size="small" onClick={collapseAll} disabled={!vehicleId}>모두 접기</Button>
            {vehicleId && (
              <Button
                size="small" icon={<DownloadOutlined />}
                onClick={() => excelApi.exportBom(vehicleId!, selectedVehicle?.code ?? 'bom')}
              >Excel 내보내기</Button>
            )}
          </Space>
        </div>
      </Card>

      {/* 테이블 */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {!vehicleId ? (
          <Card style={{ flex: 1 }}>
            <Empty description="차종을 선택하면 BOM 데이터가 표시됩니다" style={{ paddingTop: 80 }} />
          </Card>
        ) : isLoading ? (
          <div style={{ textAlign: 'center', paddingTop: 80 }}><Spin size="large" /></div>
        ) : (
          <div style={{ flex: 1, overflow: 'auto', border: `1px solid ${tk.colorBorder}`, borderRadius: 6 }}>
            <table style={{
              width: totalWidth, minWidth: '100%',
              borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: 12,
            }}>
              <colgroup>
                <col style={{ width: NAME_COL_WIDTH }} />
                {COLUMNS.map(c => <col key={c.key} style={{ width: c.width }} />)}
              </colgroup>
              <thead>
                <tr style={{
                  background: tk.colorBgElevated, borderBottom: `2px solid ${tk.colorBorder}`,
                  position: 'sticky', top: 0, zIndex: 2,
                }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap', color: tk.colorText, background: tk.colorBgElevated }}>
                    명칭
                    {flatRows.length > 0 && (
                      <Text type="secondary" style={{ fontWeight: 400, marginLeft: 6, fontSize: 11 }}>
                        ({flatRows.length}행)
                      </Text>
                    )}
                  </th>
                  {COLUMNS.map(c => (
                    <th key={c.key} style={{
                      padding: '8px 6px', textAlign: 'left', fontWeight: 600,
                      fontSize: 11, whiteSpace: 'nowrap', color: tk.colorTextSecondary,
                      borderLeft: `1px solid ${tk.colorBorderSecondary}`,
                      background: tk.colorBgElevated,
                    }}>{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {flatRows.length === 0 ? (
                  <tr>
                    <td colSpan={COLUMNS.length + 1}
                      style={{ textAlign: 'center', padding: '60px 0', color: tk.colorTextDisabled }}>
                      {search ? `"${search}" 검색 결과 없음` : 'BOM 데이터가 없습니다'}
                    </td>
                  </tr>
                ) : flatRows.map(({ node, depth, hasChildren, isExpanded }) => {
                  const catColor  = node.category_code ? CATEGORY_COLORS[node.category_code] : undefined
                  const isMatch   = matchIds ? matchIds.has(node.id) : false
                  const isLoading_ = loadingIds.has(node.id)

                  return (
                    <tr
                      key={node.id}
                      style={{
                        borderBottom: `1px solid ${tk.colorBorderSecondary}`,
                        background: isMatch ? tk.colorWarningBg : depth === 0 ? tk.colorFillAlter : tk.colorBgContainer,
                        }}
                    >
                      {/* 이름 열 */}
                      <td style={{
                        padding: '5px 8px',
                        paddingLeft: 8 + depth * 20,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        maxWidth: NAME_COL_WIDTH, color: tk.colorText,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          {/* 펼치기 토글 */}
                          <span
                            style={{
                              width: 16, height: 16, flexShrink: 0,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              cursor: hasChildren ? 'pointer' : 'default',
                              color: hasChildren ? tk.colorTextSecondary : 'transparent',
                            }}
                            onClick={() => hasChildren && handleToggle(node)}
                          >
                            {isLoading_ ? <Spin size="small" style={{ fontSize: 10 }} />
                              : hasChildren
                                ? isExpanded ? <DownOutlined style={{ fontSize: 9 }} />
                                             : <RightOutlined style={{ fontSize: 9 }} />
                                : null}
                          </span>

                          {/* 카테고리 도트 (최상위만) */}
                          {catColor && depth === 0 && (
                            <span style={{
                              width: 8, height: 8, borderRadius: '50%',
                              background: catColor, flexShrink: 0,
                            }} />
                          )}

                          {/* depth 레벨 뱃지 */}
                          <span style={{
                            fontSize: 9, padding: '0 3px', borderRadius: 2, flexShrink: 0,
                            minWidth: 14, textAlign: 'center',
                            background: DEPTH_COLORS[Math.min(depth, DEPTH_COLORS.length - 1)].bg,
                            color:      DEPTH_COLORS[Math.min(depth, DEPTH_COLORS.length - 1)].fg,
                            fontWeight: 600,
                          }}>
                            {depth}
                          </span>

                          <Tooltip title={node.name_en || undefined} placement="topLeft">
                            <span style={{
                              fontWeight: hasChildren ? 600 : 400,
                              fontSize: depth === 0 ? 13 : 12,
                              overflow: 'hidden', textOverflow: 'ellipsis',
                            }}>
                              {node.name.replace(/^제\d+장\s*/, '')}
                            </span>
                          </Tooltip>
                        </div>
                      </td>

                      {/* 데이터 열들 */}
                      {COLUMNS.map(c => (
                        <td key={c.key} style={{
                          padding: '5px 6px',
                          borderLeft: `1px solid ${tk.colorBorderSecondary}`,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          maxWidth: c.width, color: tk.colorText,
                        }}>
                          <CellValue colKey={c.key} node={node} />
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  )
}
