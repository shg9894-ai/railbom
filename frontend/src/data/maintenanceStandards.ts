/**
 * 철도차량 유지보수 세칙 별표 데이터 (2026.01.29 개정)
 * 출처: 한국철도공사 「철도차량 유지보수 세칙」 별표1·2·3
 */

// 정비 약호 정의
export const MAINT_CODES = {
  highspeed: [
    { code: 'ES',   en: 'Examination Service',           ko: '기본정비' },
    { code: 'CE',   en: 'Comfort Examination',           ko: '실내설비정비' },
    { code: 'RGI',  en: 'Running Gear Inspection',       ko: '주행기어정비' },
    { code: 'MI',   en: 'Major Inspection',              ko: '주요정비' },
    { code: 'SWT',  en: 'Systematic Works on Train-set', ko: '체계정비' },
    { code: 'S-SWT',en: 'Season-SWT',                    ko: '계절정비' },
    { code: 'P-SWT',en: 'Period-SWT',                    ko: '기타주기정비' },
    { code: 'LI',   en: 'Limited Inspection',            ko: '제한정비' },
    { code: 'GI',   en: 'General Inspection',            ko: '일반정비' },
    { code: 'FGI',  en: 'Full General Inspection',       ko: '전반정비' },
    { code: 'RBO',  en: 'Replace Between Overhaul',      ko: '부품교환정비' },
    { code: 'ECO',  en: 'Equipment Component Overhaul',  ko: '부품분해정비' },
    { code: 'CEO',  en: 'Comfort Esthetic Operation',    ko: '객실설비개선' },
    { code: 'HLO',  en: 'Half Life Operation',           ko: '반수명정비' },
    { code: 'WT',   en: 'Wheel Turning',                 ko: '차륜삭정' },
    { code: 'T',    en: 'Temporarily Repair',            ko: '임시정비' },
    { code: 'R',    en: 'Restoring Repair',              ko: '특종정비' },
  ],
  general: [
    { code: 'RS',  en: 'Return Service',         ko: '반복정비', note: '한, 일반차량' },
    { code: 'ES',  en: 'Examination Service',    ko: '일상정비' },
    { code: 'LI',  en: 'Limited Inspection',     ko: '제한정비(경정비)' },
    { code: 'GI',  en: 'General Inspection',     ko: '일반정비(중정비)' },
    { code: 'IOE', en: 'Initial Oil Exchange',   ko: '최초정비', note: '한, 전기차량' },
    { code: 'NWC', en: 'New Wheel Change',       ko: '차륜교환' },
    { code: 'WT',  en: 'Wheel Turning',          ko: '차륜삭정' },
    { code: 'T',   en: 'Temporarily Repair',     ko: '임시정비' },
    { code: 'R',   en: 'Restoring Repair',       ko: '특종정비' },
  ],
}

// 우리 시스템 차종 ↔ 정비기준 차종군 매핑
// 동력집중식: KTX-1, KTX-산천Ⅰ~Ⅳ (양 끝 동력차 구조)
// 동력분산식: KTX-이음(EMU-260), KTX-청룡(EMU-320) - EMU 자체가 분산식
export const VT_TO_MAINT_GROUP: Record<string, string> = {
  'KTX-1':     'highspeed_concentrated', // 동력집중식
  'KTX-산천1': 'highspeed_concentrated', // 동력집중식
  'KTX-산천2': 'highspeed_concentrated', // 동력집중식 (호남)
  'KTX-산천3': 'highspeed_concentrated', // 동력집중식 (SRT)
  'KTX-산천4': 'highspeed_concentrated', // 동력집중식 (원강)
  'EMU-260':   'highspeed_distributed',  // 동력분산식 (이음)
  'EMU-320':   'highspeed_distributed',  // 동력분산식 (청룡)
  'ITX-마음':  'itx',                    // 간선형 (ITX-새마을·마음)
}

// 차종별 정비주기
export interface MaintCycle {
  type: string         // 정비종류
  code: string         // 약호
  distance?: string    // 운행거리 km
  period?: string      // 운행기간
  note?: string
}

export interface MaintGroup {
  id: string
  name: string
  category: string     // 고속차량 / 일반차량 / 광역차량
  cycles: MaintCycle[]
}

export const MAINT_GROUPS: MaintGroup[] = [
  {
    id: 'highspeed_concentrated',
    name: '동력집중식 고속차량',
    category: '고속차량',
    cycles: [
      { type: '기본정비',       code: 'ES',     distance: '5,000 (최대)' },
      { type: '실내설비정비',   code: 'CE',     distance: '20,000 (최대)', period: '14일' },
      { type: '주행기어정비',   code: 'RGI',    distance: '20,000 (최대)', period: '14일' },
      { type: '체계정비',       code: 'SWT',    distance: '50,000~55,000' },
      { type: '계절정비',       code: 'S-SWT',  note: '하절기 및 동절기 전과 기간 중' },
      { type: '기타주기정비',   code: 'P-SWT',  note: '장치별 주기 도래시' },
      { type: '제한정비',       code: 'LI',     distance: '150,000~165,000', period: '4개월' },
      { type: '일반정비',       code: 'GI',     distance: '300,000~330,000', period: '8개월' },
      { type: '전반정비',       code: 'FGI',    distance: '600,000~660,000', period: '16개월' },
      { type: '부품교환정비',   code: 'RBO',    note: '부품조립체 ECO를 위한 교환시' },
      { type: '부품분해정비',   code: 'ECO',    note: '부품조립체 오버홀 도래시' },
      { type: '객실설비개선',   code: 'CEO',    note: '설비 개선 필요시' },
      { type: '반수명정비',     code: 'HLO',    period: '15년 운행 전후 (±20%)' },
      { type: '임시정비',       code: 'T',      note: '수시' },
      { type: '특종정비',       code: 'R',      note: '수시' },
      { type: '차륜삭정',       code: 'WT',     note: '고속차량 차륜유지보수매뉴얼의 결함별 등급 해당시' },
    ],
  },
  {
    id: 'highspeed_distributed',
    name: '동력분산식 고속차량',
    category: '고속차량',
    cycles: [
      { type: '기본정비',     code: 'ES',  distance: '5,000 (최대)', period: '5일' },
      { type: '주요정비',     code: 'MI',  distance: '25,000 (최대)', period: '20일' },
      { type: '체계정비',     code: 'SWT', distance: '50,000~55,000' },
      { type: '제한정비',     code: 'LI',  distance: '150,000~165,000', period: '4.5개월' },
      { type: '일반정비',     code: 'GI',  distance: '300,000~330,000', period: '9개월' },
      { type: '전반정비',     code: 'FGI', distance: '1,200,000 (최대)', period: '3년' },
      { type: '반수명정비',   code: 'HLO', period: '15년 운행 전후 (±20%)' },
      { type: '임시정비',     code: 'T',   note: '수시' },
      { type: '특종정비',     code: 'R',   note: '수시' },
      { type: '차륜삭정',     code: 'WT',  note: '해당시' },
    ],
  },
  {
    id: 'itx',
    name: '간선형 전기동차 (ITX-새마을·마음)',
    category: '간선형전기동차',
    cycles: [
      { type: '기본정비',      code: 'ES',     distance: '5,000' },
      { type: '경정비',        code: 'LI-4',   distance: '90,000', period: '4개월' },
      { type: '중정비',        code: 'GI-3',   distance: '720,000', period: '3년' },
      { type: '중정비',        code: 'GI-6',   distance: '1,440,000', period: '6년' },
      { type: '중정비',        code: 'GI-9',   distance: '2,880,000', period: '12년' },
      { type: '차륜교환',      code: 'NWC',    note: '차륜교환 수시' },
      { type: '차륜삭정',      code: 'WT',     note: '해당시' },
      { type: '최초정비',      code: 'IOE',    note: '신규 제작·구입 후 1,600 km 운행시' },
      { type: '임시정비',      code: 'T',      note: '사업소(경정비) T1 / 사업소(중정비) T2' },
      { type: '특종정비',      code: 'R',      note: '사업소(경정비) R1 / 사업소(중정비) R2' },
    ],
  },
  {
    id: 'nuriro',
    name: '간선형 전기동차 (누리로)',
    category: '간선형전기동차',
    cycles: [
      { type: '기본정비',  code: 'ES',    distance: '3,500' },
      { type: '경정비',    code: 'LI-3',  distance: '45,000', period: '3개월' },
      { type: '중정비',    code: 'GI-4',  distance: '630,000', period: '4년' },
      { type: '중정비',    code: 'GI-8',  distance: '1,260,000', period: '8년' },
      { type: '차륜교환',  code: 'NWC',   note: '차륜교환 수시' },
      { type: '차륜삭정',  code: 'WT' },
      { type: '최초정비',  code: 'IOE',   note: '신규 제작·구입 후 1,600 km' },
    ],
  },
  {
    id: 'emu_inverter',
    name: '전기동차 (인버터제어·준고속형)',
    category: '광역차량',
    cycles: [
      { type: '기본정비', code: 'ES',   distance: '1,500',   period: '5일',  note: '2008년 이전 도입차' },
      { type: '기본정비', code: 'ES',   distance: '2,500',   note: '2009년 도입차' },
      { type: '기본정비', code: 'ES',   distance: '3,500',   period: '7일',  note: '2010년부터 도입차' },
      { type: '경정비',   code: 'LI-3', distance: '45,000',  period: '4개월', note: '2008년 이전 도입차' },
      { type: '경정비',   code: 'LI-4', distance: '60,000',  note: '2009년부터 도입차' },
      { type: '중정비',   code: 'GI-3', distance: '540,000', period: '4년',  note: '2008년 이전 도입차' },
      { type: '중정비',   code: 'GI-4', distance: '720,000', note: '2009년부터 도입차' },
      { type: '중정비',   code: 'GI-6', distance: '1,080,000', period: '8년', note: '2008년 이전' },
      { type: '중정비',   code: 'GI-8', distance: '1,440,000', note: '2009년부터' },
      { type: '차륜교환', code: 'NWC' },
      { type: '최초정비', code: 'IOE',  note: '신규 제작·구입 후 1,600 km' },
    ],
  },
]

// 별표3: 공기호스 교체주기
export interface AirHoseCycle {
  vehicleType: string
  group: '고속차량' | '일반차량' | '간선형전기동차' | '전기동차'
  years: number
  stage: string         // HLO, GI 등
  note?: string
}

export const AIR_HOSE_CYCLES: AirHoseCycle[] = [
  { vehicleType: '동력집중식 고속차량', group: '고속차량',         years: 15, stage: 'HLO' },
  { vehicleType: '동력분산식 고속차량', group: '고속차량',         years: 15, stage: 'HLO' },
  { vehicleType: '전기기관차',          group: '일반차량',         years: 4,  stage: 'GI' },
  { vehicleType: '디젤기관차',          group: '일반차량',         years: 4,  stage: 'GI' },
  { vehicleType: '객차',                 group: '일반차량',         years: 4,  stage: 'GI' },
  { vehicleType: '발전차',               group: '일반차량',         years: 4,  stage: 'GI' },
  { vehicleType: '화차',                 group: '일반차량',         years: 4,  stage: 'GI' },
  { vehicleType: 'ITX-새마을·마음',     group: '간선형전기동차',  years: 6,  stage: 'GI' },
  { vehicleType: '누리로',               group: '간선형전기동차',  years: 8,  stage: 'GI' },
  { vehicleType: 'ITX-청춘',             group: '간선형전기동차',  years: 8,  stage: 'GI' },
  { vehicleType: '전기동차',             group: '전기동차',         years: 6,  stage: 'GI', note: '6(8)년 GI 도래시' },
]
