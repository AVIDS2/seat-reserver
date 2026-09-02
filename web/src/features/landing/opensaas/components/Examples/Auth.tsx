'use client';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useState } from 'react';

import { Card, CardContent, CardHeader } from '../opensaas-card';
import { HighlightedFeature } from '../HighlightedFeature';

const modes = [
  { key: 'direct', label: '常规链路', icon: Icons.login },
  { key: 'webvpn', label: 'WebVPN 网关', icon: Icons.globe },
  { key: 'verify', label: 'Token 校验', icon: Icons.shield }
] as const;

type AuthMode = (typeof modes)[number]['key'];

export function Auth() {
  const [selectedMode, setSelectedMode] = useState<AuthMode>('direct');

  return (
    <HighlightedFeature
      id='account-feature'
      name='账号授权，先验证再执行。'
      description={
        <div className='flex flex-col gap-4'>
          <p className='text-muted-foreground'>
            学校账号密码只用于服务端认证。系统自动识别可用链路，完成用户校验后才保存授权状态。
          </p>
          <div className='flex flex-wrap gap-2'>
            {modes.map((mode) => {
              const Icon = mode.icon;
              const active = selectedMode === mode.key;
              return (
                <Button
                  key={mode.key}
                  type='button'
                  size='sm'
                  variant={active ? 'default' : 'outline'}
                  onClick={() => setSelectedMode(mode.key)}
                  title={mode.label}
                >
                  <Icon />
                  {mode.label}
                </Button>
              );
            })}
          </div>
        </div>
      }
      highlightedComponent={<AuthExample selectedMode={selectedMode} />}
      tilt='left'
      className='h-100'
    />
  );
}

function AuthExample({ selectedMode }: { selectedMode: AuthMode }) {
  const mode = modes.find((item) => item.key === selectedMode) ?? modes[0];
  const ModeIcon = mode.icon;
  return (
    <Card className='w-full max-w-md py-8' variant='default'>
      <CardHeader>
        <p className='text-2xl font-bold'>绑定学校账号</p>
        <p className='text-muted-foreground mt-2 text-sm'>验证通过后，任务才会进入自动执行。</p>
      </CardHeader>
      <CardContent>
        <form className='flex flex-col gap-4' onSubmit={(event) => event.preventDefault()}>
          <div className='bg-muted/40 flex items-center justify-between rounded-lg px-3 py-2.5'>
            <div className='flex items-center gap-2'>
              <ModeIcon className='text-secondary size-4' />
              <span className='text-sm'>{mode.label}</span>
            </div>
            <span className='text-muted-foreground font-mono text-[11px]'>ACTIVE ROUTE</span>
          </div>
          <Input
            type='text'
            name='schoolUsername'
            placeholder='学号'
            aria-label='学号'
            autoComplete='username'
          />
          <Input
            type='password'
            name='schoolPassword'
            placeholder='学校密码'
            aria-label='学校密码'
            autoComplete='current-password'
          />
          <Button type='submit' className='mt-1'>
            验证并保存 <Icons.arrowRight />
          </Button>
          <p className='text-muted-foreground text-center text-xs'>
            密码和 Token 不会展示给浏览器。
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
