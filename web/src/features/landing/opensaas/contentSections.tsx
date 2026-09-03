import { Icons } from '@/components/icons';

import type { GridFeature } from './components/FeaturesGrid';

export const features: GridFeature[] = [
  {
    name: '持续在线',
    description: '连接一次校园账号，平台持续维护可用状态，不必每天重复操作。',
    icon: <Icons.shield className='size-7' />,
    href: '#account-feature',
    size: 'medium'
  },
  {
    name: '候选策略',
    description: '在可视化座位图中安排偏好，让每次预约都按你的选择执行。',
    icon: <Icons.target className='size-7' />,
    href: '#strategy-feature',
    size: 'medium'
  },
  {
    name: '准时执行',
    description: '紧贴各场馆开放时间，在关键窗口自动完成准备与提交。',
    icon: <Icons.clock className='size-7' />,
    href: '#flow',
    size: 'medium'
  },
  {
    name: '多场馆连接',
    description: '同一校园账号连接不同预约服务，在一个工作台统一管理。',
    icon: <Icons.globe className='size-7' />,
    href: '#account-feature',
    size: 'medium'
  },
  {
    name: '只属于你的空间',
    description: '账号、偏好、任务和运行结果彼此隔离，敏感信息始终受到保护。',
    icon: <Icons.lock className='size-7' />,
    href: '#account-feature',
    size: 'medium',
    highlight: true
  },
  {
    name: '运行日志',
    description: '从准备到回执完整记录，任何结果都有清晰的时间线。',
    icon: <Icons.history className='size-7' />,
    href: '#runs-feature',
    size: 'medium'
  },
  {
    name: '灵活偏好',
    description: '座位、空间、日期和时间都可自由组合，满足不同学习安排。',
    icon: <Icons.list className='size-7' />,
    href: '#strategy-feature',
    size: 'medium'
  },
  {
    name: '状态清晰',
    description: '无需翻找记录，关键状态与下一步处理直接呈现在界面中。',
    icon: <Icons.info className='size-7' />,
    href: '#runs-feature',
    size: 'small'
  },
  {
    name: '安心检查',
    description: '正式执行前检查账号与预约偏好，提前发现需要处理的问题。',
    icon: <Icons.refresh className='size-7' />,
    href: '#account-feature',
    size: 'small'
  },
  {
    name: '统一工作台',
    description: '从账号连接到预约回执，所有重要信息都集中在同一处。',
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
    description: '在实时座位图中安排你的首选与备选',
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
    quote: '连接校园账号后，预约所需的准备工作交给平台，重要状态始终清晰可见。'
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
    quote: '预约准备、提交结果和最终回执集中在时间线中，每一次执行都清楚可核对。'
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
      '不会。学校密码和授权凭证加密保存在服务端，浏览器只显示脱敏后的连接状态，运行记录也不会保存敏感值。'
  },
  {
    id: 3,
    question: '连接失效后需要每天重新登录吗？',
    answer:
      '通常不需要。平台会在预约前检查连接状态，并在需要时使用已保存的校园账号重新建立授权。遇到学校要求人工验证时，控制台会明确提醒。'
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
