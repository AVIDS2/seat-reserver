export enum GithubEpicStatus {
  Ideas = '规划中',
  Planned = '已计划',
  InProgress = '进行中',
  Done = '已上线'
}

export type GithubEpic = {
  name: string;
  totalIssues: number;
  doneIssues: number;
  status: GithubEpicStatus;
  url: string;
};

export const roadmapItems: GithubEpic[] = [
  {
    name: '平台账号与数据隔离',
    totalIssues: 5,
    doneIssues: 5,
    status: GithubEpicStatus.Done,
    url: '/auth/sign-up'
  },
  {
    name: '学校账号连接',
    totalIssues: 5,
    doneIssues: 5,
    status: GithubEpicStatus.Done,
    url: '#account-feature'
  },
  {
    name: '候选座位与时间策略',
    totalIssues: 4,
    doneIssues: 2,
    status: GithubEpicStatus.InProgress,
    url: '#strategy-feature'
  },
  {
    name: '移动端快捷配置',
    totalIssues: 3,
    doneIssues: 1,
    status: GithubEpicStatus.InProgress,
    url: '#features'
  },
  {
    name: '运行记录与失败解释',
    totalIssues: 3,
    doneIssues: 0,
    status: GithubEpicStatus.Planned,
    url: '#runs-feature'
  },
  {
    name: '通知渠道与执行提醒',
    totalIssues: 3,
    doneIssues: 0,
    status: GithubEpicStatus.Planned,
    url: '#features'
  },
  {
    name: '预约数据趋势分析',
    totalIssues: 3,
    doneIssues: 0,
    status: GithubEpicStatus.Ideas,
    url: '#features'
  },
  {
    name: '更多场馆与策略模板',
    totalIssues: 4,
    doneIssues: 0,
    status: GithubEpicStatus.Ideas,
    url: '#features'
  }
];
