import { useState } from 'react'
import { Input, Table, Tag, Select, Space, Typography, Card, Button, Tooltip } from 'antd'
import { SearchOutlined, ApartmentOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { bomApi } from '../api/bom'
import { vehicleApi } from '../api/vehicles'
import { CATEGORIES, CATEGORY_COLORS } from '../types'
import type { BomNode } from '../types'

const { Text } = Typography

type SearchResult = BomNode & { vehicle_name: string; vehicle_code: string }

const NODE_TYPE_LABEL: Record<string, string> = {
  category: '계통',
  assembly: '조립체',
  part: '부품',
  kit: '키트',
}

export default function SearchPage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [submitted, setSubmitted] = useState('')
  const [filterVehicle, setFilterVehicle] = useState<number | undefined>()

  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn: vehicleApi.list,
  })

  const { data: results = [], isFetching } = useQuery({
    queryKey: ['search-global', submitted, filterVehicle],
    queryFn: () => bomApi.searchGlobal(submitted, filterVehicle),
    enabled: submitted.length >= 1,
  })

  const columns = [
    {
      title: '차종',
      dataIndex: 'vehicle_name',
      width: 110,
      render: (_: string, r: SearchResult) => (
        <Tag color="#1F4E79" style={{ color: '#fff' }}>{r.vehicle_code}</Tag>
      ),
    },
    {
      title: '계통',
      dataIndex: 'category_code',
      width: 90,
      render: (code: string) => {
        const cat = CATEGORIES.find((c) => c.code === code)
        return code ? <Tag color={CATEGORY_COLORS[code]}>{cat?.name ?? code}</Tag> : '—'
      },
    },
    {
      title: '구분',
      dataIndex: 'node_type',
      width: 70,
      render: (t: string) => <Text type="secondary">{NODE_TYPE_LABEL[t] ?? t}</Text>,
    },
    {
      title: '자재내역',
      dataIndex: 'name',
      render: (name: string, r: SearchResult) => (
        <div>
          <div>{name}</div>
          {r.name_en && <Text type="secondary" style={{ fontSize: 11 }}>{r.name_en}</Text>}
        </div>
      ),
    },
    {
      title: '도면번호',
      dataIndex: 'drawing_no',
      width: 160,
      render: (v: string, r: SearchResult) => {
        const val = v || r.manufacturer_pn
        return val ? <Text code style={{ fontSize: 11 }}>{val}</Text> : '—'
      },
    },
    {
      title: 'BOM 코드',
      dataIndex: 'material_no',
      width: 120,
      render: (v: string) => v ? <Text code style={{ fontSize: 11 }}>{v}</Text> : '—',
    },
    {
      title: '공사자재번호',
      dataIndex: 'corp_material_no',
      width: 120,
      render: (v: string) => v ? <Text code style={{ fontSize: 11 }}>{v}</Text> : '—',
    },
    {
      title: '단위',
      dataIndex: 'unit',
      width: 60,
      render: (v: string) => v ?? '—',
    },
    {
      title: '',
      key: 'goto',
      width: 80,
      render: (_: unknown, r: SearchResult) => (
        <Tooltip title="BOM 트리에서 열기">
          <Button
            size="small"
            type="link"
            icon={<ApartmentOutlined />}
            onClick={() => navigate(`/bom?vehicleId=${r.vehicle_type_id}&nodeId=${r.id}`)}
          >
            보기
          </Button>
        </Tooltip>
      ),
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: 'calc(100vh - 112px)' }}>
      <Card size="small">
        <Space style={{ width: '100%' }} direction="vertical" size={8}>
          <div style={{ display: 'flex', gap: 8 }}>
            <Input
              prefix={<SearchOutlined />}
              placeholder="부품명, 도면번호, OEM PN, 공사자재번호 검색..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onPressEnter={() => setSubmitted(query)}
              allowClear
              style={{ flex: 1 }}
              size="large"
            />
            <Select
              placeholder="전체 차종"
              allowClear
              style={{ width: 180 }}
              size="large"
              options={vehicles.map((v) => ({ value: v.id, label: `${v.name} (${v.code})` }))}
              value={filterVehicle}
              onChange={(v) => { setFilterVehicle(v); if (submitted) setSubmitted(query) }}
            />
          </div>
          {submitted && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              "{submitted}" 검색 결과: {results.length}건{results.length === 200 ? ' (최대 200건 표시)' : ''}
            </Text>
          )}
        </Space>
      </Card>

      <Card size="small" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
        styles={{ body: { flex: 1, overflow: 'hidden', padding: 0 } }}>
        <Table<SearchResult>
          dataSource={results}
          columns={columns}
          rowKey="id"
          size="small"
          loading={isFetching}
          pagination={{ pageSize: 50, showSizeChanger: true, pageSizeOptions: ['50', '100', '200'] }}
          scroll={{ y: 'calc(100vh - 280px)' }}
          locale={{ emptyText: submitted ? '검색 결과가 없습니다' : '검색어를 입력하고 Enter를 누르세요' }}
        />
      </Card>
    </div>
  )
}
