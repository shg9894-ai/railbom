import { useState } from 'react'
import { Form, Input, Button, Card, Typography, Alert } from 'antd'
import { LockOutlined, UserOutlined } from '@ant-design/icons'

const { Title, Text } = Typography

const API_BASE = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api'

interface Props {
  onLogin: (token: string, role: string, userId: string) => void
}

export default function LoginPage({ onLogin }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (values: { user_id: string; password: string }) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.detail || '로그인 실패')
        return
      }
      const data = await res.json()
      localStorage.setItem('token', data.token)
      localStorage.setItem('role', data.role)
      localStorage.setItem('user_id', data.user_id)
      onLogin(data.token, data.role, data.user_id)
    } catch {
      setError('서버 연결 오류')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#f0f2f5',
    }}>
      <Card style={{ width: 380, boxShadow: '0 4px 24px rgba(0,0,0,0.10)' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Title level={3} style={{ margin: 0 }}>철도차량 BOM 시스템</Title>
          <Text type="secondary">한국철도공사</Text>
        </div>
        {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />}
        <Form layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="user_id" label="플랜트 코드 / 관리자 ID" rules={[{ required: true, message: '입력해주세요' }]}>
            <Input prefix={<UserOutlined />} placeholder="플랜트 코드 입력" size="large" />
          </Form.Item>
          <Form.Item name="password" label="비밀번호" rules={[{ required: true, message: '입력해주세요' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="비밀번호 입력" size="large" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" block size="large" loading={loading}>
              로그인
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}
