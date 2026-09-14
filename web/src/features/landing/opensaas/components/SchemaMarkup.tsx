const schema = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'SoftwareApplication',
      '@id': 'https://seat.rglens.com/#software',
      name: '席定',
      alternateName: 'WUD Seat',
      description: '选好座位和时段，开放后自动抢座，结果随时可查。',
      url: 'https://seat.rglens.com',
      applicationCategory: 'ProductivityApplication',
      operatingSystem: 'Cross-platform',
      image: 'https://seat.rglens.com/landing/seat-overview.svg',
      programmingLanguage: ['TypeScript', 'Python'],
      isAccessibleForFree: true
    },
    {
      '@type': 'WebSite',
      '@id': 'https://seat.rglens.com/#website',
      url: 'https://seat.rglens.com',
      name: '席定',
      description: '选好位置，按时抢座，结果可查。'
    }
  ]
};

export function SchemaMarkup() {
  return <script type='application/ld+json'>{JSON.stringify(schema)}</script>;
}
