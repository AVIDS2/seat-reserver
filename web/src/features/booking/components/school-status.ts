export function getSchoolAvailabilityNotice(error: string): {
  maintenance: boolean;
  message: string;
} {
  const maintenance =
    /系统维护/.test(error) ||
    (isSchoolMaintenanceWindow() && /WebVPN 登录失败|登录暂时不可用|请求暂时不可用/.test(error));

  return {
    maintenance,
    message: maintenance
      ? '学校座位系统通常在 00:00-05:00 维护，暂不代表账号或授权失效。05:00 后刷新重试。'
      : error
  };
}

function isSchoolMaintenanceWindow(): boolean {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Shanghai',
      hour: '2-digit',
      hourCycle: 'h23'
    }).format(new Date())
  );
  return hour >= 0 && hour < 5;
}
