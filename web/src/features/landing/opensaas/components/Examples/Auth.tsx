'use client';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useState } from 'react';

import { Card, CardContent, CardHeader } from '../opensaas-card';
import { HighlightedFeature } from '../HighlightedFeature';

const modes = [
  { key: 'direct', label: '账号已连接', icon: Icons.login },
  { key: 'webvpn', label: '自动维护', icon: Icons.refresh },
  { key: 'verify', label: '隐私保护', icon: Icons.shield }
] as const;

type AuthMode = (typeof modes)[number]['key'];

export function Auth() {
  const [selectedMode, setSelectedMode] = useState<AuthMode>('direct');

  return (
    <HighlightedFeature
      id='account-feature'
      name='连接一次，日常交给平台。'
      description={
        <div className='flex flex-col gap-4'>
          <p className='text-muted-foreground'>
            添加校园账号后，平台会完成连接检查并持续维护预约所需状态。需要你处理时，控制台会及时给出明确提醒。
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
        <p className='text-muted-foreground mt-2 text-sm'>安全连接你的校园服务。</p>
      </CardHeader>
      <CardContent>
        <form className='flex flex-col gap-4' onSubmit={(event) => event.preventDefault()}>
          <div className='bg-muted/40 flex items-center justify-between rounded-lg px-3 py-2.5'>
            <div className='flex items-center gap-2'>
              <ModeIcon className='text-secondary size-4' />
              <span className='text-sm'>{mode.label}</span>
            </div>
            <span className='text-muted-foreground text-[11px]'>状态正常</span>
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
            敏感信息加密保存，不会显示在页面或运行记录中。
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
