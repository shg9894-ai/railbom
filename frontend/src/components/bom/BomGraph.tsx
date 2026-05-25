import { useCallback, useEffect, useRef } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  type Node,
  type Edge,
  type NodeProps,
  Handle,
  Position,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { BomNode } from '../../types'
import { CATEGORY_COLORS, getCategoryCode } from '../../types'

// ─── 깊이별 별 크기 ───────────────────────────────────────────────────────────
function starRadius(depth: number): number {
  if (depth === 0) return 36
  if (depth === 1) return 20
  if (depth === 2) return 13
  if (depth === 3) return 8
  return 5
}

// ─── 산개 레이아웃 ─────────────────────────────────────────────────────────────
function scatterAround(
  parentId: number,
  childIds: number[],
  positionMap: Map<number, { x: number; y: number }>,
  depthMap: Map<number, number>,
  grandParentId: number | null,
) {
  const pp = positionMap.get(parentId) ?? { x: 0, y: 0 }
  let awayAngle: number
  if (grandParentId != null && positionMap.has(grandParentId)) {
    const gp = positionMap.get(grandParentId)!
    awayAngle = Math.atan2(pp.y - gp.y, pp.x - gp.x)
  } else {
    awayAngle = Math.abs(pp.x) < 20 && Math.abs(pp.y) < 20
      ? Math.random() * 2 * Math.PI
      : Math.atan2(pp.y, pp.x)
  }

  const n = childIds.length
  const depth = depthMap.get(parentId) ?? 0
  const dist = Math.max(80, 190 - depth * 22)
  const spread = n <= 1 ? 0.3 : Math.min(Math.PI * 1.35, n * 0.3)

  childIds.forEach((cid, i) => {
    if (positionMap.has(cid)) return
    const t = n <= 1 ? 0.5 : i / (n - 1)
    const angle = awayAngle - spread / 2 + t * spread + (Math.random() - 0.5) * 0.14
    const d = dist + (Math.random() - 0.5) * 40
    positionMap.set(cid, {
      x: pp.x + Math.cos(angle) * d,
      y: pp.y + Math.sin(angle) * d,
    })
  })
}

// ─── 선택 경로 계산 (선택된 노드부터 루트까지) ────────────────────────────────
function getAncestorIds(id: number, bm: Map<number, BomNode>): Set<number> {
  const s = new Set<number>()
  let cur: BomNode | undefined = bm.get(id)
  while (cur) {
    s.add(cur.id)
    cur = cur.parent_id != null ? bm.get(cur.parent_id) : undefined
  }
  return s
}

// ─── 별 노드 컴포넌트 ─────────────────────────────────────────────────────────
interface StarData extends Record<string, unknown> {
  bom: BomNode
  depth: number
  color: string
  selected: boolean      // 현재 선택된 노드
  onPath: boolean        // 선택된 노드의 조상
  hasMore: boolean
}

function StarNode({ data }: NodeProps) {
  const { bom, depth, color, selected, onPath, hasMore } = data as StarData
  const r = starRadius(depth)
  const d = r * 2
  const showLabel = r >= 13

  const glow = selected
    ? `0 0 ${r * 0.5}px #fff,
       0 0 ${r * 1.0}px #fff,
       0 0 ${r * 2.0}px ${color},
       0 0 ${r * 4.0}px ${color}bb,
       0 0 ${r * 7.0}px ${color}55`
    : onPath
    ? `0 0 ${r * 0.4}px ${color}ff,
       0 0 ${r * 1.2}px ${color}cc,
       0 0 ${r * 3.0}px ${color}66`
    : hasMore
    ? `0 0 ${r * 0.4}px ${color}cc,
       0 0 ${r * 1.2}px ${color}66,
       0 0 ${r * 2.5}px ${color}33`
    : `0 0 ${r * 0.3}px ${color}88,
       0 0 ${r * 0.8}px ${color}33`

  const bg = selected
    ? `radial-gradient(circle at 30% 28%, #fff 0%, ${color} 40%, ${color}99 100%)`
    : onPath
    ? `radial-gradient(circle at 32% 28%, ${color}ff 0%, ${color}dd 40%, ${color}77 100%)`
    : `radial-gradient(circle at 32% 28%, ${color}ff 0%, ${color}cc 35%, ${color}55 75%, ${color}22 100%)`

  return (
    <div
      style={{ width: d, height: d, position: 'relative', cursor: 'pointer' }}
      title={`${bom.name}${bom.manufacturer_pn ? '\nCPN: ' + bom.manufacturer_pn : ''}`}
    >
      <Handle type="target" position={Position.Top}
        style={{ top: r, left: r, opacity: 0, width: 0, height: 0, minWidth: 0, minHeight: 0, border: 'none' }} />

      {/* 선택된 노드 외곽 링 */}
      {(selected || onPath) && (
        <div style={{
          position: 'absolute',
          inset: selected ? -6 : -4,
          borderRadius: '50%',
          border: `1.5px solid ${color}${selected ? 'cc' : '66'}`,
          pointerEvents: 'none',
          animation: selected ? 'pulse 1.8s ease-in-out infinite' : 'none',
        }} />
      )}

      {/* 자식 있는 노드 외곽 링 */}
      {hasMore && !selected && !onPath && (
        <div style={{
          position: 'absolute', inset: -4,
          borderRadius: '50%',
          border: `1px dashed ${color}44`,
          pointerEvents: 'none',
        }} />
      )}

      {/* 별 본체 */}
      <div style={{
        width: d, height: d, borderRadius: '50%',
        background: bg,
        border: `1px solid ${color}${selected ? 'dd' : onPath ? 'aa' : '66'}`,
        boxShadow: glow,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'visible',
        transition: 'box-shadow 0.25s ease, background 0.25s ease',
        userSelect: 'none',
      }} />

      {/* 라벨: 별 바깥에 위치 */}
      {showLabel && (
        <div style={{
          position: 'absolute',
          top: d + (r >= 28 ? 5 : 3),
          left: '50%',
          transform: 'translateX(-50%)',
          width: r >= 28 ? 100 : r >= 13 ? 80 : 60,
          textAlign: 'center',
          fontSize: r >= 28 ? 9 : 8,
          fontWeight: selected ? 700 : onPath ? 600 : 400,
          color: selected ? '#fff' : onPath ? `${color}ff` : `${color}bb`,
          lineHeight: 1.3,
          pointerEvents: 'none',
          textShadow: '0 0 8px #060d1f, 0 0 4px #060d1f, 0 0 4px #060d1f',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          whiteSpace: 'normal',
        }}>
          {bom.name}
        </div>
      )}

      <Handle type="source" position={Position.Bottom}
        style={{ top: r, left: r, opacity: 0, width: 0, height: 0, minWidth: 0, minHeight: 0, border: 'none' }} />
    </div>
  )
}

const nodeTypes = { star: StarNode }

// ─── 메인 그래프 (inner) ──────────────────────────────────────────────────────
interface BomGraphProps {
  roots: BomNode[]
  loadChildren: (id: number) => Promise<BomNode[]>
  selectedNodeId: number | null
  onSelectNode: (node: BomNode) => void
}

function BomGraphInner({ roots, loadChildren, selectedNodeId, onSelectNode }: BomGraphProps) {
  const { fitView } = useReactFlow()
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])

  const bomMap = useRef(new Map<number, BomNode>())
  const childrenMap = useRef(new Map<number, number[]>())
  const depthMap = useRef(new Map<number, number>())
  const positionMap = useRef(new Map<number, { x: number; y: number }>())
  const loadedSet = useRef(new Set<number>())
  const rootIdsRef = useRef<number[]>([])
  const selectedRef = useRef<number | null>(selectedNodeId)
  selectedRef.current = selectedNodeId

  // rebuild 후 fitView 실행용: rebuildId가 바뀔 때만 fitView
  const pendingFitRef = useRef<{ nodeIds: string[]; rebuildId: number } | null>(null)
  const rebuildIdRef = useRef(0)

  function getCategoryColor(bom: BomNode): string {
    return CATEGORY_COLORS[getCategoryCode(bom) ?? ''] ?? '#88aaff'
  }

  const rebuildRef = useRef<() => void>(() => {})

  function rebuild() {
    rebuildIdRef.current += 1
    const thisRebuildId = rebuildIdRef.current

    const rootIds = rootIdsRef.current
    const visible = new Set<number>(rootIds)
    function collect(id: number) {
      if (loadedSet.current.has(id)) {
        ;(childrenMap.current.get(id) ?? []).forEach((cid) => { visible.add(cid); collect(cid) })
      }
    }
    rootIds.forEach(collect)

    // 선택된 노드의 조상 경로
    const ancestorPath = selectedRef.current != null
      ? getAncestorIds(selectedRef.current, bomMap.current)
      : new Set<number>()

    const rfNodes: Node[] = []
    const rfEdges: Edge[] = []

    visible.forEach((id) => {
      const bom = bomMap.current.get(id)
      if (!bom) return
      const depth = depthMap.current.get(id) ?? 0
      const r = starRadius(depth)
      const p = positionMap.current.get(id) ?? { x: 0, y: 0 }
      const color = getCategoryColor(bom)
      const hasMore = (bom.has_children ?? 0) > 0 && !loadedSet.current.has(id)
      const selected = selectedRef.current === id
      const onPath = !selected && ancestorPath.has(id)

      rfNodes.push({
        id: String(id),
        type: 'star',
        position: { x: p.x - r, y: p.y - r },
        data: { bom, depth, color, selected, onPath, hasMore } as StarData,
        style: { background: 'transparent', border: 'none', boxShadow: 'none' },
      })

      const parentId = bom.parent_id
      if (parentId != null && visible.has(parentId)) {
        const pc = getCategoryColor(bomMap.current.get(parentId)!)
        const isPathEdge = ancestorPath.has(id) && ancestorPath.has(parentId)
        rfEdges.push({
          id: `e-${parentId}-${id}`,
          source: String(parentId), target: String(id),
          type: 'straight',
          style: {
            stroke: isPathEdge ? `${pc}cc` : `${pc}2a`,
            strokeWidth: isPathEdge ? 1.5 : (depth <= 1 ? 1.0 : 0.6),
          },
        })
      }
    })

    // pendingFit에 rebuildId 기록
    if (pendingFitRef.current) {
      pendingFitRef.current.rebuildId = thisRebuildId
    }

    setNodes(rfNodes)
    setEdges(rfEdges)
  }

  rebuildRef.current = rebuild

  // 노드 업데이트 후 pendingFit 실행 (rebuildId 매칭 시에만)
  const lastFitRebuildId = useRef(-1)
  useEffect(() => {
    const pf = pendingFitRef.current
    if (!pf) return
    if (pf.rebuildId <= lastFitRebuildId.current) return
    lastFitRebuildId.current = pf.rebuildId
    pendingFitRef.current = null
    fitView({ nodes: pf.nodeIds.map((id) => ({ id })), duration: 800, padding: 0.35, maxZoom: 2.2 })
  }, [nodes, fitView])

  const handleNodeClick = useCallback(async (_: React.MouseEvent, node: Node) => {
    const bom = bomMap.current.get(Number(node.id))
    if (!bom) return
    onSelectNode(bom)
    selectedRef.current = bom.id
    const id = bom.id

    if ((bom.has_children ?? 0) > 0 && !loadedSet.current.has(id)) {
      // 자식 로드 후 해당 영역으로 fitView
      const children = await loadChildren(id)
      const depth = (depthMap.current.get(id) ?? 0) + 1
      children.forEach((c) => {
        bomMap.current.set(c.id, c)
        depthMap.current.set(c.id, depth)
      })
      childrenMap.current.set(id, children.map((c) => c.id))
      loadedSet.current.add(id)
      scatterAround(id, children.map((c) => c.id), positionMap.current, depthMap.current, bom.parent_id)
      const childIds = children.map((c) => String(c.id))
      pendingFitRef.current = { nodeIds: [String(id), ...childIds], rebuildId: -1 }
      rebuildRef.current()
    } else if (loadedSet.current.has(id)) {
      // 이미 펼쳐진 노드: 자식들과 함께 보여주기
      rebuildRef.current()  // 경로 하이라이트 갱신
      const childIds = (childrenMap.current.get(id) ?? []).map(String)
      const targets = [String(id), ...childIds].map((nid) => ({ id: nid }))
      fitView({ nodes: targets, duration: 700, padding: 0.35, maxZoom: 2.2 })
    } else {
      // 리프 노드: 경로 하이라이트만 갱신, 줌은 현재 유지
      rebuildRef.current()
    }
  }, [loadChildren, onSelectNode, fitView])

  // roots 변경 시 전체 초기화
  useEffect(() => {
    if (!roots.length) { setNodes([]); setEdges([]); return }

    bomMap.current.clear()
    childrenMap.current.clear()
    depthMap.current.clear()
    positionMap.current.clear()
    loadedSet.current.clear()
    rootIdsRef.current = roots.map((r) => r.id)

    const n = roots.length
    roots.forEach((r, i) => {
      bomMap.current.set(r.id, r)
      depthMap.current.set(r.id, 0)
      const angle = (i / n) * 2 * Math.PI - Math.PI / 2
      const radius = 500 + (Math.random() - 0.5) * 60
      positionMap.current.set(r.id, {
        x: Math.cos(angle) * radius + (Math.random() - 0.5) * 40,
        y: Math.sin(angle) * radius + (Math.random() - 0.5) * 40,
      })
    })

    rebuildRef.current()

    const toLoad = roots.filter((r) => (r.has_children ?? 0) > 0)
    Promise.all(toLoad.map(async (r) => {
      const children = await loadChildren(r.id)
      children.forEach((c) => {
        bomMap.current.set(c.id, c)
        depthMap.current.set(c.id, 1)
      })
      childrenMap.current.set(r.id, children.map((c) => c.id))
      loadedSet.current.add(r.id)
      scatterAround(r.id, children.map((c) => c.id), positionMap.current, depthMap.current, null)
    })).then(() => {
      rebuildRef.current()
      setTimeout(() => fitView({ duration: 1000, padding: 0.1 }), 80)
    })
  }, [roots, loadChildren, fitView])

  // selectedNodeId prop 변경 시 하이라이트만 갱신 (fitView 없음)
  useEffect(() => {
    selectedRef.current = selectedNodeId
    rebuildRef.current()
  }, [selectedNodeId])

  return (
    <>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.15); }
        }
      `}</style>
      <div style={{ width: '100%', height: '100%' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          onNodeClick={handleNodeClick}
          fitView
          fitViewOptions={{ padding: 0.12 }}
          minZoom={0.02}
          maxZoom={5}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          style={{
            background: '#060d1f',
            '--xy-controls-button-background-color': '#0d1b3e',
            '--xy-controls-button-border-bottom-color': '#1a3060',
            '--xy-controls-button-color': '#8ab4e8',
            '--xy-controls-button-background-color-hover': '#1a3060',
          } as React.CSSProperties}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={40} size={0.7} color="#1c2d5e" />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </>
  )
}

export default function BomGraph(props: BomGraphProps) {
  return (
    <ReactFlowProvider>
      <BomGraphInner {...props} />
    </ReactFlowProvider>
  )
}
