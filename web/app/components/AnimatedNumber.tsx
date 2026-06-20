'use client';
import { useEffect, useRef, useState } from 'react';

type Props = {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  className?: string;
};

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Tweens to `value` whenever it changes (count-up animation). Continues smoothly
 * from the currently displayed number if the value changes mid-flight. Snaps
 * instantly for users who prefer reduced motion.
 */
export function AnimatedNumber({ value, format = (n) => String(n), duration = 700, className }: Props) {
  const [display, setDisplay] = useState(value);
  const displayRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const from = displayRef.current;
    const to = value;
    if (reduce || from === to) {
      displayRef.current = to;
      setDisplay(to);
      return;
    }

    let start = 0;
    const step = (ts: number) => {
      if (!start) start = ts;
      const t = Math.min((ts - start) / duration, 1);
      const v = from + (to - from) * easeOutCubic(t);
      displayRef.current = v;
      setDisplay(v);
      if (t < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration]);

  return <span className={className}>{format(display)}</span>;
}
