import { Typography, Card, Tag, Anchor, Alert, Space } from 'antd'
import { useState, useEffect } from 'react'

const { Title, Paragraph, Text } = Typography

interface Props { role?: string }

// 섹션 헤딩 — 좌측 목차에서 anchor로 연결
function H({ id, children }: { id: string; children: React.ReactNode }) {
  return <Title id={id} level={3} style={{ marginTop: 32, scrollMarginTop: 80 }}>{children}</Title>
}
function H4({ id, children }: { id: string; children: React.ReactNode }) {
  return <Title id={id} level={5} style={{ marginTop: 20, scrollMarginTop: 80 }}>{children}</Title>
}
function Mono({ children }: { children: React.ReactNode }) {
  return <Text code style={{ fontFamily: 'monospace' }}>{children}</Text>
}

export default function HelpPage({ role }: Props) {
  const isAdmin = role === 'admin'
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 900)
  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 900)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])

  const tocItems = [
    { key: 'intro', href: '#intro', title: '시스템 소개' },
    { key: 'login', href: '#login', title: '로그인 / 권한' },
    { key: 'bom-code', href: '#bom-code', title: 'BOM 코드 체계',
      children: [
        { key: 'bom-format', href: '#bom-format', title: '코드 구성 형식' },
        { key: 'bom-category', href: '#bom-category', title: '카테고리 (3번째 자리)' },
        { key: 'bom-kit', href: '#bom-kit', title: '수리키트 / 개량 표기' },
      ],
    },
    { key: 'material-no', href: '#material-no', title: '자재번호 (ecat)',
      children: [
        { key: 'mat-prefix', href: '#mat-prefix', title: '자재유형 (앞자리)' },
        { key: 'mat-sync', href: '#mat-sync', title: '동기화 주기' },
        { key: 'mat-group', href: '#mat-group', title: '용품별그룹 (BB01 등)' },
      ],
    },
    { key: 'menus', href: '#menus', title: '메뉴별 기능',
      children: [
        { key: 'menu-home',     href: '#menu-home',     title: '홈' },
        { key: 'menu-diagram',  href: '#menu-diagram',  title: '부품 탐색' },
        { key: 'menu-bom',      href: '#menu-bom',      title: 'BOM 원데이터' },
        { key: 'menu-catalog',  href: '#menu-catalog',  title: '차종별 명칭도감' },
        { key: 'menu-maint',    href: '#menu-maint',    title: '유지보수 기준' },
        { key: 'menu-mm',       href: '#menu-mm',       title: '자재 마스터' },
        { key: 'menu-offline',  href: '#menu-offline',  title: '앱 설치 / 오프라인' },
        { key: 'menu-vehicles', href: '#menu-vehicles', title: '차종·편성 관리' },
      ],
    },
    { key: 'change-req', href: '#change-req', title: '데이터 수정 요청' },
    ...(isAdmin ? [{ key: 'admin', href: '#admin', title: '관리자 기능',
      children: [
        { key: 'admin-req',   href: '#admin-req',   title: '수정 요청 승인' },
        { key: 'admin-sync',  href: '#admin-sync',  title: 'ecat 동기화 / 자재 추가' },
        { key: 'admin-logs',  href: '#admin-logs',  title: '로그인 기록' },
      ],
    }] : []),
    { key: 'faq', href: '#faq', title: '자주 묻는 질문' },
  ]

  const content = (
    <Typography>
      <Title level={2} id="intro" style={{ marginTop: 0, scrollMarginTop: 80 }}>철도차량 BOM 시스템 매뉴얼</Title>
      <Paragraph type="secondary">
        한국철도공사 차량 부품 구성 정보 통합 관리 플랫폼. KORAIL 사내 BOM·명칭도감·ecat 자재마스터를 한 곳에서 조회·관리합니다.
      </Paragraph>
      <Alert
        type="info"
        showIcon
        message="이 문서는 시스템 사용법을 처음 익히는 분을 기준으로 작성되었습니다. 잘못된 부분이나 보충이 필요한 항목이 있으면 관리자에게 알려주세요."
        style={{ marginBottom: 24 }}
      />

      <H id="login">로그인 / 권한</H>
      <Paragraph>
        <ul>
          <li><b>일반 사용자</b>: 본인 소속 <Mono>플랜트 코드</Mono>를 ID로 사용합니다 (예: <Mono>1000</Mono> 본사공통, <Mono>2100</Mono> 서울본부).</li>
          <li><b>관리자</b>: 별도 관리자 ID로 로그인. 좌측 메뉴에 <Mono>데이터 수정 승인</Mono>, <Mono>로그인 기록</Mono> 항목이 추가로 나타납니다.</li>
          <li>로그인 ID 옆 (괄호) 안에 현재 소속명이 표시됩니다.</li>
        </ul>
      </Paragraph>

      <H id="bom-code">BOM 코드 체계</H>
      <Paragraph>
        BOM 코드는 한 자재의 차종 내 위치를 한 줄로 표현하는 식별자입니다. 화면 곳곳에 파란 글씨 <Mono>HR-770-1-15-9</Mono> 형태로 표시됩니다.
      </Paragraph>

      <H4 id="bom-format">코드 구성 형식</H4>
      <Paragraph>
        <Mono>HR-770-1-15-9-0-0-0</Mono> 같은 형태에서 뒤쪽의 <Mono>-0</Mono>은 시각적으로 생략되어 <Mono>HR-770-1-15-9</Mono>로 표시됩니다.
        <br /><br />
        각 자리 의미:
        <ul>
          <li><Mono>HR</Mono> — 철도차량 BOM 식별자 (고정)</li>
          <li><Mono>770</Mono> — 차종 코드 (아래 표 참고)</li>
          <li><Mono>1</Mono> — 카테고리(대분류). 1=전력추진, 2=연결, … (다음 절 참고)</li>
          <li><Mono>15-9-…</Mono> — 차종/카테고리 안에서의 위치(조립체→부품→하위부품)</li>
        </ul>
      </Paragraph>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Text strong>차종 코드 매핑</Text>
        <ul style={{ marginTop: 8, marginBottom: 0 }}>
          <li><Mono>HR-710</Mono> KTX(1세대)</li>
          <li><Mono>HR-720</Mono> KTX-산천1</li>
          <li><Mono>HR-730</Mono> KTX-호남 (산천2)</li>
          <li><Mono>HR-740</Mono> KTX-SRT (산천3)</li>
          <li><Mono>HR-750</Mono> KTX-원강 (산천4)</li>
          <li><Mono>HR-760</Mono> KTX-이음 (EMU-260)</li>
          <li><Mono>HR-770</Mono> KTX-청룡 (EMU-320)</li>
          <li><Mono>HR-780</Mono> ITX-마음</li>
        </ul>
      </Card>

      <H4 id="bom-category">카테고리 (3번째 자리)</H4>
      <Paragraph>
        세 번째 자리 숫자가 카테고리(대분류)입니다. 부품 탐색 화면에서 색상 태그로도 표시됩니다.
      </Paragraph>
      <Space wrap size={[8, 8]} style={{ marginBottom: 16 }}>
        <Tag color="#1677ff">1 전력추진</Tag>
        <Tag color="#52c41a">2 연결</Tag>
        <Tag color="#fa8c16">3 보조전원</Tag>
        <Tag color="#722ed1">4 운전실 및 제어</Tag>
        <Tag color="#eb2f96">5 제동</Tag>
        <Tag color="#13c2c2">6 주행</Tag>
        <Tag color="#fadb14" style={{ color: '#000' }}>7 차상신호</Tag>
        <Tag color="#f5222d">8 차체 및 차내외 설비</Tag>
      </Space>

      <H4 id="bom-kit">수리키트 / 개량 표기</H4>
      <Paragraph>
        일반 조립체·부품 외에 다음과 같은 특수 노드가 있습니다.
        <ul>
          <li><b>수리키트(repair_kit)</b> — 정비 시 함께 교체되는 부품 묶음. 부품 탐색 화면에서 <Tag color="purple" style={{ margin: 0 }}>수리키트</Tag> 태그로 구분됩니다.</li>
          <li><b>키트(kit)</b> — 동일 자재번호를 공유하는 부품 그룹.</li>
          <li><b>개량 자재</b> — 기존 부품에서 변경/대체된 자재. BOM 코드 자체는 유지되며 노드의 <Mono>비고</Mono>에 개량 사유가 기록됩니다.</li>
        </ul>
      </Paragraph>

      <H id="material-no">자재번호 (ecat)</H>
      <Paragraph>
        <b>자재번호</b>는 한국철도공사 사내 자재관리시스템(ecat)에서 발급하는 7자리 코드입니다 (예: <Mono>1012665</Mono>). 우리 BOM의 각 노드는 자재번호를 통해 ecat의 자재 마스터(품명·규격·제조사·사진 등)와 연결됩니다.
      </Paragraph>

      <H4 id="mat-prefix">자재유형 (앞자리 규칙)</H4>
      <Paragraph>
        자재번호의 첫 숫자가 자재유형을 결정합니다.
        <ul>
          <li><Mono>1xxxxxx</Mono> — <b>ERSA (보수품)</b> · 정비 시 교체용으로 재고 관리</li>
          <li><Mono>6xxxxxx</Mono> — <b>ERSB (대표자재품)</b> · 같은 기능의 호환 자재 대표</li>
          <li><Mono>7xxxxxx</Mono> — <b>HIBE (비재고품)</b> · 발주 시점에만 구매</li>
        </ul>
        이 외 <Mono>UNBW</Mono>, <Mono>EXTR</Mono>, <Mono>EPA</Mono> 등 사용 안 함 유형은 자재 마스터 화면에서 기본 숨김 처리됩니다.
      </Paragraph>

      <H4 id="mat-sync">동기화 주기</H4>
      <Paragraph>
        <ul>
          <li><b>자재 상세 조회</b> — 자재마스터/부품 탐색에서 자재 클릭 시 ecat에서 <b>실시간</b>으로 가져옵니다. 동시에 우리 DB에도 캐시됩니다.</li>
          <li><b>자동 동기화</b> — 매일 새벽 <b>03:00 KST</b>에 백엔드 스케줄러가 기존 자재 정보를 ecat에서 갱신합니다.</li>
          <li><b>신규 자재 추가</b> — 관리자가 자재 마스터 화면의 <Mono>신규 자재 동기화</Mono>로 ecat 신규 발급 번호를 우리 DB로 가져옵니다.</li>
        </ul>
      </Paragraph>

      <H4 id="mat-group">용품별그룹 (BB01 등)</H4>
      <Paragraph>
        ecat의 자재그룹 분류 prefix입니다. 자재 마스터에서 이걸로 필터링할 수 있습니다.
        <ul>
          <li><Mono>BB01</Mono>~<Mono>BB13</Mono> — 차종별 보수품 (BB01 KTX1, BB02 디젤동차, … BB12 KTX-산천)</li>
          <li><Mono>AA</Mono>~<Mono>FF</Mono>, <Mono>II</Mono> — 보수품 계열</li>
          <li><Mono>GG</Mono>, <Mono>JJ</Mono>, <Mono>KK</Mono> — 대표자재 / 비재고품 계열</li>
        </ul>
      </Paragraph>

      <H id="menus">메뉴별 기능</H>

      <H4 id="menu-home">홈</H4>
      <Paragraph>
        시스템 전체 통계(등록 차종 8종, BOM 노드 수, 명칭도감 페이지 수)와 차종별 현황 카드. 카드를 누르면 해당 차종의 부품 탐색 화면으로 바로 이동합니다.
      </Paragraph>

      <H4 id="menu-diagram">부품 탐색</H4>
      <Paragraph>
        가장 자주 쓰는 화면입니다. 차종 선택 → 카테고리 → 조립체 → 부품 순으로 드릴다운합니다.
        <ul>
          <li><b>좌측 사이드/상단 차종 셀렉터</b> — 8개 차종 중 선택</li>
          <li><b>카테고리 칩</b> (1전력추진~8차체) — 화면 상단</li>
          <li><b>조립체 / 부품 목록</b> — 카드 형태. 우측 <Tag color="blue" style={{ margin: 0 }}>{'>'}</Tag> 화살표 또는 카드 자체를 누르면 자식 부품으로 들어갑니다.</li>
          <li><b>최상위 / 부품 탐색으로</b> 버튼 — 화면 상단 우측. 한 단계 위/처음으로 이동.</li>
          <li><b>검색창</b> — 현재 단계의 자식 노드 중 자재명/자재번호/도면번호/제조자 PN으로 즉시 필터.</li>
          <li><b>ecat ↗ 배지</b> (PC에서만) — 공사 자재번호가 연결된 노드에서 ecat 외부 페이지로 새 창. <i>모바일은 ecat 서버가 차단해서 자동 숨김.</i></li>
          <li><b>부품 상세</b> — 부품 카드 클릭 시 우측에 자재 상세 모달. 자재번호·규격·제조사·도면번호·사진·호환 차종 등이 표시됩니다.</li>
        </ul>
      </Paragraph>

      <H4 id="menu-bom">BOM 원데이터</H4>
      <Paragraph>
        차종 전체 BOM을 트리 형태로 한 번에 펼쳐서 조회. Excel 내보내기 가능. 호환 코드(같은 자재번호를 공유하는 타 차종) 클릭 시 한 번에 비교 모달이 뜹니다. 관리자라면 노드 추가/수정/삭제도 가능합니다.
      </Paragraph>

      <H4 id="menu-catalog">차종별 명칭도감</H4>
      <Paragraph>
        명칭도감(제작사 도면집)의 페이지를 직접 조회. 도면 페이지를 BOM 노드와 연결해 두면 부품 탐색에서 <Tag color="blue" style={{ margin: 0 }}>📘</Tag> 아이콘으로 바로 펼쳐 볼 수 있습니다. 관리자만 페이지-BOM 연결을 등록/수정할 수 있습니다.
      </Paragraph>

      <H4 id="menu-maint">유지보수 기준</H4>
      <Paragraph>
        부품별 정비 주기·교체 기준 등을 조회. 차종/카테고리/부품명으로 검색할 수 있습니다.
      </Paragraph>

      <H4 id="menu-mm">자재 마스터</H4>
      <Paragraph>
        ecat의 전체 자재 마스터(약 13만 건)를 검색하는 화면. SAP MM 데이터와 ecat 실시간 정보가 합쳐져 있습니다.
        <ul>
          <li><b>통계 카드</b> — 전체/사용중/미사용/보수품(ERSA) 자재 수</li>
          <li><b>검색창</b> — 자재번호·자재내역·제조자 PN·기존자재번호 어느 것으로도 검색</li>
          <li><b>용품별그룹 / 자재유형 필터</b> — BB12, ERSA 같은 분류로 좁히기</li>
          <li><b>미사용 포함 스위치</b> — 기본 OFF (사용중 자재만). 켜면 폐기 자재도 포함</li>
          <li><b>이동 버튼</b> (PC 전용) — ecat 외부 페이지로 새 창</li>
          <li><b>자재 클릭</b> — ecat에서 사진·속성·내역을 실시간으로 가져와 상세 모달 표시</li>
        </ul>
      </Paragraph>

      <H4 id="menu-offline">앱 설치 / 오프라인</H4>
      <Paragraph>
        <ul>
          <li><b>휴대폰 설치</b> — Safari/Chrome에서 페이지를 연 뒤 공유 → "홈 화면에 추가". 다음부터는 일반 앱처럼 실행됩니다.</li>
          <li><b>명칭도감 오프라인 다운로드</b> — 차종별로 명칭도감 이미지(50~200MB)를 폰에 저장. 인터넷이 안 되는 차량 안에서도 도면을 봅니다.</li>
          <li><b>전체 다운로드</b> 버튼 — 모든 차종 한 번에. 저장 용량과 데이터 사용량에 유의하세요.</li>
        </ul>
      </Paragraph>

      <H4 id="menu-vehicles">차종·편성 관리</H4>
      <Paragraph>
        <ul>
          <li><b>차종 관리</b> — 8개 차종의 기본 정보(제작사·도입연도·중량 등) 조회</li>
          <li><b>편성 관리</b> — 각 차종의 편성(예: KTX 1편성=10량) 관리. 활성/정비/퇴역 상태 구분.</li>
        </ul>
      </Paragraph>

      <H id="change-req">데이터 수정 요청</H>
      <Paragraph>
        일반 사용자는 데이터를 직접 수정할 수 없지만, 잘못된 자재번호·사진·BOM 연결 등에 대해 <b>수정 요청</b>을 보낼 수 있습니다.
        <ul>
          <li>부품 탐색의 노드 상세에서 <b>공사 자재번호 / 사진 / BOM 코드</b>에 대해 <Mono>수정 요청</Mono> 버튼 사용</li>
          <li>요청은 관리자가 확인 후 승인/반려합니다.</li>
          <li>승인된 변경 사항은 자동으로 반영됩니다.</li>
        </ul>
      </Paragraph>

      {isAdmin && (
        <>
          <H id="admin">관리자 기능</H>
          <Alert
            type="warning"
            showIcon
            message="이 섹션은 관리자 권한에서만 표시됩니다."
            style={{ marginBottom: 16 }}
          />

          <H4 id="admin-req">수정 요청 승인 (좌측 메뉴: 데이터 수정 승인)</H4>
          <Paragraph>
            일반 사용자가 제출한 자재번호/사진/BOM 변경 요청을 검토합니다.
            <ul>
              <li>대기 중 요청 목록에서 내용 확인 → <Mono>승인</Mono> 또는 <Mono>반려</Mono></li>
              <li>승인 시 실제 BOM 데이터에 즉시 반영됩니다. 반려는 사유를 적어주세요.</li>
              <li>처리 이력은 같은 화면에서 필터로 조회할 수 있습니다.</li>
            </ul>
          </Paragraph>

          <H4 id="admin-sync">ecat 동기화 / 자재 추가</H4>
          <Paragraph>
            <ul>
              <li><b>매일 03:00 자동 동기화</b> — 기존 자재의 ecat 정보가 갱신됨. 별도 조작 불필요.</li>
              <li><b>신규 자재 동기화</b> — 자재 마스터 화면 우측 상단 버튼. ecat에 새로 발급된 자재번호를 우리 DB로 가져옵니다.
                <ul>
                  <li><b>시작 번호</b>: 0이면 DB의 최대 자재번호 + 1부터. 특정 번호 지정 가능.</li>
                  <li><b>개수</b>: 한 번에 스캔할 번호 수 (기본 1000)</li>
                  <li><b>동시 요청 수</b>: 20 (조정 불가)</li>
                </ul>
              </li>
              <li>관리자 ID로만 호출됩니다 (일반 사용자에겐 버튼이 안 보임).</li>
            </ul>
          </Paragraph>

          <H4 id="admin-logs">로그인 기록 (좌측 메뉴)</H4>
          <Paragraph>
            전 사용자의 로그인 시각·IP·성공/실패를 조회. 보안 점검용입니다.
          </Paragraph>
        </>
      )}

      <H id="faq">자주 묻는 질문</H>
      <Paragraph>
        <H4 id="faq-1">Q. 모바일에서 "ecat에서 보기"를 누르면 "허용되지 않는 요청" 에러가 나요.</H4>
        ecat 서버가 모바일 User-Agent의 자재 상세 페이지 접근을 차단합니다. 우리가 우회할 수 없어 모바일에선 ecat 외부 링크 버튼을 숨겨두었습니다. 자재 사진·속성·내역은 우리 앱의 상세 모달에 그대로 표시되니 그대로 보시면 됩니다.

        <H4 id="faq-2">Q. 휴대폰에서 화면이 옛날 그대로 보여요.</H4>
        PWA 캐시 문제일 수 있습니다. 홈 화면의 앱을 삭제 → Safari 설정에서 "방문 기록 및 웹사이트 데이터 지우기" → 다시 접속 → "홈 화면에 추가" 순으로 재설치하세요. 이번 버전부터는 자동 갱신이 동작합니다.

        <H4 id="faq-3">Q. 부품 탐색에서 부품 사진이 안 떠요.</H4>
        ecat에 사진이 등록 안 된 자재이거나, 일시적 네트워크 오류일 수 있습니다. 사진이 있는데도 안 뜨면 새로고침 후 다시 시도하세요.

        <H4 id="faq-4">Q. BOM 코드가 잘못된 것 같아요.</H4>
        부품 상세 화면의 <Mono>수정 요청</Mono> 버튼으로 변경을 제안하세요. 관리자가 검토 후 반영합니다.
      </Paragraph>
    </Typography>
  )

  if (isMobile) {
    return (
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        {/* 모바일은 목차 없이 본문만 */}
        {content}
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', gap: 24, maxWidth: 1200, margin: '0 auto', alignItems: 'flex-start' }}>
      <div style={{ flex: 1, minWidth: 0 }}>{content}</div>
      <div style={{ width: 240, flexShrink: 0, position: 'sticky', top: 80 }}>
        <Anchor
          affix={false}
          items={tocItems}
          getContainer={() => document.querySelector('div[style*="overflowY: auto"], div[style*="overflow-y"]') as HTMLElement || window as any}
        />
      </div>
    </div>
  )
}
