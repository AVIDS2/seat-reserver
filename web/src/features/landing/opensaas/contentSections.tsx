import { Icons } from '@/components/icons';

import type { GridFeature } from './components/FeaturesGrid';

export const features: GridFeature[] = [
  {
    name: '自动检查',
    description: '绑定一次，预约前自动检查连接，不必每天重复操作。',
    icon: <Icons.shield className='size-7' />,
    href: '#account-feature',
    size: 'medium'
  },
  {
    name: '备选座位',
    description: '主座位没空时，按顺序尝试备选座位。',
    icon: <Icons.target className='size-7' />,
    href: '#strategy-feature',
    size: 'medium'
  },
  {
    name: '开放即抢',
    description: '按学校开放时间自动提交预约。',
    icon: <Icons.clock className='size-7' />,
    href: '#flow',
    size: 'medium'
  },
  {
    name: '一个工作台',
    description: '自习室、图书馆和更多学习空间，统一放在一个工作台。',
    icon: <Icons.globe className='size-7' />,
    href: '#account-feature',
    size: 'medium'
  },
  {
    name: '账号分开保存',
    description: '账号、任务和预约记录分开保存，敏感信息受到保护。',
    icon: <Icons.lock className='size-7' />,
    href: '#account-feature',
    size: 'medium',
    highlight: true
  },
  {
    name: '结果记录',
    description: '成功、失败和原因，按时间顺序看得清。',
    icon: <Icons.history className='size-7' />,
    href: '#runs-feature',
    size: 'medium'
  },
  {
    name: '自由组合',
    description: '自由组合座位、日期和时段。',
    icon: <Icons.list className='size-7' />,
    href: '#strategy-feature',
    size: 'medium'
  },
  {
    name: '集中查看',
    description: '账号、任务、预约和结果，一页查看。',
    icon: <Icons.dashboard className='size-7' />,
    href: '#admin-feature',
    size: 'medium'
  }
];

export const examples = [
  {
    name: '总览控制台',
    description: '开放时间、账号状态和任务概览',
    imageSrc: '/landing/seat-overview.svg',
    href: '#flow'
  },
  {
    name: '学校账号',
    description: '查看连接状态，按需启用服务',
    imageSrc: '/landing/seat-accounts.svg',
    href: '#account-feature'
  },
  {
    name: '抢座规则',
    description: '安排主座位、备选座位和时段',
    imageSrc: '/landing/seat-strategy.svg',
    href: '#strategy-feature'
  },
  {
    name: '执行记录',
    description: '每次尝试都留下清楚结果',
    imageSrc: '/landing/seat-runs.svg',
    href: '#runs-feature'
  },
  {
    name: '座位图',
    description: '按馆区、空间和日期找座位',
    imageSrc: '/landing/campus-seat-system-1600.webp',
    href: '/auth/sign-up'
  },
  {
    name: '学习空间',
    description: '图书馆与自习室分开管理',
    imageSrc: '/landing/campus-study-hall-1600.webp',
    href: '#account-feature'
  },
  {
    name: '预约状态',
    description: '成功、失败和原因集中查看',
    imageSrc: '/landing/reserved-study-seat-1600.webp',
    href: '#runs-feature'
  },
  {
    name: '高校工作区',
    description: '不同学校使用不同规则和目录',
    imageSrc: '/landing/campus-library-hero-1600.webp',
    href: '#campuses'
  }
];

export const testimonials = [
  {
    name: '账号授权',
    role: '绑定一次，自动检查',
    avatarSrc: '/landing/seat-accounts.svg',
    socialUrl: '#account-feature',
    quote: '绑定学校账号，选好座位和时段，开放后自动提交。'
  },
  {
    name: '备选座位',
    role: '主座位没空就换',
    avatarSrc: '/landing/seat-strategy.svg',
    socialUrl: '#strategy-feature',
    quote: '主座位没有空位时，按设置继续尝试备选座位和时段。'
  },
  {
    name: '运行结果',
    role: '结果清楚可查',
    avatarSrc: '/landing/seat-runs.svg',
    socialUrl: '#runs-feature',
    quote: '成功、失败和原因都在执行记录里，打开就能核对。'
  }
];

export const faqs = [
  {
    id: 1,
    question: '需要准备什么？',
    answer: '注册后绑定学校账号，选好座位和时段，再创建预约任务。账号验证通过后，任务就能自动执行。'
  },
  {
    id: 2,
    question: '学校账号密码会展示在浏览器或日志里吗？',
    answer: '不会。学校密码和授权凭证会加密保存，页面和执行记录只显示脱敏后的状态。'
  },
  {
    id: 3,
    question: '连接失效后需要每天重新登录吗？',
    answer: '通常不需要。预约前会自动检查连接；学校要求重新验证时，工作台会提示你处理。'
  },
  {
    id: 4,
    question: '可以设置多个座位和时间吗？',
    answer: '可以。每个任务都能设置主座位、备选座位、多个时段和重复日期，平台按你设置的顺序尝试。'
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
    { name: '开始使用', href: '/auth/sign-up' }
  ]
};
