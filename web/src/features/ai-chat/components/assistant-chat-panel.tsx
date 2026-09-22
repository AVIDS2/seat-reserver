'use client';

import { useMemo } from 'react';

import { AssistantRuntimeProvider } from '@assistant-ui/react';
import { AssistantChatTransport, useChatRuntime } from '@assistant-ui/react-ai-sdk';

import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Icons } from '@/components/icons';
import { Thread } from '@/components/assistant-ui/thread.aui';

export function AssistantChatPanel() {
  const transport = useMemo(() => new AssistantChatTransport({ api: '/assistant' }), []);
  const runtime = useChatRuntime({ transport });

  return (
    <Card className='flex min-h-0 h-[min(720px,calc(100svh-9rem))] min-w-0 flex-col overflow-hidden shadow-none sm:min-h-[620px]'>
      <CardHeader className='shrink-0 border-b'>
        <div className='flex items-start gap-3'>
          <div className='bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg'>
            <Icons.sparkles />
          </div>
          <div className='min-w-0'>
            <CardTitle>席定领航</CardTitle>
            <CardDescription className='mt-1'>预约 · 专注 · 复盘</CardDescription>
          </div>
        </div>
      </CardHeader>
      <div className='min-h-0 flex-1 touch-pan-y overscroll-contain'>
        <AssistantRuntimeProvider runtime={runtime}>
          <Thread autoFocus={false} />
        </AssistantRuntimeProvider>
      </div>
    </Card>
  );
}
