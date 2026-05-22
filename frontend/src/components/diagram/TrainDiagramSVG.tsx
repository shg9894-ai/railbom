import { useState } from 'react'
import { CATEGORY_COLORS } from '../../types'

/* ─── 치수 상수 ────────────────────────────────────────── */
const VB_W = 1260
const VB_H = 330

const NX  = 62          // 앞코 끝(좌측)
const NL  = 152         // 코 길이
const BS  = NX + NL     // 차체 시작 x  = 214
const CW  = 106         // 1량 너비
const NC  = 8           // 량수(기본)
const BT  = 78          // 차체 상단 y
const BB  = 192         // 차체 하단 y
const BH  = BB - BT     // 차체 높이 = 114

const ST  = 96          // 검정 스트라이프 상단
const SH  = 26          // 스트라이프 높이
const WY  = 108         // 창문 상단
const WH  = 44          // 창문 높이
const GLY = BB - 7      // 골드 라인 y

const BOGIE_Y = BB + 4
const AY     = BB + 28  // 차축 y
const WR     = 21       // 바퀴 반지름

/* ─── 카테고리 핫스팟 정의 ─────────────────────────────── */
interface HS { code: string; name: string; bx: number; by: number; tx: number; ty: number }

const makeHS = (nCars: number): HS[] => {
  const be = BS + nCars * CW      // 차체 끝
  const c  = (i: number) => BS + (i + 0.5) * CW   // i번째 량 중심

  return [
    // 위쪽 (열차 상단)
    { code: '4', name: '운전실·제어',  bx: c(0) - 30, by: 22, tx: c(0) - 10, ty: BT     },
    { code: '7', name: '차상신호',     bx: c(1) + 10, by: 14, tx: c(0) + 40, ty: BT - 6 },
    { code: '1', name: '전력추진',     bx: c(2) - 10, by: 14, tx: c(2) - 10, ty: BT - 16},
    { code: '8', name: '차체·설비',    bx: c(5)      , by: 14, tx: c(5),      ty: BT     },
    // 아래쪽 (대차·언더프레임)
    { code: '6', name: '주행',         bx: c(1) - 10, by: 270, tx: c(1) - 10, ty: AY + WR},
    { code: '5', name: '제동',         bx: c(3)      , by: 280, tx: c(3),      ty: AY + WR},
    { code: '3', name: '보조전원',     bx: c(5)      , by: 268, tx: c(5),      ty: BB + 2 },
    { code: '2', name: '연결',         bx: be - CW/2 , by: 270, tx: be - CW/2, ty: BB     },
  ]
}

/* ─── 팬터그래프 X형 ────────────────────────────────────── */
function Pantograph({ cx, y }: { cx: number; y: number }) {
  const H = 28, W = 22, headW = 26
  return (
    <g>
      {/* 컬렉터 헤드 */}
      <rect x={cx - headW / 2} y={y - H - 4} width={headW} height={5} rx={2}
        fill="#c9a227" stroke="#a07800" strokeWidth={1} />
      {/* X 아암 */}
      <line x1={cx - W} y1={y} x2={cx + 4}  y2={y - H} stroke="#888" strokeWidth={2.5} strokeLinecap="round" />
      <line x1={cx + W} y1={y} x2={cx - 4}  y2={y - H} stroke="#888" strokeWidth={2.5} strokeLinecap="round" />
      <line x1={cx - W} y1={y} x2={cx - 4}  y2={y - H} stroke="#bbb" strokeWidth={1.5} strokeLinecap="round" />
      <line x1={cx + W} y1={y} x2={cx + 4}  y2={y - H} stroke="#bbb" strokeWidth={1.5} strokeLinecap="round" />
      {/* 힌지 베이스 */}
      <rect x={cx - 4} y={y - 4} width={8} height={8} rx={2} fill="#555" />
    </g>
  )
}

/* ─── 대차(보기) ────────────────────────────────────────── */
function Bogie({ x }: { x: number }) {
  const fw = 38   // 프레임 너비
  return (
    <g>
      {/* 대차 프레임 */}
      <rect x={x} y={BOGIE_Y} width={fw} height={12} rx={3}
        fill="url(#bogieGrad)" stroke="#333" strokeWidth={1} />
      {/* 스프링 (사각형으로 단순화) */}
      <rect x={x + 4}  y={BOGIE_Y - 7} width={6} height={7} rx={1} fill="#666" />
      <rect x={x + fw - 10} y={BOGIE_Y - 7} width={6} height={7} rx={1} fill="#666" />
      {/* 바퀴 */}
      {[x + 8, x + fw - 8].map((wx, i) => (
        <g key={i}>
          <circle cx={wx} cy={AY} r={WR} fill="url(#wheelGrad)" stroke="#222" strokeWidth={1.5} />
          {/* 바퀴 허브 */}
          <circle cx={wx} cy={AY} r={WR * 0.38} fill="#333" stroke="#555" strokeWidth={1} />
          {/* 브레이크 디스크 효과 */}
          <circle cx={wx} cy={AY} r={WR * 0.72}
            fill="none" stroke="#555" strokeWidth={1} strokeDasharray="3,3" />
          {/* 플랜지 */}
          <circle cx={wx} cy={AY} r={WR + 2} fill="none" stroke="#444" strokeWidth={1.5} />
        </g>
      ))}
      {/* 차축 */}
      <line x1={x + 4} y1={AY} x2={x + fw - 4} y2={AY}
        stroke="#444" strokeWidth={2.5} strokeLinecap="round" />
    </g>
  )
}

/* ─── 메인 컴포넌트 ─────────────────────────────────────── */
interface Props {
  carCount?: number
  onSelectCategory: (code: string) => void
  selectedCategory?: string | null
}

export default function TrainDiagramSVG({ carCount = NC, onSelectCategory, selectedCategory }: Props) {
  const [hovered, setHovered] = useState<string | null>(null)

  const nCars  = carCount
  const be     = BS + nCars * CW       // 차체 끝
  const nx2    = be + NL               // 뒷코 끝
  const pantoX = BS + 1.5 * CW        // 팬터그래프 x (2량)

  /* 앞코 path */
  const frontNose = [
    `M ${NX},${(BT + BB) / 2}`,
    `C ${NX + 40},${BT + 10} ${NX + 90},${BT + 1} ${BS},${BT}`,
    `L ${BS},${BB}`,
    `C ${NX + 90},${BB - 1} ${NX + 40},${BB - 10} ${NX},${(BT + BB) / 2} Z`,
  ].join(' ')

  /* 앞코 스트라이프 */
  const frontStripe = [
    `M ${NX + 52},${ST + SH / 2}`,
    `C ${NX + 80},${ST} ${NX + 120},${ST} ${BS},${ST}`,
    `L ${BS},${ST + SH}`,
    `C ${NX + 120},${ST + SH} ${NX + 80},${ST + SH} ${NX + 52},${ST + SH / 2} Z`,
  ].join(' ')

  /* 뒷코 path */
  const rearNose = [
    `M ${nx2},${(BT + BB) / 2}`,
    `C ${nx2 - 40},${BT + 10} ${nx2 - 90},${BT + 1} ${be},${BT}`,
    `L ${be},${BB}`,
    `C ${nx2 - 90},${BB - 1} ${nx2 - 40},${BB - 10} ${nx2},${(BT + BB) / 2} Z`,
  ].join(' ')

  const rearStripe = [
    `M ${nx2 - 52},${ST + SH / 2}`,
    `C ${nx2 - 80},${ST} ${nx2 - 120},${ST} ${be},${ST}`,
    `L ${be},${ST + SH}`,
    `C ${nx2 - 120},${ST + SH} ${nx2 - 80},${ST + SH} ${nx2 - 52},${ST + SH / 2} Z`,
  ].join(' ')

  const hotspots = makeHS(nCars)

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      style={{ width: '100%', userSelect: 'none', display: 'block' }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* 차체 그라디언트 (위→아래, 금속 느낌) */}
        <linearGradient id="bodyGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#27c4de" />
          <stop offset="28%"  stopColor="#0fa8bf" />
          <stop offset="70%"  stopColor="#0a8fa4" />
          <stop offset="100%" stopColor="#096e80" />
        </linearGradient>
        {/* 창문 그라디언트 */}
        <linearGradient id="winGrad" x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0%"   stopColor="#d8f0f6" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#7ec8d8" stopOpacity="0.85" />
        </linearGradient>
        {/* 바퀴 그라디언트 */}
        <radialGradient id="wheelGrad" cx="35%" cy="35%">
          <stop offset="0%"   stopColor="#666" />
          <stop offset="100%" stopColor="#222" />
        </radialGradient>
        {/* 대차 그라디언트 */}
        <linearGradient id="bogieGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#666" />
          <stop offset="100%" stopColor="#333" />
        </linearGradient>
        {/* 레일 그라디언트 */}
        <linearGradient id="railGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#555" />
          <stop offset="50%"  stopColor="#aaa" />
          <stop offset="100%" stopColor="#555" />
        </linearGradient>
        {/* 지면 그림자 */}
        <linearGradient id="shadowGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#000" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#000" stopOpacity="0"   />
        </linearGradient>
        {/* 열차 전체 드롭 섀도우 필터 */}
        <filter id="trainShadow" x="-2%" y="-10%" width="104%" height="140%">
          <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#000" floodOpacity="0.2" />
        </filter>
        {/* 글로우 필터 (핫스팟 선택시) */}
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {/* 지면 그라디언트 배경 */}
        <linearGradient id="groundGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#e8f4f7" />
          <stop offset="100%" stopColor="#d0e8ed" />
        </linearGradient>
      </defs>

      {/* 배경 */}
      <rect x={0} y={0} width={VB_W} height={VB_H} fill="#f0f7fa" rx={12} />

      {/* 지면 */}
      <rect x={0} y={AY + WR + 6} width={VB_W} height={VB_H} fill="url(#groundGrad)" />

      {/* 레일 (위아래 2줄) */}
      {[AY + WR + 3, AY + WR + 9].map((ry, i) => (
        <rect key={i} x={20} y={ry} width={VB_W - 40} height={5} rx={2}
          fill="url(#railGrad)" />
      ))}
      {/* 침목 */}
      {Array.from({ length: 32 }).map((_, i) => (
        <rect key={i} x={30 + i * 38} y={AY + WR + 5} width={18} height={16} rx={2}
          fill="#8b6f47" opacity={0.55} />
      ))}

      {/* 열차 그림자 (바닥) */}
      <ellipse cx={(NX + nx2) / 2} cy={AY + WR + 4} rx={(nx2 - NX) / 2 + 20} ry={12}
        fill="url(#shadowGrad)" opacity={0.6} />

      {/* ─── 열차 차체 ─── */}
      <g filter="url(#trainShadow)">
        {/* 앞코 */}
        <path d={frontNose} fill="url(#bodyGrad)" />
        {/* 차체 본체 */}
        <rect x={BS} y={BT} width={nCars * CW} height={BH} fill="url(#bodyGrad)" />
        {/* 뒷코 */}
        <path d={rearNose} fill="url(#bodyGrad)" />

        {/* 지붕 (약간 어둡게) */}
        <rect x={BS} y={BT} width={nCars * CW} height={10} fill="#096e80" opacity={0.4} />

        {/* 검정 스트라이프 (앞코) */}
        <path d={frontStripe} fill="#0e1a35" />
        {/* 검정 스트라이프 (본체) */}
        <rect x={BS} y={ST} width={nCars * CW} height={SH} fill="#0e1a35" />
        {/* 검정 스트라이프 (뒷코) */}
        <path d={rearStripe} fill="#0e1a35" />

        {/* 골드 라인 */}
        <rect x={BS} y={GLY} width={nCars * CW} height={5} fill="#c9a227" />
        {/* 골드 라인 앞코 */}
        <path d={`M ${NX + 80},${GLY + 2} C ${NX + 100},${GLY} ${NX + 130},${GLY} ${BS},${GLY} L ${BS},${GLY + 5} C ${NX + 130},${GLY + 5} ${NX + 100},${GLY + 4} ${NX + 80},${GLY + 2} Z`}
          fill="#c9a227" />
        {/* 골드 라인 뒷코 */}
        <path d={`M ${nx2 - 80},${GLY + 2} C ${nx2 - 100},${GLY} ${nx2 - 130},${GLY} ${be},${GLY} L ${be},${GLY + 5} C ${nx2 - 130},${GLY + 5} ${nx2 - 100},${GLY + 4} ${nx2 - 80},${GLY + 2} Z`}
          fill="#c9a227" />

        {/* 차체 상단 하이라이트 (금속 광택) */}
        <rect x={BS} y={BT} width={nCars * CW} height={6} fill="white" opacity={0.12} />
        {/* 앞코 하이라이트 */}
        <path d={`M ${NX + 30},${BT + 18} C ${NX + 60},${BT + 5} ${NX + 110},${BT + 1} ${BS},${BT} L ${BS},${BT + 6} C ${NX + 110},${BT + 7} ${NX + 60},${BT + 11} ${NX + 35},${BT + 22} Z`}
          fill="white" opacity={0.12} />
      </g>

      {/* ─── 량별 디테일 ─── */}
      {Array.from({ length: nCars }).map((_, i) => {
        const cx = BS + i * CW
        const nWins = i === 0 ? 2 : 3
        const winTotalW = CW - 20
        const winW = (winTotalW - (nWins - 1) * 5) / nWins
        const winXStart = cx + 10

        return (
          <g key={i}>
            {/* 량 경계선 */}
            {i > 0 && (
              <>
                <line x1={cx} y1={BT + 6} x2={cx} y2={BB - 5}
                  stroke="#0a7a8e" strokeWidth={1.5} />
                {/* 연결기 표시 */}
                <rect x={cx - 3} y={(BT + BB) / 2 - 5} width={6} height={10} rx={2}
                  fill="#0a5560" />
              </>
            )}
            {/* 창문 */}
            {Array.from({ length: nWins }).map((_, j) => {
              const wx = winXStart + j * (winW + 5) + (i === 0 ? 8 : 0)
              return (
                <g key={j}>
                  <rect x={wx} y={WY} width={winW} height={WH} rx={4}
                    fill="url(#winGrad)" />
                  {/* 창문 반사 하이라이트 */}
                  <rect x={wx + 3} y={WY + 4} width={winW * 0.35} height={WH * 0.4} rx={2}
                    fill="white" opacity={0.4} />
                </g>
              )
            })}
            {/* 량 번호 */}
            <text x={cx + CW / 2} y={BB - 10} textAnchor="middle"
              fontSize={9} fill="white" opacity={0.6} fontWeight="bold">
              {i + 1}호
            </text>
            {/* 대차 */}
            <Bogie x={cx + 14} />
          </g>
        )
      })}

      {/* 팬터그래프 */}
      <Pantograph cx={pantoX} y={BT} />

      {/* 루프 에어컨 유닛 (4, 6량 위) */}
      {[3, 5].map(i => (
        <rect key={i} x={BS + i * CW + 20} y={BT - 8} width={CW - 40} height={8} rx={3}
          fill="#0a7a8e" stroke="#065060" strokeWidth={1} />
      ))}

      {/* 앞 헤드라이트 */}
      <ellipse cx={NX + 14} cy={(BT + BB) / 2 - 14} rx={7} ry={5}
        fill="#fffbe0" stroke="#e0c060" strokeWidth={1} opacity={0.95} />
      <ellipse cx={NX + 14} cy={(BT + BB) / 2 + 14} rx={6} ry={4}
        fill="#ff5555" stroke="#cc3333" strokeWidth={1} opacity={0.85} />

      {/* 앞 안테나 */}
      <line x1={NX + 40} y1={BT} x2={NX + 40} y2={BT - 14}
        stroke="#c9a227" strokeWidth={1.5} />
      <circle cx={NX + 40} cy={BT - 16} r={3} fill="#c9a227" />

      {/* ─── 카테고리 핫스팟 ─── */}
      {hotspots.map((h) => {
        const isSelected = selectedCategory === h.code
        const isHovered  = hovered === h.code
        const color      = CATEGORY_COLORS[h.code] ?? '#999'
        const active     = isSelected || isHovered
        const above      = h.ty < h.by

        const bw = 96, bh = 30
        const bx = h.bx - bw / 2
        const by = h.by - bh / 2

        // 연결선 끝점 (배지 위 또는 아래)
        const lineY1 = above ? by + bh : by

        return (
          <g
            key={h.code}
            onClick={() => onSelectCategory(h.code)}
            onMouseEnter={() => setHovered(h.code)}
            onMouseLeave={() => setHovered(null)}
            style={{ cursor: 'pointer' }}
          >
            {/* 연결선 */}
            <line
              x1={h.bx} y1={lineY1}
              x2={h.tx} y2={h.ty}
              stroke={color}
              strokeWidth={active ? 2 : 1.5}
              strokeDasharray={active ? '0' : '5,4'}
              opacity={active ? 1 : 0.7}
            />
            {/* 열차 위 포인트 원 */}
            <circle cx={h.tx} cy={h.ty} r={active ? 5 : 4}
              fill={color} opacity={active ? 1 : 0.6}
              filter={active ? 'url(#glow)' : undefined} />

            {/* 배지 배경 */}
            <rect
              x={bx} y={by} width={bw} height={bh} rx={bh / 2}
              fill={active ? color : 'white'}
              stroke={color}
              strokeWidth={active ? 2 : 1.5}
              opacity={active ? 1 : 0.92}
              filter={active ? 'url(#glow)' : undefined}
              style={{ transition: 'all 0.15s' }}
            />
            {/* 번호 원 */}
            <circle cx={bx + bh / 2} cy={h.by} r={bh / 2 - 3}
              fill={active ? 'white' : color} />
            <text x={bx + bh / 2} y={h.by + 4.5}
              textAnchor="middle" fontSize={11} fontWeight="bold"
              fill={active ? color : 'white'}>
              {h.code}
            </text>
            {/* 이름 텍스트 */}
            <text x={bx + bh + (bw - bh) / 2} y={h.by + 4.5}
              textAnchor="middle" fontSize={10.5}
              fontWeight={active ? 'bold' : 'normal'}
              fill={active ? 'white' : '#1a1a1a'}>
              {h.name}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
