export function getSchoolAvailabilityNotice(error: string): {
  maintenance: boolean;
  message: string;
} {
  const retrying = /Mysql|WebVPN.*(?:暂时不可用|连接异常)|请求暂时不可用|Failed to fetch|ECONN|网络/i.test(
    error,
  );
  const maintenance =
    /系统维护/.test(error) ||
    (isSchoolMaintenanceWindow() && /WebVPN 登录失败|登录暂时不可用|请求暂时不可用/.test(error));

  return {
    maintenance,
    message: maintenance
      ? '学校座位系统通常在 00:00-05:00 维护，暂不代表账号或授权失效。05:00 后刷新重试。'
      : retrying
        ? '学校服务暂时没有响应，正在自动重试。已保存的账号和任务不受影响。'
        : /账号或密码|登录失败|统一认证/i.test(error)
          ? '学校账号验证失败，请检查账号和密码。'
          : error || '座位数据加载失败，请稍后重试。'
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
