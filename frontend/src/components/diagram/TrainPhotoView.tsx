import { useState, useRef, useCallback, useEffect } from 'react'
import { Button, message, theme } from 'antd'
import { EditOutlined, CopyOutlined, CheckOutlined } from '@ant-design/icons'
import { CATEGORY_COLORS } from '../../types'

function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.innerWidth < 768)
  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < 768)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])
  return mobile
}

const VW = 1200
const VH = 540
const BH = 30

interface HotspotDef { code: string; name: string; bx: number; by: number; bw: number }
interface AnchorMap   { [code: string]: { x: number; y: number } }

const DEFAULT_ANCHORS: AnchorMap = {
  '1': { x: 583, y: 198 }, '2': { x: 781, y: 271 },
  '3': { x: 657, y: 312 }, '4': { x: 404, y: 229 },
  '5': { x: 564, y: 318 }, '6': { x: 519, y: 321 },
  '7': { x: 532, y: 227 }, '8': { x: 676, y: 254 },
}
const DEFAULT_HOTSPOTS: HotspotDef[] = [
  { code: '4', name: '운전실·제어', bx: 313, by: 167, bw: 108 },
  { code: '7', name: '차상신호',    bx: 464, by: 106, bw: 108 },
  { code: '1', name: '전력추진',    bx: 620, by: 98,  bw: 108 },
  { code: '8', name: '차체·설비',   bx: 730, by: 160, bw: 108 },
  { code: '6', name: '주행',        bx: 409, by: 404, bw: 108 },
  { code: '5', name: '제동',        bx: 610, by: 427, bw: 108 },
  { code: '3', name: '보조전원',    bx: 768, by: 397, bw: 108 },
  { code: '2', name: '연결',        bx: 858, by: 203, bw: 108 },
]

function lsKey(src: string) { return `trainphoto_cfg_${src}` }

function loadConfig(src: string): { hotspots: HotspotDef[]; anchors: AnchorMap } {
  try {
    const raw = localStorage.getItem(lsKey(src))
    if (raw) return JSON.parse(raw)
  } catch {}
  return { hotspots: DEFAULT_HOTSPOTS, anchors: DEFAULT_ANCHORS }
}

function saveConfig(src: string, hotspots: HotspotDef[], anchors: AnchorMap) {
  localStorage.setItem(lsKey(src), JSON.stringify({ hotspots, anchors }))
}

interface Props {
  onSelectCategory: (code: string) => void
  selectedCategory?: string | null
  imageSrc?: string
  flipImage?: boolean
  editable?: boolean
}

type DragTarget =
  | { kind: 'badge'; code: string }
  | { kind: 'anchor'; code: string }
  | null

export default function TrainPhotoView({
  onSelectCategory,
  selectedCategory,
  imageSrc = '/train_blue_nobg.png',
  flipImage = true,
  editable = false,
}: Props) {
  const isMobile = useIsMobile()
  const { token: tk } = theme.useToken()
  const cfg = loadConfig(imageSrc)
  const [hotspots, setHotspots] = useState<HotspotDef[]>(cfg.hotspots)
  const [anchors,  setAnchors]  = useState<AnchorMap>(cfg.anchors)
  const [hovered,  setHovered]  = useState<string | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [copied,   setCopied]   = useState(false)

  // reload config when imageSrc changes
  useEffect(() => {
    const c = loadConfig(imageSrc)
    setHotspots(c.hotspots)
    setAnchors(c.anchors)
  }, [imageSrc])

  const svgRef   = useRef<SVGSVGElement>(null)
  const dragRef  = useRef<DragTarget>(null)
  const prevRef  = useRef<{ x: number; y: number } | null>(null)

  const svgCoords = useCallback((e: React.PointerEvent) => {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }
    const pt = svg.createSVGPoint()
    pt.x = e.clientX; pt.y = e.clientY
    const m = svg.getScreenCTM()
    if (!m) return { x: 0, y: 0 }
    const t = pt.matrixTransform(m.inverse())
    return { x: t.x, y: t.y }
  }, [])

  const onPointerDown = useCallback((e: React.PointerEvent, target: DragTarget) => {
    if (!editMode) return
    e.stopPropagation()
    ;(e.target as Element).setPointerCapture(e.pointerId)
    dragRef.current = target
    prevRef.current = svgCoords(e)
  }, [editMode, svgCoords])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!editMode || !dragRef.current || !prevRef.current) return
    const cur = svgCoords(e)
    const dx = cur.x - prevRef.current.x
    const dy = cur.y - prevRef.current.y
    prevRef.current = cur

    const target = dragRef.current
    if (target.kind === 'badge') {
      setHotspots(prev => prev.map(h =>
        h.code === target.code ? { ...h, bx: h.bx + dx, by: h.by + dy } : h
      ))
    } else {
      setAnchors(prev => ({
        ...prev,
        [target.code]: { x: prev[target.code].x + dx, y: prev[target.code].y + dy },
      }))
    }
  }, [editMode, svgCoords])

  const onPointerUp = useCallback(() => {
    if (!dragRef.current) return
    dragRef.current = null
    prevRef.current = null
    saveConfig(imageSrc, hotspots, anchors)
  }, [imageSrc, hotspots, anchors])

  const copyConfig = () => {
    const json = JSON.stringify({ hotspots, anchors }, null, 2)
    navigator.clipboard.writeText(json)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    message.success('설정값 복사됨')
  }

  // 모바일: 이미지 + 계통 버튼 그리드
  if (isMobile) {
    return (
      <div>
        <div style={{
          background: 'linear-gradient(180deg, #0c1929 0%, #0f2540 65%, #081522 100%)',
          borderRadius: 8, overflow: 'hidden', marginBottom: 12,
        }}>
          <img
            src={imageSrc}
            alt="열차"
            style={{
              width: '100%', display: 'block',
              transform: flipImage ? 'scaleX(-1)' : undefined,
            }}
          />
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 8,
        }}>
          {[...hotspots].sort((a, b) => Number(a.code) - Number(b.code)).map(h => {
            const color = CATEGORY_COLORS[h.code] ?? '#999'
            const active = selectedCategory === h.code
            return (
              <button
                key={h.code}
                onClick={() => onSelectCategory(h.code)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '12px 14px',
                  borderRadius: 10,
                  border: `2px solid ${active ? color : tk.colorBorder}`,
                  background: active ? color : tk.colorBgContainer,
                  color: active ? '#fff' : tk.colorText,
                  cursor: 'pointer',
                  fontSize: 14, fontWeight: active ? 700 : 500,
                  boxShadow: active ? `0 2px 8px ${color}55` : 'none',
                  transition: 'all 0.15s',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <span style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: active ? 'rgba(255,255,255,0.25)' : color,
                  color: active ? '#fff' : '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, flexShrink: 0,
                }}>
                  {h.code}
                </span>
                <span style={{ lineHeight: 1.3 }}>{h.name}</span>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div style={{ position: 'relative' }}>
      {/* 편집 도구 */}
      {editable && (
        <div style={{
          position: 'absolute', top: 8, right: 8, zIndex: 10,
          display: 'flex', gap: 6,
        }}>
          <Button
            size="small"
            type={editMode ? 'primary' : 'default'}
            icon={<EditOutlined />}
            onClick={() => setEditMode(v => !v)}
            style={{ opacity: 0.9 }}
          >
            {editMode ? '편집 중' : '위치 편집'}
          </Button>
          {editMode && (
            <Button
              size="small"
              icon={copied ? <CheckOutlined /> : <CopyOutlined />}
              onClick={copyConfig}
              style={{ opacity: 0.9 }}
            >
              설정 복사
            </Button>
          )}
        </div>
      )}

      <svg
        ref={svgRef}
        viewBox={`0 0 ${VW} ${VH}`}
        style={{ width: '100%', userSelect: 'none', display: 'block',
          cursor: editMode ? 'default' : 'auto' }}
        xmlns="http://www.w3.org/2000/svg"
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <defs>
          <linearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#0c1929" />
            <stop offset="65%"  stopColor="#0f2540" />
            <stop offset="100%" stopColor="#081522" />
          </linearGradient>
          <linearGradient id="floorGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#1a3a5c" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#081522"  stopOpacity="0"   />
          </linearGradient>
          <radialGradient id="trainGlow" cx="50%" cy="60%">
            <stop offset="0%"   stopColor="#1e6fa8" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#000"    stopOpacity="0"    />
          </radialGradient>
          <radialGradient id="dropShadow" cx="50%" cy="50%">
            <stop offset="0%"   stopColor="#000" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#000" stopOpacity="0"    />
          </radialGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="photoShadow">
            <feDropShadow dx="0" dy="18" stdDeviation="28" floodColor="#000" floodOpacity="0.55" />
          </filter>
          <filter id="badgeShadow">
            <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#000" floodOpacity="0.4" />
          </filter>
        </defs>

        {/* 배경 */}
        <rect width={VW} height={VH} fill="url(#bgGrad)" />
        {Array.from({ length: 11 }).map((_, i) => (
          <line key={`v${i}`} x1={(i+1)*100} y1={0} x2={(i+1)*100} y2={VH}
            stroke="#fff" strokeWidth={0.3} strokeOpacity={0.04} />
        ))}
        {Array.from({ length: 5 }).map((_, i) => (
          <line key={`h${i}`} x1={0} y1={(i+1)*90} x2={VW} y2={(i+1)*90}
            stroke="#fff" strokeWidth={0.3} strokeOpacity={0.04} />
        ))}
        <ellipse cx={600} cy={320} rx={500} ry={220} fill="url(#trainGlow)" />
        <ellipse cx={700} cy={494} rx={420} ry={22} fill="url(#dropShadow)" />

        {/* 열차 사진 */}
        <g transform={flipImage ? 'translate(1200, 0) scale(-1, 1)' : undefined}>
          <image href={imageSrc}
            x={0} y={0} width={1200} height={500}
            preserveAspectRatio="xMidYMid meet"
            filter="url(#photoShadow)" />
        </g>

        <line x1={0} y1={498} x2={VW} y2={498} stroke="#1e4d7a" strokeWidth={1} strokeOpacity={0.5} />
        <rect x={0} y={498} width={VW} height={42} fill="url(#floorGrad)" />

        {/* 핫스팟 */}
        {hotspots.map((h) => {
          const anchor = anchors[h.code]
          if (!anchor) return null
          const color  = CATEGORY_COLORS[h.code] ?? '#999'
          const active = selectedCategory === h.code || hovered === h.code
          const bLeft  = h.bx - h.bw / 2
          const bTop   = h.by - BH / 2
          const lineY1 = h.by < anchor.y ? bTop + BH : bTop

          return (
            <g key={h.code}
              onClick={() => !editMode && onSelectCategory(h.code)}
              onMouseEnter={() => !editMode && setHovered(h.code)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: editMode ? 'default' : 'pointer' }}>

              {/* 연결선 */}
              <line
                x1={h.bx} y1={lineY1} x2={anchor.x} y2={anchor.y}
                stroke={color}
                strokeWidth={active ? 2 : 1.5}
                strokeDasharray={active ? '0' : '7,4'}
                strokeOpacity={active ? 1 : 0.6}
              />

              {/* 앵커 포인트 */}
              <circle cx={anchor.x} cy={anchor.y}
                r={editMode ? 10 : (active ? 6 : 4)}
                fill={color}
                stroke={editMode ? 'white' : 'rgba(255,255,255,0.5)'}
                strokeWidth={editMode ? 2 : 1.5}
                opacity={active || editMode ? 1 : 0.8}
                filter={active && !editMode ? 'url(#glow)' : undefined}
                style={{ cursor: editMode ? 'move' : undefined }}
                onPointerDown={e => onPointerDown(e, { kind: 'anchor', code: h.code })}
              />
              {editMode && (
                <text x={anchor.x} y={anchor.y + 4} textAnchor="middle"
                  fontSize={10} fill="white" style={{ pointerEvents: 'none' }}>
                  {h.code}
                </text>
              )}

              {/* 배지 */}
              <g filter="url(#badgeShadow)"
                style={{ cursor: editMode ? 'move' : undefined }}
                onPointerDown={e => onPointerDown(e, { kind: 'badge', code: h.code })}>
                <rect x={bLeft} y={bTop} width={h.bw} height={BH} rx={BH / 2}
                  fill={active ? color : 'rgba(8,18,34,0.85)'}
                  stroke={editMode ? 'white' : color}
                  strokeWidth={editMode ? 2 : (active ? 2 : 1.5)}
                  strokeOpacity={active || editMode ? 1 : 0.85}
                  strokeDasharray={editMode ? '4,2' : undefined}
                />
              </g>
              <circle cx={bLeft + BH/2} cy={h.by} r={BH/2 - 3}
                fill={active ? 'rgba(255,255,255,0.9)' : color}
                style={{ pointerEvents: 'none' }} />
              <text x={bLeft + BH/2} y={h.by + 4.5}
                textAnchor="middle" fontSize={11} fontWeight="bold"
                fill={active ? color : 'white'} style={{ pointerEvents: 'none' }}>
                {h.code}
              </text>
              <text x={bLeft + BH + (h.bw - BH) / 2} y={h.by + 4.5}
                textAnchor="middle" fontSize={10.5}
                fontWeight={active ? 'bold' : 'normal'}
                fill={active ? 'white' : '#b8cfe8'}
                style={{ pointerEvents: 'none' }}>
                {h.name}
              </text>
            </g>
          )
        })}

        {/* 편집 모드 안내 */}
        {editMode && (
          <text x={VW/2} y={VH - 10} textAnchor="middle" fontSize={11}
            fill="rgba(255,255,255,0.5)" style={{ pointerEvents: 'none' }}>
            배지와 앵커(●)를 드래그하여 위치 조정 · 설정 복사로 좌표 저장
          </text>
        )}
      </svg>
    </div>
  )
}
