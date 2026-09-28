import AiNavigatorPage from '@/features/ai-chat/components/ai-navigator-page';

export const metadata = {
  title: '席定领航'
};

export default async function Page() {
  const aiConfigured = Boolean(
    process.env.PLATFORM_AI_BASE_URL ||
    (process.env.PLATFORM_VLM_BASE_URL && process.env.PLATFORM_VLM_API_KEY)
  );

  return <AiNavigatorPage aiConfigured={aiConfigured} />;
}
