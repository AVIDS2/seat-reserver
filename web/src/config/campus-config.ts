export type CampusCode = 'cczu' | 'njtech' | 'jou';

export type CampusStatus = 'connected' | 'preview';

export type CampusDefinition = {
  code: CampusCode;
  name: string;
  shortName: string;
  initials: string;
  detail: string;
  summary: string;
  status: CampusStatus;
  statusLabel: string;
  services: string[];
  aliases: string[];
};

export const CAMPUS_DEFINITIONS: readonly CampusDefinition[] = [
  {
    code: 'cczu',
    name: '常州大学',
    shortName: '常大',
    initials: '常',
    detail: '全校区学习空间',
    summary: '常州大学自习室与图书馆全校区服务已接入。',
    status: 'connected',
    statusLabel: '已接入',
    services: ['自习室', '图书馆'],
    aliases: ['常州大学', '常大', '西太湖']
  },
  {
    code: 'njtech',
    name: '南京工业大学',
    shortName: '南工',
    initials: '南',
    detail: '逸夫图书馆 · 浦江图书馆',
    summary: '当天座位预约已接入，支持江浦校区逸夫图书馆与浦江图书馆。',
    status: 'connected',
    statusLabel: '已接入',
    services: ['图书馆', '当天抢座'],
    aliases: ['南京工业大学', '南工大', '南工', 'NJTech', '江浦', '逸夫', '浦江图书馆']
  },
  {
    code: 'jou',
    name: '江苏海洋大学',
    shortName: '海大',
    initials: '海',
    detail: '苍梧校区图书馆',
    summary: '正在接入官方座位系统，等待授权链路验证。',
    status: 'preview',
    statusLabel: '接入准备中',
    services: ['图书馆', '苍梧校区'],
    aliases: ['江苏海洋大学', '海大', 'JOU', '苍梧']
  }
];

export function getCampusDefinition(code: string | null | undefined): CampusDefinition {
  return CAMPUS_DEFINITIONS.find((campus) => campus.code === code) ?? CAMPUS_DEFINITIONS[0];
}

export function isCampusCode(value: unknown): value is CampusCode {
  return value === 'cczu' || value === 'jou';
}
