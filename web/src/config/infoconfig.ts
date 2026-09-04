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
  title: '平台设置',
  sections: [
    {
      title: '邀请制',
      description: '当前版本是邀请制工具，不接入订阅、支付或第三方计费服务。',
      links: []
    },
    {
      title: '账号安全',
      description: '平台密码使用 bcrypt 保存；学校密码和缓存 Token 使用 AES-256-GCM 加密保存。',
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
