import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  type UIMessage
} from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

import { getPlatformUserServer } from '@/features/booking/api/server-service';
import { getAssistantContextServer } from '@/features/ai-chat/api/server-context';

export const runtime = 'nodejs';

const SYSTEM_PROMPT = `你是席定领航，负责根据席定数据给出学习计划和专注建议。

回答只引用提供的数据。数据不足时直接说暂无记录，不猜测学校规则、座位状态或预约结果。
你只提供建议和计划草稿；任务的创建、修改、启停、取消和签到由用户在对应页面完成。
涉及学校账号、密码、Token、Cookie、验证码或支付信息时，引导用户回到页面操作。
中文回答，先给结论，再给 2-4 个具体动作。短句、短段落，少铺垫，少总结，贴着用户当前的问题回答。
`;

export async function POST(request: Request) {
  try {
    if (!(await getPlatformUserServer())) {
      return Response.json({ error: '请先登录席定' }, { status: 401 });
    }

    const body = (await request.json()) as { messages?: UIMessage[] };
    if (!Array.isArray(body.messages)) {
      return Response.json({ error: '消息格式不正确' }, { status: 400 });
    }

    const context = await getAssistantContextServer();
    const explicitAIProvider = Boolean(process.env.PLATFORM_AI_BASE_URL);
    const baseURL = process.env.PLATFORM_AI_BASE_URL || process.env.PLATFORM_VLM_BASE_URL;
    const apiKey = process.env.PLATFORM_AI_API_KEY || process.env.PLATFORM_VLM_API_KEY;
    const modelId = process.env.PLATFORM_AI_MODEL || process.env.PLATFORM_VLM_MODEL || 'mimo-v2.5';

    if (!baseURL || (!explicitAIProvider && !apiKey)) {
      return Response.json(
        { error: 'AI 服务尚未配置，请联系管理员接入兼容协议模型。' },
        { status: 503 }
      );
    }

    const provider = createOpenAICompatible({
      baseURL: baseURL.replace(/\/$/, ''),
      name: 'seat-ai',
      apiKey: apiKey || undefined,
      includeUsage: true
    });

    const result = streamText({
      model: provider.chatModel(modelId),
      system: `${SYSTEM_PROMPT}\n\n当前席定数据（仅供参考，时间以服务端为准）：\n${JSON.stringify(context)}`,
      messages: await convertToModelMessages(body.messages),
      temperature: 0.35,
      maxOutputTokens: 900
    });

    return createUIMessageStreamResponse({
      stream: toUIMessageStream({
        stream: result.stream,
        onError: (error) => (error instanceof Error ? error.message : 'AI 服务暂时不可用')
      })
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI 服务暂时不可用';
    return Response.json({ error: message }, { status: 500 });
  }
}
