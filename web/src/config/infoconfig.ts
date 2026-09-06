import type { InfobarContent } from '@/components/ui/infobar';

export const workspacesInfoContent: InfobarContent = {
  title: '个人工作区',
  sections: [
    {
      title: '资源隔离',
      description:
        '每个用户拥有独立的学校账号、预约任务、运行记录和通知。管理员工作台用于管理平台成员和邀请码。',
      links: []
    },
    {
      title: '自动执行',
      description: '启用的任务会在预约开放前检查连接和偏好，并在开放后自动执行。',
      links: []
    }
  ]
};

export const teamInfoContent: InfobarContent = {
  title: '平台成员',
  sections: [
    {
      title: '管理员控制',
      description: '管理员可以创建邀请码、查看成员资源数量和启用或禁用普通用户。',
      links: []
    },
    {
      title: '普通用户',
      description: '普通用户只能访问自己的学校账号、预约任务、运行记录和通知。',
      links: []
    }
  ]
};

export const billingInfoContent: InfobarContent = {
  title: '席定商店',
  sections: [
    {
      title: '权益开通',
      description:
        'Pro 为 ¥20 一次开通、永久有效。当前通过开通申请由管理员确认，不伪造在线支付结果。',
      links: []
    },
    {
      title: '邀请奖励',
      description: '邀请码不直接售卖，只能由管理员发放或使用活跃积分兑换；邀请码只显示一次。',
      links: []
    }
  ]
};

export const productInfoContent: InfobarContent = {
  title: '预约任务',
  sections: [
    {
      title: '候选策略',
      description: '每个任务可以配置主座位、备选座位和多个候选时间段，系统按顺序尝试。',
      links: []
    },
    {
      title: '执行记录',
      description: '每次预热和预约都会写入运行记录；dry-run 只检查 Token 和候选列表，不提交预约。',
      links: []
    }
  ]
};
