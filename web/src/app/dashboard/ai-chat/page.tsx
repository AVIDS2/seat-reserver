import AiNavigatorPage from '@/features/ai-chat/components/ai-navigator-page';
import {
  emptyAssistantContext,
  getAssistantContextServer
} from '@/features/ai-chat/api/server-context';

export const metadata = {
  title: '席定领航'
};

export default async function Page() {
  const initialContext = await getAssistantContextServer().catch(() => emptyAssistantContext());
  const aiConfigured = Boolean(
    process.env.PLATFORM_AI_BASE_URL ||
    (process.env.PLATFORM_VLM_BASE_URL && process.env.PLATFORM_VLM_API_KEY)
  );

  return <AiNavigatorPage initialContext={initialContext} aiConfigured={aiConfigured} />;
}
