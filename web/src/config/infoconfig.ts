import type { InfobarContent } from '@/components/ui/infobar';

export const workspacesInfoContent: InfobarContent = {
  title: '个人工作区',
  sections: [
    {
      title: '数据分开',
      description:
        '每个用户都有自己的学校账号、预约任务、记录和通知。管理员工作台用于管理成员和邀请码。',
      links: []
    },
    {
      title: '自动执行',
      description: '启用的任务会在开放前检查账号，开放后按你的设置自动抢座。',
      links: []
    }
  ]
};

export const teamInfoContent: InfobarContent = {
  title: '平台成员',
  sections: [
    {
      title: '成员管理',
      description: '管理员可以创建邀请码、查看成员数量和管理账号状态。',
      links: []
    },
    {
      title: '用户数据',
      description: '每位用户只能访问自己的学校账号、预约任务、记录和通知。',
      links: []
    }
  ]
};

export const billingInfoContent: InfobarContent = {
  title: '席定商店',
  sections: [
    {
      title: 'Pro 权益',
      description:
        'Pro 为 ¥20，一次开通、永久有效。当前提交申请后由管理员确认。',
      links: []
    },
    {
      title: '邀请码',
      description: '邀请码由管理员发放或使用席定币兑换，只显示一次。',
      links: []
    }
  ]
};

export const productInfoContent: InfobarContent = {
  title: '预约任务',
  sections: [
    {
      title: '抢座规则',
      description: '每个任务可以配置主座位、备选座位和多个时段，平台按顺序尝试。',
      links: []
    },
    {
      title: '执行记录',
      description: '每次尝试和预约都会写入记录；检查任务只查看账号和候选座位，不会提交预约。',
      links: []
    }
  ]
};
