export type CampusCode = 'cczu' | 'jou';

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
    detail: '西太湖自习室',
    summary: '自习室已接入，图书馆按服务状态独立维护。',
    status: 'connected',
    statusLabel: '已接入',
    services: ['自习室', '图书馆'],
    aliases: ['常州大学', '常大', '西太湖']
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

