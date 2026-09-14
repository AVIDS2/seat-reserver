'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

import { Icons } from '@/components/icons';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';

import type { BookingCaptchaChallenge } from '../types';

type CaptchaPoint = { x: number; y: number };

export function LibraryCaptchaDialog({
  open,
  onOpenChange,
  challenge,
  loading,
  error,
  onRefresh,
  onVerify
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  challenge: BookingCaptchaChallenge | null;
  loading: boolean;
  error: string;
  onRefresh: () => void;
  onVerify: (points: CaptchaPoint[]) => void;
}) {
  const imageRef = useRef<HTMLImageElement>(null);
  const [points, setPoints] = useState<CaptchaPoint[]>([]);
  const [imageSize, setImageSize] = useState({ width: 1, height: 1 });

  useEffect(() => {
    setPoints([]);
  }, [challenge?.id]);

  const addPoint = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (!challenge || points.length >= challenge.requiredClicks) return;
    const image = imageRef.current;
    if (!image) return;
    const rect = image.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const x = Math.round(((event.clientX - rect.left) / rect.width) * image.naturalWidth);
    const y = Math.round(((event.clientY - rect.top) / rect.height) * image.naturalHeight);
    setPoints((current) => [...current, { x, y }]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='flex max-h-[calc(100svh-1rem)] w-[calc(100%-1rem)] max-w-[520px] flex-col overflow-hidden p-4 sm:p-5'>
        <DialogHeader className='shrink-0 pr-8'>
          <DialogTitle>验证本次预约</DialogTitle>
          <DialogDescription>
            按提示顺序点选图片。验证通过后只提交这一次预约，不会开启自动抢座。
          </DialogDescription>
        </DialogHeader>

        <div className='min-h-0 flex-1 overflow-y-auto overscroll-contain'>
          {error && (
            <Alert variant='destructive' className='mb-4'>
              <Icons.warning />
              <AlertTitle>验证失败</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {loading ? (
            <div
              className='flex min-h-72 flex-col items-center justify-center gap-3 rounded-lg border'
              aria-live='polite'
            >
              <Spinner />
                <p className='text-muted-foreground text-sm'>正在获取验证图片…</p>
            </div>
          ) : !challenge ? (
            <div className='flex min-h-72 flex-col items-center justify-center gap-3 rounded-lg border px-6 text-center'>
              <Icons.warning className='text-muted-foreground' />
                <p className='text-sm font-medium'>验证图片已失效</p>
              <Button type='button' variant='outline' onClick={onRefresh}>
                <Icons.refresh data-icon='inline-start' />
                重新获取
              </Button>
            </div>
          ) : (
            <div className='flex flex-col gap-4'>
              <div className='flex items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2'>
                <div className='flex min-w-0 items-center gap-2'>
                  <span className='text-sm font-medium'>请依次点击</span>
                  <Image
                    src={challenge.wordImage}
                    alt='需要依次点击的文字'
                    width={120}
                    height={48}
                    unoptimized
                    className='h-10 w-auto max-w-32 object-contain'
                  />
                </div>
                <span className='text-muted-foreground shrink-0 text-xs tabular-nums'>
                  {points.length}/{challenge.requiredClicks}
                </span>
              </div>

              <button
                type='button'
                className='relative w-full overflow-hidden rounded-lg border bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring/50'
                onClick={addPoint}
                aria-label={`验证码图片，已选择 ${points.length} 个位置，共需选择 ${challenge.requiredClicks} 个`}
              >
                <Image
                  ref={imageRef}
                  src={challenge.image}
                  alt='学校预约点选验证码'
                  width={660}
                  height={320}
                  unoptimized
                  draggable={false}
                  className='block h-auto w-full select-none'
                  onLoad={(event) =>
                    setImageSize({
                      width: event.currentTarget.naturalWidth || 1,
                      height: event.currentTarget.naturalHeight || 1
                    })
                  }
                />
                {points.map((point, index) => (
                  <span
                    key={`${point.x}-${point.y}-${index}`}
                    className='pointer-events-none absolute flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground ring-2 ring-background'
                    style={{
                      left: `${(point.x / imageSize.width) * 100}%`,
                      top: `${(point.y / imageSize.height) * 100}%`
                    }}
                  >
                    {index + 1}
                  </span>
                ))}
              </button>

              <div className='flex items-center justify-between gap-3'>
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  disabled={!points.length || loading}
                  onClick={() => setPoints((current) => current.slice(0, -1))}
                >
                  撤销上一步
                </Button>
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  onClick={onRefresh}
                  disabled={loading}
                >
                  <Icons.refresh data-icon='inline-start' />
                  换一张
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className='shrink-0'>
          <Button
            type='button'
            variant='outline'
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            取消
          </Button>
          <Button
            type='button'
            disabled={!challenge || loading || points.length !== challenge.requiredClicks}
            onClick={() => onVerify(points)}
          >
            {loading ? (
              <Spinner data-icon='inline-start' />
            ) : (
              <Icons.shield data-icon='inline-start' />
            )}
            {loading ? '验证中' : '验证并预约'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
