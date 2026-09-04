'use client';

import {
  IconArmchair2,
  IconCalendarCheck,
  IconClock,
  IconKey,
  IconListCheck,
  IconShieldCheck
} from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import type { ComponentType, CSSProperties } from 'react';

interface OrbitIconConfig {
  id: string;
  component: ComponentType;
  circleIndex: number;
  position: number;
  size?: number;
}

const iconConfigs: OrbitIconConfig[] = [
  { id: 'seat', component: IconArmchair2, circleIndex: 1, position: 0 },
  { id: 'clock', component: IconClock, circleIndex: 1, position: 120, size: 24 },
  { id: 'calendar', component: IconCalendarCheck, circleIndex: 1, position: 270, size: 24 },
  { id: 'key', component: IconKey, circleIndex: 2, position: 90, size: 24 },
  { id: 'strategy', component: IconListCheck, circleIndex: 2, position: 210, size: 24 },
  { id: 'shield', component: IconShieldCheck, circleIndex: 2, position: 330, size: 24 }
];

const circles = [
  { radius: 120, orbitPeriod: 72, ringPeriod: 180 },
  { radius: 180, orbitPeriod: 120, ringPeriod: 240 },
  { radius: 240, orbitPeriod: 180, ringPeriod: 360 },
  { radius: 300, orbitPeriod: 360, ringPeriod: 720 }
];

const ringGradients = [
  'conic-gradient(from 0deg, hsl(var(--primary) / 0.15), hsl(var(--primary) / 0), hsl(var(--primary) / 0), hsl(var(--primary) / 0.15), hsl(var(--primary) / 0), hsl(var(--primary) / 0.05), hsl(var(--primary) / 0.15))',
  'conic-gradient(from 45deg, hsl(var(--primary) / 0.12), hsl(var(--primary) / 0), hsl(var(--primary) / 0.08), hsl(var(--primary) / 0), hsl(var(--primary) / 0.2), hsl(var(--primary) / 0), hsl(var(--primary) / 0.12))',
  'conic-gradient(from 90deg, hsl(var(--primary) / 0.1), hsl(var(--primary) / 0.18), hsl(var(--primary) / 0.1), hsl(var(--primary) / 0), hsl(var(--primary) / 0.15), hsl(var(--primary) / 0), hsl(var(--primary) / 0.1))',
  'conic-gradient(from 135deg, hsl(var(--primary) / 0.08), hsl(var(--primary) / 0), hsl(var(--primary) / 0.16), hsl(var(--primary) / 0.06), hsl(var(--primary) / 0), hsl(var(--primary) / 0.12), hsl(var(--primary) / 0.08))'
];

export function Orbit() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const update = () => setNow(new Date());
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const secondsToSync = now ? 60 - now.getSeconds() : 60;

  return (
    <div className='relative flex h-[500px] w-[500px] items-center justify-center'>
      <style>{`
        @keyframes ring-spin { to { transform: rotate(360deg); } }
        @keyframes orbit-spin { from { transform: rotate(var(--start-angle, 0deg)); } to { transform: rotate(calc(var(--start-angle, 0deg) + 360deg)); } }
        @keyframes orbit-counter-spin { from { transform: rotate(calc(var(--start-angle, 0deg) * -1)); } to { transform: rotate(calc(var(--start-angle, 0deg) * -1 - 360deg)); } }
        @media (prefers-reduced-motion: reduce) { .orbit-motion { animation: none !important; } }
      `}</style>

      <div className='absolute flex flex-col items-center gap-2'>
        <p className='text-muted-foreground text-xs font-semibold tracking-[0.16em] uppercase'>
          系统在线
        </p>
        <p className='font-mono text-5xl leading-none font-black text-amber-600 tabular-nums dark:text-amber-400'>
          {formatClock(now)}
        </p>
        <div className='text-muted-foreground flex items-center gap-2 text-xs'>
          <span className='size-1.5 rounded-full bg-emerald-500' />
          <span>下一次状态同步</span>
          <span className='font-mono tabular-nums'>{formatCountdown(secondsToSync)}</span>
        </div>
      </div>

      {circles.map((circle, circleIndex) => (
        <div
          key={circleIndex}
          className='orbit-motion absolute rounded-full'
          style={{
            width: circle.radius * 2,
            height: circle.radius * 2,
            background: ringGradients[circleIndex],
            mask: `radial-gradient(circle at center, transparent ${circle.radius - 2}px, black ${circle.radius - 1}px, black ${circle.radius}px, transparent ${circle.radius + 1}px)`,
            WebkitMask: `radial-gradient(circle at center, transparent ${circle.radius - 2}px, black ${circle.radius - 1}px, black ${circle.radius}px, transparent ${circle.radius + 1}px)`,
            animation: `ring-spin ${circle.ringPeriod}s linear infinite`
          }}
        />
      ))}

      {iconConfigs.map((iconConfig) => {
        const circle = circles[iconConfig.circleIndex];
        const iconSize = iconConfig.size || 32;
        const IconComponent = iconConfig.component;
        return (
          <div
            key={iconConfig.id}
            className='orbit-motion absolute top-1/2 left-1/2'
            style={
              {
                width: 0,
                height: 0,
                '--start-angle': `${iconConfig.position}deg`,
                animation: `orbit-spin ${circle.orbitPeriod}s linear infinite`
              } as CSSProperties
            }
          >
            <div style={{ transform: `translateX(${circle.radius}px)` }}>
              <div
                className='orbit-motion text-primary z-20 flex items-center justify-center'
                style={{
                  width: iconSize,
                  height: iconSize,
                  marginLeft: -iconSize / 2,
                  marginTop: -iconSize / 2,
                  animation: `orbit-counter-spin ${circle.orbitPeriod}s linear infinite`
                }}
              >
                <IconComponent />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function formatClock(value: Date | null): string {
  if (!value) return '--:--';
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).format(value);
}

function formatCountdown(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}
