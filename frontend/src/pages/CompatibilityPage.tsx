import { useState } from 'react'
import { Card, Input, Button, Table, Tag, Empty, Spin, Typography } from 'antd'
import { SearchOutlined, LinkOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { bomApi } from '../api/bom'
import { formatBomCode } from '../types'

const { Text } = Typography

export default function CompatibilityPage() {
  const [inputVal, setInputVal] = useState('')
  const [query,    setQuery]    = useState('')

  const { data: results = [], isLoading, isFetching } = useQuery({
    queryKey: ['corp-material-usages', query],
    queryFn: () => bomApi.searchByCorpMaterialNo(query),
    enabled: query.length > 0,
  })

  const handleSearch = () => {
    const q = inputVal.trim()
    if (q) setQuery(q)
  }

  const columns = [
    {
      title: '차종',
      dataIndex: 'vehicle_name',
      key: 'vehicle_name',
      width: 120,
      render: (v: string) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: 'BOM 코드',
      dataIndex: 'material_no',
      key: 'material_no',
      width: 200,
      render: (v: string) => (
        <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#1677ff' }}>
          {formatBomCode(v)}
        </span>
      ),
    },
    {
      title: '부품명',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '도면번호',
      dataIndex: 'drawing_no',
      key: 'drawing_no',
      width: 140,
      render: (v: string) => v ? <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</span> : <Text type="secondary">—</Text>,
    },
    {
      title: '제조사',
      dataIndex: 'manufacturer',
      key: 'manufacturer',
      width: 120,
      render: (v: string) => v || <Text type="secondary">—</Text>,
    },
  ]

  return (
    <Card title="호환성 관리">
      {/* 검색 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, maxWidth: 480 }}>
        <Input
          prefix={<SearchOutlined />}
          placeholder="공사 자재번호 입력 (예: KR-12345)"
          value={inputVal}
          onChange={e => setInputVal(e.target.value)}
          onPressEnter={handleSearch}
          allowClear
          onClear={() => { setInputVal(''); setQuery('') }}
        />
        <Button type="primary" onClick={handleSearch} disabled={!inputVal.trim()}>
          조회
        </Button>
      </div>

      {/* 결과 */}
      {!query ? (
        <Empty description="공사 자재번호를 입력하면 해당 자재가 사용된 모든 차종·부품 위치가 표시됩니다" />
      ) : isLoading || isFetching ? (
        <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
      ) : results.length === 0 ? (
        <Empty description={`"${query}"로 등록된 부품 없음`} />
      ) : (
        <>
          <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <LinkOutlined style={{ color: '#1677ff' }} />
            <Text strong style={{ fontSize: 14 }}>
              공사 자재번호 <span style={{ fontFamily: 'monospace', color: '#1677ff' }}>{query}</span>
            </Text>
            <Text type="secondary">— {results.length}개 부품에서 사용 중</Text>
            {results.length > 1 && (
              <Tag color="green">호환 가능</Tag>
            )}
          </div>
          <Table
            dataSource={results}
            columns={columns}
            rowKey="id"
            size="middle"
            pagination={false}
            bordered
          />
        </>
      )}
    </Card>
  )
}
