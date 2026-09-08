'use client';

import { useInView, useMotionValue, useSpring } from 'motion/react';
import { useEffect, useRef } from 'react';

// Adapted from React Bits CountUp (MIT + Commons Clause), used as part of this app.
// https://github.com/DavidHDev/react-bits
export default function CountUp({
  to,
  from = 0,
  duration = 0.8,
  className = ''
}: {
  to: number;
  from?: number;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const value = useMotionValue(from);
  const spring = useSpring(value, {
    damping: 28,
    stiffness: 100 / Math.max(0.25, duration)
  });
  const inView = useInView(ref, { once: true, margin: '0px' });

  useEffect(() => {
    if (inView) value.set(to);
  }, [inView, to, value]);

  useEffect(() => {
    return spring.on('change', (latest) => {
      if (ref.current) ref.current.textContent = Math.round(latest).toLocaleString('zh-CN');
    });
  }, [spring]);

  return <span ref={ref} className={className}>{from.toLocaleString('zh-CN')}</span>;
}
