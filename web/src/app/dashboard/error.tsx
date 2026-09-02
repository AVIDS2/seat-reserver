'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Icons } from '@/components/icons';

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className='flex flex-1 items-center justify-center p-6'>
      <Card className='w-full max-w-md shadow-none'>
        <CardHeader>
          <CardTitle>控制台暂时无法加载</CardTitle>
          <CardDescription>请稍后重试；学校账号凭据不会因为本次加载失败而改变。</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={reset}>
            <Icons.refresh data-icon='inline-start' />
            重新加载
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
