import { Icons } from '@/components/icons';

import type { GridFeature } from './components/FeaturesGrid';

export const features: GridFeature[] = [
  {
    name: '授权自动保持',
    description: '每天开放前先验证缓存授权，失效时用已保存的学校账号重新完成登录。',
    icon: <Icons.shield className='size-7' />,
    href: '#account-feature',
    size: 'medium'
  },
  {
    name: '候选策略',
    description: '主座位、备选座位和多个时间段按你设定的顺序尝试。',
    icon: <Icons.target className='size-7' />,
    href: '#strategy-feature',
    size: 'medium'
  },
  {
    name: '北京时间调度',
    description: '固定窗口自动预热，预约开放后进入短时策略执行。',
    icon: <Icons.clock className='size-7' />,
    href: '#flow',
    size: 'medium'
  },
  {
    name: 'WebVPN 兼容',
    description: '支持校园网网关链路，正常完成学校账号授权与业务 Token 交换。',
    icon: <Icons.globe className='size-7' />,
    href: '#account-feature',
    size: 'medium'
  },
  {
    name: '个人数据隔离',
    description: '账号、任务、运行记录和通知只属于当前用户，管理员也只看到脱敏视图。',
    icon: <Icons.lock className='size-7' />,
    href: '#account-feature',
    size: 'medium',
    highlight: true
  },
  {
    name: '运行日志',
    description: '成功、失败、跳过和异常都留下可追踪的运行记录。',
    icon: <Icons.history className='size-7' />,
    href: '#runs-feature',
    size: 'medium'
  },
  {
    name: '候选顺序明确',
    description: '每个任务的尝试顺序和时间窗口都可以单独调整。',
    icon: <Icons.list className='size-7' />,
    href: '#strategy-feature',
    size: 'medium'
  },
  {
    name: '失败可解释',
    description: '失败原因、接口回执和最终状态不会藏在脚本输出里。',
    icon: <Icons.info className='size-7' />,
    href: '#runs-feature',
    size: 'small'
  },
  {
    name: '一键验证',
    description: '只验证账号和候选配置，不发送真实预约请求。',
    icon: <Icons.refresh className='size-7' />,
    href: '#account-feature',
    size: 'small'
  },
  {
    name: '管理员工作台',
    description: '邀请码、成员状态和全局运行健康度集中查看。',
    icon: <Icons.dashboard className='size-7' />,
    href: '#admin-feature',
    size: 'medium'
  }
];

export const examples = [
  {
    name: '总览控制台',
    description: '下一次执行、账号状态和任务概览',
    imageSrc: '/landing/seat-overview.svg',
    href: '#flow'
  },
  {
    name: '账号与授权',
    description: '验证状态和授权模式一目了然',
    imageSrc: '/landing/seat-accounts.svg',
    href: '#account-feature'
  },
  {
    name: '任务策略',
    description: '主座位、备选座位和时间候选顺序',
    imageSrc: '/landing/seat-strategy.svg',
    href: '#strategy-feature'
  },
  {
    name: '运行记录',
    description: '每次预热和预约都留下可追踪结果',
    imageSrc: '/landing/seat-runs.svg',
    href: '#runs-feature'
  }
];

export const testimonials = [
  {
    name: '账号授权',
    role: '先验证，再执行',
    avatarSrc: '/landing/seat-accounts.svg',
    socialUrl: '#account-feature',
    quote: '学校账号只在服务端完成认证，浏览器端只展示连接状态和最后验证时间。'
  },
  {
    name: '候选策略',
    role: '按顺序尝试',
    avatarSrc: '/landing/seat-strategy.svg',
    socialUrl: '#strategy-feature',
    quote: '主座位没有空位时，系统按配置继续尝试备选座位和时间段，不需要每天手动重做。'
  },
  {
    name: '运行结果',
    role: '每次都有回执',
    avatarSrc: '/landing/seat-runs.svg',
    socialUrl: '#runs-feature',
    quote: '预约成功、Token 预热、失败原因和最终回执都集中在运行记录中，结果清楚可核对。'
  }
];

export const faqs = [
  {
    id: 1,
    question: '需要准备什么？',
    answer:
      '注册平台账号后，添加自己的学校账号、主座位和候选策略。系统会先验证授权，验证通过后任务才能进入自动执行。'
  },
  {
    id: 2,
    question: '学校账号密码会展示在浏览器或日志里吗？',
    answer:
      '不会。学校密码和业务 Token 在服务端加密保存，浏览器只显示脱敏后的账号状态，运行日志也不会记录敏感值。'
  },
  {
    id: 3,
    question: 'Token 失效后需要手动处理吗？',
    answer:
      '不需要。预约前系统会先验证缓存授权；失效时使用已保存的学校账号重新登录，并重新建立必要的校园网网关会话。'
  },
  {
    id: 4,
    question: '可以设置多个座位和时间吗？',
    answer:
      '可以。每个任务支持主座位、备选座位、多个候选时间段、尝试次数和错峰参数，系统按你设置的顺序执行。'
  },
  {
    id: 5,
    question: '我的数据会和其他用户混在一起吗？',
    answer: '不会。学校账号、预约任务、运行记录和通知都按平台账号隔离，普通用户只能访问自己的数据。'
  }
];

export const footerNavigation = {
  app: [
    { name: '产品能力', href: '#features' },
    { name: '执行流程', href: '#flow' },
    { name: '运行记录', href: '#runs-feature' }
  ],
  company: [
    { name: '登录', href: '/auth/sign-in' },
    { name: '开始使用', href: '/auth/sign-up' },
    { name: '源码', href: 'https://github.com/AVIDS2/seat-reserver' }
  ]
};
