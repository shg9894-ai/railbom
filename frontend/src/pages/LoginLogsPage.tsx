import { Table, Tag, Typography, Card } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { HistoryOutlined } from '@ant-design/icons'
import client from '../api/client'

const { Title } = Typography

interface LoginLog {
  id: number
  user_id: string
  role: string
  ip: string
  logged_in_at: string
}

export default function LoginLogsPage() {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['login-logs'],
    queryFn: () => client.get('/auth/login-logs').then(r => r.data),
    staleTime: 30_000,
  })

  const columns = [
    {
      title: '시간',
      dataIndex: 'logged_in_at',
      key: 'logged_in_at',
      render: (v: string) => new Date(v).toLocaleString('ko-KR'),
      width: 180,
    },
    {
      title: '사용자',
      dataIndex: 'user_id',
      key: 'user_id',
      width: 120,
      render: (v: string, r: LoginLog) => (
        <span>
          {v}
          {r.role === 'admin' && <Tag color="red" style={{ marginLeft: 6, fontSize: 10 }}>관리자</Tag>}
        </span>
      ),
    },
    {
      title: '권한',
      dataIndex: 'role',
      key: 'role',
      width: 100,
      render: (v: string) => (
        <Tag color={v === 'admin' ? 'red' : 'blue'}>
          {v === 'admin' ? '관리자' : '직원'}
        </Tag>
      ),
    },
    {
      title: 'IP',
      dataIndex: 'ip',
      key: 'ip',
      render: (v: string) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</span>,
    },
  ]

  return (
    <Card>
      <Title level={4} style={{ marginBottom: 20 }}>
        <HistoryOutlined style={{ marginRight: 8 }} />
        로그인 기록
      </Title>
      <Table
        dataSource={logs}
        columns={columns}
        rowKey="id"
        loading={isLoading}
        size="small"
        pagination={{ pageSize: 50, showSizeChanger: true, showTotal: (t) => `총 ${t}건` }}
      />
    </Card>
  )
}
