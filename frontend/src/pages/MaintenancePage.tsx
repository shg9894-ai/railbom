import { useState } from 'react'
import { Card, Tabs, Table, Tag, Typography, Select, Space } from 'antd'
import { ToolOutlined, ThunderboltOutlined } from '@ant-design/icons'
import {
  MAINT_CODES, MAINT_GROUPS, AIR_HOSE_CYCLES, VT_TO_MAINT_GROUP,
} from '../data/maintenanceStandards'

const { Title, Text, Paragraph } = Typography

// 시스템에 BOM 등록된 차종 (in_system=TRUE)
const SYSTEM_VEHICLES: { code: string; name: string }[] = [
  { code: 'KTX-1',     name: 'KTX(1세대)' },
  { code: 'KTX-산천1', name: 'KTX-산천Ⅰ' },
  { code: 'KTX-산천2', name: 'KTX-호남' },
  { code: 'KTX-산천3', name: 'KTX-SRT' },
  { code: 'KTX-산천4', name: 'KTX-원강' },
  { code: 'EMU-260',   name: 'KTX-이음' },
  { code: 'EMU-320',   name: 'KTX-청룡' },
  { code: 'ITX-마음',  name: 'ITX-마음' },
]

export default function MaintenancePage() {
  const [tab, setTab] = useState('cycles')
  const [groupId, setGroupId] = useState<string>(MAINT_GROUPS[0].id)

  const group = MAINT_GROUPS.find(g => g.id === groupId)

  // 현재 선택된 정비기준에 매핑된 시스템 차종
  const matchedVehicles = SYSTEM_VEHICLES.filter(
    v => VT_TO_MAINT_GROUP[v.code] === groupId
  )

  // 시스템 차종 → 정비기준 빠른 이동
  const jumpTo = (vehicleCode: string) => {
    const gid = VT_TO_MAINT_GROUP[vehicleCode]
    if (gid) {
      setGroupId(gid)
      setTab('cycles')
    }
  }

  return (
    <div style={{ padding: 0 }}>
      <Title level={4} style={{ marginBottom: 4 }}>
        <ToolOutlined style={{ marginRight: 8, color: '#1677ff' }} />
        유지보수 기준
      </Title>
      <Text type="secondary" style={{ fontSize: 12 }}>
        한국철도공사 「철도차량 유지보수 세칙」 기준 (2026.01.29 개정 별표1·2·3)
      </Text>

      {/* 시스템 차종 → 정비기준 빠른 이동 */}
      <Card
        size="small"
        style={{ marginTop: 16, marginBottom: 8 }}
        title={
          <Space size={6}>
            <ThunderboltOutlined style={{ color: '#fa8c16' }} />
            <span style={{ fontSize: 13 }}>시스템 등록 차종에서 바로 보기</span>
          </Space>
        }
      >
        <Space wrap size={6}>
          {SYSTEM_VEHICLES.map(v => {
            const gid = VT_TO_MAINT_GROUP[v.code]
            const isCurrent = gid === groupId && tab === 'cycles'
            return (
              <Tag
                key={v.code}
                color={isCurrent ? 'blue' : gid ? 'default' : 'red'}
                style={{ cursor: gid ? 'pointer' : 'not-allowed', fontSize: 12, padding: '2px 8px' }}
                onClick={() => gid && jumpTo(v.code)}
              >
                {v.name}
                <Text type="secondary" style={{ marginLeft: 4, fontSize: 11 }}>{v.code}</Text>
              </Tag>
            )
          })}
        </Space>
      </Card>

      <Tabs
        activeKey={tab}
        onChange={setTab}
        style={{ marginTop: 8 }}
        items={[
          {
            key: 'cycles',
            label: '차종별 정비주기',
            children: (
              <div>
                <Card size="small" style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <Text style={{ fontWeight: 600 }}>차종군 선택:</Text>
                    <Select
                      value={groupId}
                      onChange={setGroupId}
                      style={{ width: 360 }}
                      options={MAINT_GROUPS.map(g => ({
                        value: g.id,
                        label: g.name,
                      }))}
                    />
                    {matchedVehicles.length > 0 ? (
                      <Space size={4} wrap>
                        <Text type="secondary" style={{ fontSize: 12 }}>적용 시스템 차종:</Text>
                        {matchedVehicles.map(v => (
                          <Tag key={v.code} color="blue" style={{ fontSize: 11 }}>{v.name}</Tag>
                        ))}
                      </Space>
                    ) : (
                      <Tag color="default" style={{ fontSize: 11 }}>시스템 등록 차종 없음</Tag>
                    )}
                  </div>
                </Card>

                {group && (
                  <Card size="small" title={`${group.name} 정비주기`}>
                    <Table
                      size="small"
                      dataSource={group.cycles.map((c, i) => ({ ...c, key: i }))}
                      pagination={false}
                      scroll={{ x: 900 }}
                      columns={[
                        { title: '정비종류', dataIndex: 'type', width: 130 },
                        {
                          title: '약호',
                          dataIndex: 'code',
                          width: 90,
                          render: (v: string) => (
                            <Tag color="geekblue" style={{ fontFamily: 'monospace', margin: 0 }}>{v}</Tag>
                          ),
                        },
                        {
                          title: '운행거리 (km)',
                          dataIndex: 'distance',
                          width: 180,
                          render: (v?: string) =>
                            v ? <Text strong style={{ whiteSpace: 'nowrap' }}>{v}</Text> : <Text type="secondary">-</Text>,
                        },
                        {
                          title: '운행기간',
                          dataIndex: 'period',
                          width: 110,
                          render: (v?: string) =>
                            v ? <Text style={{ whiteSpace: 'nowrap' }}>{v}</Text> : <Text type="secondary">-</Text>,
                        },
                        {
                          title: '비고',
                          dataIndex: 'note',
                          width: 320,
                          render: (v?: string) =>
                            v ? <Text type="secondary" style={{ fontSize: 12 }}>{v}</Text> : null,
                        },
                      ]}
                    />
                  </Card>
                )}
              </div>
            ),
          },
          {
            key: 'codes',
            label: '정비 약호',
            children: (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))', gap: 12 }}>
                <Card size="small" title="고속차량 정비 약호">
                  <Table
                    size="small"
                    dataSource={MAINT_CODES.highspeed.map((c, i) => ({ ...c, key: i }))}
                    pagination={false}
                    scroll={{ x: 420 }}
                    columns={[
                      {
                        title: '약호', dataIndex: 'code', width: 70,
                        render: (v: string) => <Tag color="blue" style={{ fontFamily: 'monospace', margin: 0 }}>{v}</Tag>,
                      },
                      {
                        title: '원어', dataIndex: 'en', width: 220,
                        render: (v: string) =>
                          <Text style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{v}</Text>,
                      },
                      { title: '정비명', dataIndex: 'ko', width: 120 },
                    ]}
                  />
                </Card>
                <Card size="small" title="일반차량·전동차량 정비 약호">
                  <Table
                    size="small"
                    dataSource={MAINT_CODES.general.map((c, i) => ({ ...c, key: i }))}
                    pagination={false}
                    scroll={{ x: 480 }}
                    columns={[
                      {
                        title: '약호', dataIndex: 'code', width: 70,
                        render: (v: string) => <Tag color="green" style={{ fontFamily: 'monospace', margin: 0 }}>{v}</Tag>,
                      },
                      {
                        title: '원어', dataIndex: 'en', width: 200,
                        render: (v: string) =>
                          <Text style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{v}</Text>,
                      },
                      { title: '정비명', dataIndex: 'ko', width: 130 },
                      {
                        title: '비고', dataIndex: 'note', width: 110,
                        render: (v?: string) =>
                          v ? <Text type="secondary" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{v}</Text> : null,
                      },
                    ]}
                  />
                </Card>
              </div>
            ),
          },
          {
            key: 'airhose',
            label: '공기호스 교체주기',
            children: (
              <Card size="small" title="별표3: 차종별 공기호스 교체주기">
                <Paragraph type="secondary" style={{ fontSize: 12 }}>
                  세칙 제9조 제2호 관련. 교체주기는 해당 중정비 도래시 교체.
                </Paragraph>
                <Table
                  size="small"
                  dataSource={AIR_HOSE_CYCLES.map((c, i) => ({ ...c, key: i }))}
                  pagination={false}
                  columns={[
                    {
                      title: '구분', dataIndex: 'group', width: 140,
                      render: (v: string) => {
                        const color =
                          v === '고속차량' ? 'volcano' :
                          v === '간선형전기동차' ? 'purple' :
                          v === '전기동차' ? 'magenta' :
                          'orange'
                        return <Tag color={color} style={{ whiteSpace: 'nowrap' }}>{v}</Tag>
                      },
                    },
                    { title: '차종', dataIndex: 'vehicleType' },
                    {
                      title: '교체주기 (년)', dataIndex: 'years', width: 130,
                      render: (v: number) => <Text strong style={{ color: '#1677ff' }}>{v}년</Text>,
                    },
                    {
                      title: '정비단계', dataIndex: 'stage', width: 100,
                      render: (v: string) => <Tag color="default" style={{ fontFamily: 'monospace' }}>{v}</Tag>,
                    },
                    {
                      title: '비고', dataIndex: 'note',
                      render: (v?: string) => v ? <Text type="secondary" style={{ fontSize: 12 }}>{v}</Text> : null,
                    },
                  ]}
                />
              </Card>
            ),
          },
          {
            key: 'terms',
            label: '용어 정의',
            children: (
              <Card size="small">
                <Paragraph type="secondary" style={{ fontSize: 12 }}>
                  세칙 제3조 — 용어 정의 (발췌)
                </Paragraph>
                <Table
                  size="small"
                  pagination={false}
                  dataSource={[
                    { key: 1, term: '한시정비', def: '천재지변 등 이례사항 발생으로 정상적인 업무 수행이 어려운 경우 정비항목을 생략 또는 축소 조정' },
                    { key: 2, term: '반복정비', def: '열차 운행경로의 시·종착역에서 반복운행을 대비한 차량의 필수적인 기능상태 확인·점검' },
                    { key: 3, term: '일일점검', def: '차량정비기지에서 출발 전에 팬터그래프 및 주요장치 기능상태 확인·점검' },
                    { key: 4, term: '기본정비', def: '주요 장치부 기능상태 확인, 윤활유 보충, 소모품 교체 등 기본적 성능 확보' },
                    { key: 5, term: '경정비',   def: '주요장치 및 각 부의 기능상태 점검, 주요 구성부품 및 소모품 교체' },
                    { key: 6, term: '중정비',   def: '차량 전반에 대한 분해, 부품교체, 시험검사 및 측정, 시험운전 등 종합 성능 확보' },
                    { key: 7, term: '최초정비', def: '신규 제작·도입 후 일정거리(예: 1,600 km) 운행 후 구동기어유 교환 등' },
                    { key: 8, term: '제1한도',  def: '중정비시 교환 또는 수선을 요하지 않는 한계치수' },
                    { key: 9, term: '제2한도',  def: '경정비시 교환 또는 수선을 요하지 않는 한계치수' },
                    { key:10, term: '제3한도',  def: '사용을 허용할 수 있는 한도' },
                    { key:11, term: '편심량',   def: '축심에서 원주까지 치수차의 최대량' },
                    { key:12, term: '전식(電蝕)', def: '금속이 전기·화학적 작용으로 누설전류의 전기분해작용으로 부식되는 현상' },
                    { key:13, term: '비파괴검사', def: '기계나 장치 내부의 기공·균열 등 결함을 검사 (초음파/자분/액상침투/음향)' },
                  ]}
                  columns={[
                    { title: '용어', dataIndex: 'term', width: 140, render: (v: string) => <Text strong>{v}</Text> },
                    { title: '정의', dataIndex: 'def' },
                  ]}
                />
              </Card>
            ),
          },
        ]}
      />
    </div>
  )
}
