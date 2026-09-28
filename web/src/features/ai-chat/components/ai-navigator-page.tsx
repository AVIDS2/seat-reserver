'use client';

import { Icons } from '@/components/icons';
import PageContainer from '@/components/layout/page-container';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AssistantChatPanel } from '@/features/ai-chat/components/assistant-chat-panel';

export default function AiNavigatorPage({ aiConfigured }: { aiConfigured: boolean }) {
  return (
    <PageContainer>
      <div className='mx-auto flex min-h-0 w-full max-w-[1120px] flex-1 flex-col gap-3'>
        {!aiConfigured && (
          <Alert className='shrink-0'>
            <Icons.info />
            <AlertTitle>AI 尚未连接</AlertTitle>
            <AlertDescription>完成模型配置后，这里会直接开始对话。</AlertDescription>
          </Alert>
        )}
        <AssistantChatPanel aiConfigured={aiConfigured} />
      </div>
    </PageContainer>
  );
}
