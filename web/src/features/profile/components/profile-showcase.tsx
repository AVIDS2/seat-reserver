'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { ProfileAvatar, ProfileTitlePill } from '@/components/profile/profile-avatar';
import { Icons } from '@/components/icons';
import { AchievementBadge, type UserAchievement } from '@/components/ui/achievement-badge';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PointsBadge } from '@/components/ui/points-badge';
import { StreakBadge } from '@/components/ui/streak-badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import {
  type PlatformUser,
  type ProfileShowcase,
  updateProfileShowcase
} from '@/features/booking/api/service';

type ShowcaseTab = 'frame' | 'title' | 'badge';

const badgeIcons = {
  welcome: Icons.sparkles,
  first_success: Icons.trophy,
  streak_7: Icons.flame,
  seat_master: Icons.target,
  pro: Icons.pro
};

const badgeTones: Record<string, string> = {
  welcome: 'border-sky-300/50 bg-sky-400/10 text-sky-700 dark:text-sky-300',
  first_success: 'border-amber-300/50 bg-amber-400/10 text-amber-800 dark:text-amber-300',
  streak_7: 'border-emerald-300/50 bg-emerald-400/10 text-emerald-800 dark:text-emerald-300',
  seat_master: 'border-rose-300/50 bg-rose-400/10 text-rose-800 dark:text-rose-300',
  pro: 'border-violet-300/50 bg-violet-400/10 text-violet-800 dark:text-violet-300'
};

export function ProfileShowcasePanel({
  user,
  initialShowcase,
  onSelectionSaved
}: {
  user: PlatformUser | null;
  initialShowcase: ProfileShowcase | undefined;
  onSelectionSaved: (showcase: ProfileShowcase) => void;
}) {
  const [showcase, setShowcase] = useState(initialShowcase);
  const [tab, setTab] = useState<ShowcaseTab>('frame');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setShowcase(initialShowcase);
  }, [initialShowcase]);

  if (!showcase) return null;

  const save = async (key: ShowcaseTab, value: string) => {
    if (saving) return;
    setSaving(true);
    try {
      const next = await updateProfileShowcase({
        ...(key === 'frame' ? { avatarFrameId: value } : {}),
        ...(key === 'title' ? { titleId: value } : {}),
        ...(key === 'badge' ? { badgeId: value } : {})
      });
      setShowcase(next);
      onSelectionSaved(next);
      toast.success('装扮已更新');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '装扮保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className='shadow-none'>
      <CardHeader className='border-b'>
        <div className='flex items-start justify-between gap-3'>
          <div>
            <CardDescription>个性装扮</CardDescription>
            <CardTitle className='mt-1'>头像框、称号与徽章</CardTitle>
            <p className='text-muted-foreground mt-1 text-sm leading-6'>
              选择头像框、称号和徽章，展示你的学习状态。
            </p>
          </div>
          <ProfileAvatar
            avatarUrl={user?.avatarUrl}
            name={user?.displayName}
            frameId={showcase.selected.avatarFrameId}
            size='lg'
          />
        </div>
      </CardHeader>
      <CardContent className='flex flex-col gap-5 pt-5'>
        <div className='grid gap-3 sm:grid-cols-2'>
          <PointsBadge name='席定币' total={showcase.stats.pointsBalance} />
          <StreakBadge
            size='sm'
            length={showcase.stats.checkInStreak}
            unitLabel='天'
            subtitle='连续签到'
            className='w-full flex-row justify-start gap-3 p-4'
            frequency='daily'
          />
        </div>
        <ToggleGroup
          value={[tab]}
          onValueChange={(values) => setTab((values[0] as ShowcaseTab) || 'frame')}
          variant='outline'
          spacing={0}
          aria-label='选择装扮类型'
        >
          <ToggleGroupItem value='frame'>头像框</ToggleGroupItem>
          <ToggleGroupItem value='title'>称号</ToggleGroupItem>
          <ToggleGroupItem value='badge'>徽章</ToggleGroupItem>
        </ToggleGroup>

        {tab === 'frame' && (
          <div className='grid grid-cols-2 gap-3 sm:grid-cols-4'>
            {showcase.frames.map((item) => (
              <button
                key={item.id}
                type='button'
                disabled={!item.unlocked || saving}
                aria-pressed={showcase.selected.avatarFrameId === item.id}
                onClick={() => void save('frame', item.id)}
                className='flex min-w-0 flex-col items-center gap-2 rounded-lg border p-3 text-center transition-colors hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-45 aria-pressed:border-primary aria-pressed:bg-primary/5'
              >
                <ProfileAvatar
                  avatarUrl={user?.avatarUrl}
                  name={user?.displayName}
                  frameId={item.id}
                  size='lg'
                />
                <span className='text-sm font-medium'>{item.name}</span>
                <span className='text-muted-foreground line-clamp-2 text-xs'>
                  {item.unlocked ? item.description : item.lockedReason}
                </span>
              </button>
            ))}
          </div>
        )}

        {tab === 'title' && (
          <div className='grid gap-2 sm:grid-cols-2'>
            {showcase.titles.map((item) => (
              <button
                key={item.id}
                type='button'
                disabled={!item.unlocked || saving}
                aria-pressed={showcase.selected.titleId === item.id}
                onClick={() => void save('title', item.id)}
                className='flex min-w-0 items-center justify-between gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-45 aria-pressed:border-primary aria-pressed:bg-primary/5'
              >
                <span className='min-w-0'>
                  <ProfileTitlePill title={item.name} titleId={item.id} />
                  <span className='text-muted-foreground mt-1 block truncate text-xs'>
                    {item.unlocked ? item.description : item.lockedReason}
                  </span>
                </span>
                <Badge variant={showcase.selected.titleId === item.id ? 'default' : 'outline'}>
                  {item.unlocked ? '可用' : '未解锁'}
                </Badge>
              </button>
            ))}
          </div>
        )}

        {tab === 'badge' && (
          <div className='grid grid-cols-2 gap-3 sm:grid-cols-4'>
            {showcase.badges.map((item) => {
              const achievement: UserAchievement = {
                id: item.id,
                name: item.name,
                trigger: item.id === 'streak_7' ? 'streak' : 'metric',
                achievedAt: item.unlockedAt,
                unlocked: item.unlocked
              };
              const BadgeIcon = badgeIcons[item.id as keyof typeof badgeIcons] || Icons.award;
              return (
                <AchievementBadge
                  key={item.id}
                  achievement={achievement}
                  badgeSize='sm'
                  icon={BadgeIcon}
                  iconClassName='text-current'
                  badgeClassName='bg-current/10 text-current'
                  aria-disabled={!item.unlocked || saving}
                  aria-pressed={showcase.selected.badgeId === item.id}
                  onAchievementClick={() => {
                    if (item.unlocked && !saving) void save('badge', item.id);
                  }}
                  className={cn(
                    badgeTones[item.id],
                    showcase.selected.badgeId === item.id && 'ring-2 ring-primary'
                  )}
                />
              );
            })}
          </div>
        )}
        <p className='text-muted-foreground text-xs'>
          当前称号：{showcase.selected.titleLabel} · 选择后会同步到排行榜和个人头像。
        </p>
      </CardContent>
    </Card>
  );
}
