'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { DefaultChatTransport } from 'ai';
import { useChat } from '@ai-sdk/react';

import { Icons } from '@/components/icons';
import PageContainer from '@/components/layout/page-container';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Bubble, BubbleContent } from '@/components/ui/bubble';
import { Message, MessageAvatar, MessageContent } from '@/components/ui/message';
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport
} from '@/components/ui/message-scroller';
import { Marker, MarkerContent, MarkerIcon } from '@/components/ui/marker';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

import type { AssistantContext } from '../api/server-context';

const QUICK_PROMPTS = [
  {
    icon: Icons.target,
    label: '开始专注',
    prompt: '根据我今天的预约和自习室状态，给我安排一段现在就能开始的专注计划。'
  },
  {
    icon: Icons.calendar,
    label: '规划一周',
    prompt: '帮我把这周的学习目标拆成几段可执行的专注计划，不要直接修改我的预约任务。'
  },
  {
    icon: Icons.trendingUp,
    label: '看看节奏',
    prompt: '结合我的预约、运行记录、房间和席定币数据，告诉我当前学习节奏里最值得调整的一件事。'
  },
  {
    icon: Icons.mapPin,
    label: '选个位置',
    prompt:
      '根据当前已有的预约位置和任务，给我一个选择学习空间与时间段的思路。没有实时座位数据时请明确说明。'
  }
];

export default function AiNavigatorPage({
  initialContext,
  aiConfigured
}: {
  initialContext: AssistantContext;
  aiConfigured: boolean;
}) {
  return (
    <PageContainer
      pageTitle='席定领航'
      pageDescription='把今天想做的事，变成一段真正开始得了的专注。'
    >
      <div className='mx-auto flex w-full max-w-[1280px] flex-col gap-5 sm:gap-6'>
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className='relative overflow-hidden rounded-xl bg-foreground text-background'
        >
          <div className='pointer-events-none absolute inset-0 opacity-80 [background-image:radial-gradient(circle_at_82%_16%,hsl(var(--primary)/.36),transparent_30%),radial-gradient(circle_at_12%_110%,hsl(var(--primary)/.24),transparent_36%)]' />
          <div className='relative grid gap-6 p-5 sm:p-7 lg:grid-cols-[1fr_auto] lg:items-end'>
            <div className='max-w-2xl'>
              <Badge className='border-background/15 bg-background/10 text-background'>
                <Icons.sparkles data-icon='inline-start' />
                SEAT NAVIGATOR
              </Badge>
              <h1 className='mt-4 text-2xl font-semibold tracking-tight sm:text-4xl'>
                不是替你学习，
                <br className='sm:hidden' />
                是帮你更快坐下来。
              </h1>
              <p className='mt-3 max-w-xl text-sm leading-6 text-background/65 sm:text-base'>
                席定领航会读懂你的预约与专注节奏，陪你设定目标、开始一段专注，再在结束时留下下一步。
              </p>
            </div>
            <div className='grid grid-cols-3 gap-2 sm:min-w-[320px] sm:gap-3'>
              <NavigatorStat label='启用任务' value={initialContext.booking.enabledTasks} />
              <NavigatorStat label='专注房间' value={initialContext.focus.joinedRooms.length} />
              <NavigatorStat label='席定币' value={initialContext.rewards.pointsBalance} />
            </div>
          </div>
        </motion.section>

        {!aiConfigured && (
          <Alert>
            <Icons.info />
            <AlertTitle>AI 服务尚未配置</AlertTitle>
            <AlertDescription>
              页面和席定自习室仍然可以使用。管理员配置 OpenAI-compatible
              模型后，领航对话才会开始响应。
            </AlertDescription>
          </Alert>
        )}

        <div className='grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.18fr)_minmax(320px,0.82fr)]'>
          <NavigatorChat aiConfigured={aiConfigured} />
          <NavigatorContext context={initialContext} />
        </div>
      </div>
    </PageContainer>
  );
}

function NavigatorStat({ label, value }: { label: string; value: number }) {
  return (
    <div className='rounded-lg border border-background/10 bg-background/10 p-3'>
      <p className='text-xs text-background/55'>{label}</p>
      <p className='mt-2 text-2xl font-semibold tabular-nums'>{value}</p>
    </div>
  );
}

function NavigatorChat({ aiConfigured }: { aiConfigured: boolean }) {
  const transport = useMemo(() => new DefaultChatTransport({ api: '/api/assistant' }), []);
  const { messages, sendMessage, stop, status, error, clearError } = useChat({ transport });
  const [input, setInput] = useState('');
  const isBusy = status === 'submitted' || status === 'streaming';

  const submit = (value = input) => {
    const prompt = value.trim();
    if (!prompt || isBusy || !aiConfigured) return;
    setInput('');
    void sendMessage({ text: prompt });
  };

  return (
    <Card className='flex min-h-[640px] min-w-0 flex-col overflow-hidden shadow-none'>
      <CardHeader className='border-b'>
        <div className='flex items-start gap-3'>
          <div className='bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg'>
            <Icons.sparkles />
          </div>
          <div className='min-w-0'>
            <CardTitle>和席定聊聊</CardTitle>
            <CardDescription className='mt-1'>只读你的平台摘要，不碰校园凭据。</CardDescription>
          </div>
        </div>
        <CardAction>
          <Badge variant={aiConfigured ? 'secondary' : 'outline'}>
            <span
              className={cn(
                'mr-1.5 size-1.5 rounded-full',
                aiConfigured ? 'bg-emerald-500' : 'bg-muted-foreground/50'
              )}
            />
            {aiConfigured ? '已连接' : '待配置'}
          </Badge>
        </CardAction>
      </CardHeader>

      <MessageScrollerProvider defaultScrollPosition='end' scrollPreviousItemPeek={64}>
        <MessageScroller className='min-h-0 flex-1'>
          <MessageScrollerViewport>
            <MessageScrollerContent className='px-4 py-5 sm:px-6'>
              {messages.length === 0 ? (
                <div className='flex min-h-[360px] flex-col justify-center gap-6'>
                  <div className='max-w-lg'>
                    <p className='text-muted-foreground text-sm'>今天想从哪里开始？</p>
                    <h2 className='mt-2 text-xl font-semibold tracking-tight'>
                      先说目标，剩下的我们一起拆。
                    </h2>
                    <p className='text-muted-foreground mt-2 text-sm leading-6'>
                      你可以从一个具体目标开始，也可以直接选择下面的节奏建议。AI
                      只提供草稿和解释，不会替你改动预约任务。
                    </p>
                  </div>
                  <div className='grid gap-2 sm:grid-cols-2'>
                    {QUICK_PROMPTS.map(({ icon: Icon, label, prompt }) => (
                      <Button
                        key={label}
                        variant='outline'
                        className='h-auto justify-start whitespace-normal px-3 py-3 text-left'
                        disabled={!aiConfigured || isBusy}
                        onClick={() => submit(prompt)}
                      >
                        <Icon data-icon='inline-start' />
                        <span>{label}</span>
                      </Button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((message) => (
                  <MessageScrollerItem
                    key={message.id}
                    messageId={message.id}
                    scrollAnchor={message.role === 'user'}
                  >
                    <Message align={message.role === 'user' ? 'end' : 'start'}>
                      <MessageAvatar
                        className={cn(
                          'size-8 self-start',
                          message.role === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-primary/10 text-primary'
                        )}
                      >
                        {message.role === 'user' ? <Icons.user /> : <Icons.sparkles />}
                      </MessageAvatar>
                      <MessageContent>
                        {message.parts.map((part, index) => {
                          const key = `${message.id}-${index}`;
                          if (part.type === 'text') {
                            return (
                              <Bubble
                                key={key}
                                variant={message.role === 'user' ? 'default' : 'muted'}
                                align={message.role === 'user' ? 'end' : 'start'}
                              >
                                <BubbleContent className='whitespace-pre-wrap'>
                                  {part.text}
                                </BubbleContent>
                              </Bubble>
                            );
                          }
                          if (part.type === 'reasoning') {
                            return (
                              <Marker key={key}>
                                <MarkerIcon>
                                  <Icons.sparkles />
                                </MarkerIcon>
                                <MarkerContent>{part.text}</MarkerContent>
                              </Marker>
                            );
                          }
                          return null;
                        })}
                      </MessageContent>
                    </Message>
                  </MessageScrollerItem>
                ))
              )}
              {isBusy && (
                <MessageScrollerItem messageId='pending'>
                  <Message align='start'>
                    <MessageAvatar className='bg-primary/10 text-primary size-8 self-start'>
                      <Icons.sparkles />
                    </MessageAvatar>
                    <MessageContent>
                      <Marker>
                        <MarkerIcon>
                          <Icons.sparkles />
                        </MarkerIcon>
                        <MarkerContent className='shimmer'>正在整理你的节奏…</MarkerContent>
                      </Marker>
                    </MessageContent>
                  </Message>
                </MessageScrollerItem>
              )}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>
      </MessageScrollerProvider>

      {error && (
        <Alert variant='destructive' className='mx-4 mt-4 sm:mx-6'>
          <Icons.alertCircle />
          <AlertTitle>这次没有接上 AI</AlertTitle>
          <AlertDescription className='flex flex-wrap items-center gap-2'>
            <span>{error.message || '服务暂时不可用'}</span>
            <Button variant='outline' size='sm' onClick={clearError}>
              知道了
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <CardFooter className='flex-col items-stretch gap-3 border-t p-4 sm:p-5'>
        <div className='flex flex-wrap gap-2'>
          {QUICK_PROMPTS.slice(0, 3).map(({ icon: Icon, label, prompt }) => (
            <Button
              key={label}
              variant='ghost'
              size='sm'
              disabled={!aiConfigured || isBusy}
              onClick={() => submit(prompt)}
            >
              <Icon data-icon='inline-start' />
              {label}
            </Button>
          ))}
        </div>
        <form
          className='flex flex-col gap-2 sm:flex-row sm:items-end'
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <Textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={
              aiConfigured ? '例如：我今晚只有两小时，帮我安排一段专注。' : '等待管理员配置 AI 服务'
            }
            disabled={!aiConfigured || isBusy}
            rows={2}
            className='min-h-12 resize-none sm:min-h-10'
            aria-label='发送给席定领航的问题'
          />
          {isBusy ? (
            <Button type='button' variant='outline' onClick={() => void stop()}>
              <Icons.close data-icon='inline-start' />
              停止
            </Button>
          ) : (
            <Button type='submit' disabled={!input.trim() || !aiConfigured}>
              <Icons.send data-icon='inline-start' />
              发送
            </Button>
          )}
        </form>
      </CardFooter>
    </Card>
  );
}

function NavigatorContext({ context }: { context: AssistantContext }) {
  const nextTask = context.booking.tasks.find((task) => task.status === 'enabled');
  const activeRoom = context.focus.joinedRooms.find((room) => room.timerStatus === '进行中');

  return (
    <div className='flex min-w-0 flex-col gap-5'>
      <Card className='shadow-none'>
        <CardHeader className='border-b'>
          <CardDescription>今天的上下文</CardDescription>
          <CardTitle>先看一眼，再开始</CardTitle>
          <CardAction>
            <Badge variant='outline'>{context.booking.executionDate || '未同步日期'}</Badge>
          </CardAction>
        </CardHeader>
        <CardContent className='grid gap-3 pt-5 sm:grid-cols-2 xl:grid-cols-1'>
          <ContextMetric
            icon={Icons.target}
            label='下一条预约任务'
            value={nextTask?.name || '还没有启用任务'}
            detail={nextTask ? `${nextTask.venue} · ${nextTask.time}` : '去预约任务里创建一条'}
          />
          <ContextMetric
            icon={Icons.clock}
            label='正在专注的房间'
            value={activeRoom?.name || '当前没有进行中的房间'}
            detail={
              activeRoom
                ? `${activeRoom.phase} · ${formatSeconds(activeRoom.remainingSeconds)} 后更新`
                : '去席定自习室找个房间'
            }
          />
          <ContextMetric
            icon={Icons.flame}
            label='席定币'
            value={`${context.rewards.pointsBalance}`}
            detail={`${context.rewards.membership} · 每日签到 +${context.rewards.checkInPoints}`}
          />
        </CardContent>
        <CardFooter className='gap-2'>
          <Link
            href='/dashboard/focus'
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            去自习室 <Icons.arrowRight data-icon='inline-end' />
          </Link>
          <Link
            href='/dashboard/tasks'
            className={buttonVariants({ variant: 'ghost', size: 'sm' })}
          >
            管理任务
          </Link>
        </CardFooter>
      </Card>

      <Card className='shadow-none'>
        <CardHeader>
          <CardDescription>领航能做什么</CardDescription>
          <CardTitle>四个入口，少一点空聊</CardTitle>
        </CardHeader>
        <CardContent className='flex flex-col gap-3'>
          <NavigatorFeature
            icon={Icons.target}
            title='专注主持'
            body='开始前定目标，结束后留下复盘。'
          />
          <NavigatorFeature
            icon={Icons.calendar}
            title='学习计划'
            body='把一周目标拆成可执行的专注段。'
          />
          <NavigatorFeature
            icon={Icons.mapPin}
            title='空间建议'
            body='结合任务和偏好，给出选空间的思路。'
          />
          <NavigatorFeature
            icon={Icons.trendingUp}
            title='节奏洞察'
            body='解释预约、房间和奖励里的变化。'
          />
        </CardContent>
      </Card>
    </div>
  );
}

function ContextMetric({
  icon: Icon,
  label,
  value,
  detail
}: {
  icon: IconType;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className='flex min-w-0 gap-3 rounded-lg border p-3'>
      <div className='bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg'>
        <Icon />
      </div>
      <div className='min-w-0'>
        <p className='text-muted-foreground text-xs'>{label}</p>
        <p className='mt-1 truncate text-sm font-medium'>{value}</p>
        <p className='text-muted-foreground mt-1 truncate text-xs'>{detail}</p>
      </div>
    </div>
  );
}

function NavigatorFeature({
  icon: Icon,
  title,
  body
}: {
  icon: IconType;
  title: string;
  body: string;
}) {
  return (
    <div className='flex gap-3'>
      <div className='bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-lg'>
        <Icon />
      </div>
      <div className='min-w-0'>
        <p className='text-sm font-medium'>{title}</p>
        <p className='text-muted-foreground mt-1 text-sm leading-5'>{body}</p>
      </div>
    </div>
  );
}

type IconType = typeof Icons.sparkles;

function formatSeconds(seconds: number): string {
  const minutes = Math.max(0, Math.floor(seconds / 60));
  const rest = Math.max(0, seconds) % 60;
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}
