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

const SYSTEM_PROMPT = `你是“席定领航”，席定高校座位预约平台里的学习主持人。

你的职责不是泛泛聊天，而是帮助用户把学习目标变成可执行的专注安排，并解释席定已有的预约、房间、专注和奖励数据。

规则：
1. 只使用上下文中存在的数据；没有数据就明确说暂无记录，不要猜测学校规则、座位状态或预约结果。
2. 你只能给建议和计划草稿，不能声称已经创建、修改、启用、取消预约，也不能声称已替用户签到。
3. 不要要求用户提供或复述学号、密码、Token、Cookie、验证码、HMAC 或支付信息。
4. 如果用户要改预约，给出简短草稿，并提醒用户回到任务编辑页确认；不要输出可直接执行的接口请求。
5. 中文回答，克制、具体、少用自我解释。优先给 2-4 条可以马上执行的建议。
6. 结合席定自习室的目标、专注时段、休息和结束复盘，避免把学习建议写成营销文案。
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
