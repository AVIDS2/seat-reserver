const schema = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'SoftwareApplication',
      '@id': 'https://seat.rglens.com/#software',
      name: '一考即过',
      alternateName: 'Seat Control',
      description: '座位预约自动化控制台，集中管理学校账号、候选策略和每日执行结果。',
      url: 'https://seat.rglens.com',
      applicationCategory: 'ProductivityApplication',
      operatingSystem: 'Cross-platform',
      image: 'https://seat.rglens.com/landing/seat-overview.svg',
      codeRepository: 'https://github.com/AVIDS2/seat-reserver',
      programmingLanguage: ['TypeScript', 'Python'],
      isAccessibleForFree: true
    },
    {
      '@type': 'WebSite',
      '@id': 'https://seat.rglens.com/#website',
      url: 'https://seat.rglens.com',
      name: '一考即过',
      description: '清晰掌握账号、预约任务和每一次运行结果。'
    }
  ]
};

export function SchemaMarkup() {
  return <script type='application/ld+json'>{JSON.stringify(schema)}</script>;
}
