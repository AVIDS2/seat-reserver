"use client";

import * as React from "react";
import { motion } from "motion/react";

import { Icons } from "@/components/icons";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export type LeaderboardRankingItem = {
  userId: string;
  userName: string | null;
  rank: number;
  value: number;
  valueLabel?: string;
  byline?: string | null;
  avatarUrl?: string | null;
};

const rankColors = {
  1: "border-amber-400/50 bg-amber-400/15 text-amber-700 dark:text-amber-300",
  2: "border-sky-300/50 bg-sky-300/15 text-sky-700 dark:text-sky-300",
  3: "border-rose-300/50 bg-rose-300/15 text-rose-700 dark:text-rose-300",
} as const;

export function LeaderboardRankings({
  rankings,
  currentUserId,
  className,
}: {
  rankings: LeaderboardRankingItem[];
  currentUserId?: string;
  className?: string;
}) {
  const [page, setPage] = React.useState(1);
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(rankings.length / pageSize));
  const rows = rankings.slice((page - 1) * pageSize, page * pageSize);
  const maxValue = Math.max(...rankings.map((item) => item.value), 1);

  React.useEffect(() => {
    setPage(1);
  }, [rankings]);

  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-xl border bg-card",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b bg-muted/30 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="bg-primary/10 text-primary flex size-8 items-center justify-center rounded-lg">
            <Icons.flame />
          </span>
          <div>
            <p className="text-sm font-semibold">全量榜单</p>
            <p className="text-muted-foreground text-xs">按预约学习时长排序</p>
          </div>
        </div>
        <Badge variant="secondary">{rankings.length} 人</Badge>
      </div>
      <div className="divide-y">
        {rows.map((item, index) => {
          const current = item.userId === currentUserId;
          const name = item.userName || "未命名用户";
          const rankColor = rankColors[item.rank as 1 | 2 | 3];
          const percent = Math.max(
            6,
            Math.round((item.value / maxValue) * 100),
          );
          return (
            <motion.div
              key={item.userId}
              layout
              initial={{ opacity: 0, x: -14 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                duration: 0.28,
                delay: index * 0.035,
                ease: "easeOut",
              }}
              className={cn(
                "group/row relative flex items-center gap-3 px-3 py-3 transition-colors hover:bg-muted/35 sm:px-4",
                current && "bg-primary/[0.07] hover:bg-primary/10",
              )}
            >
              {current && (
                <span
                  className="bg-primary absolute inset-y-0 left-0 w-1"
                  aria-hidden="true"
                />
              )}
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-lg border text-sm font-bold tabular-nums",
                  rankColor || "border-border bg-muted text-muted-foreground",
                )}
              >
                {item.rank <= 3 ? (
                  item.rank === 1 ? (
                    <Icons.trophy />
                  ) : item.rank === 2 ? (
                    <Icons.medal />
                  ) : (
                    <Icons.award />
                  )
                ) : (
                  item.rank
                )}
              </span>
              <Avatar className="size-9 shrink-0">
                {item.avatarUrl && <AvatarImage src={item.avatarUrl} alt="" />}
                <AvatarFallback
                  className={cn(
                    current && "bg-primary text-primary-foreground",
                  )}
                >
                  {name.slice(0, 1)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                  <p className="truncate text-sm font-semibold">{name}</p>
                  {current && (
                    <Badge variant="default" className="shrink-0">
                      <Icons.star data-icon="inline-start" /> 你
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground mt-0.5 truncate text-xs">
                  {item.byline}
                </p>
                <Progress
                  value={percent}
                  aria-label={`${name} 的预约时长占榜首比例 ${percent}%`}
                  className={cn(
                    "mt-2 h-1.5 gap-0 [&_[data-slot=progress-track]]:h-1.5",
                    item.rank === 1
                      ? "[&_[data-slot=progress-indicator]]:bg-amber-400"
                      : item.rank === 2
                        ? "[&_[data-slot=progress-indicator]]:bg-sky-400"
                        : item.rank === 3
                          ? "[&_[data-slot=progress-indicator]]:bg-rose-400"
                          : "[&_[data-slot=progress-indicator]]:bg-primary",
                  )}
                />
              </div>
              <p className="shrink-0 text-right text-sm font-bold tabular-nums">
                {item.valueLabel || formatMinutes(item.value)}
              </p>
            </motion.div>
          );
        })}
      </div>
      {rankings.length > pageSize && (
        <div className="flex items-center justify-between gap-3 border-t px-3 py-2 sm:px-4">
          <span className="text-muted-foreground text-xs">
            第 {page} / {totalPages} 页
          </span>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              disabled={page === 1}
              aria-label="上一页"
            >
              <Icons.chevronLeft />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() =>
                setPage((value) => Math.min(totalPages, value + 1))
              }
              disabled={page === totalPages}
              aria-label="下一页"
            >
              <Icons.chevronRight />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function formatMinutes(value: number) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return hours
    ? `${hours} 小时${minutes ? ` ${minutes} 分钟` : ""}`
    : `${minutes} 分钟`;
}
