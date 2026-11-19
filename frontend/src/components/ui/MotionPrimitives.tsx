import React, { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';

export const FORENSIC_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

export const StaggerContainer: React.FC<{
  children: React.ReactNode;
  className?: string;
  staggerDelay?: number;
}> = ({ children, className = '', staggerDelay = 0.045 }) => (
  <motion.div
    initial="hidden"
    animate="visible"
    variants={{
      hidden: {},
      visible: {
        transition: {
          staggerChildren: staggerDelay,
        },
      },
    }}
    className={className}
  >
    {children}
  </motion.div>
);

export const StaggerItem: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => (
  <motion.div
    variants={{
      hidden: { opacity: 0, y: 10 },
      visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.28, ease: FORENSIC_EASE },
      },
    }}
    className={className}
  >
    {children}
  </motion.div>
);

export const ForensicCard: React.FC<{
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}> = ({ children, className = '', onClick }) => (
  <motion.div
    whileHover={{ y: -2 }}
    whileTap={onClick ? { scale: 0.992 } : undefined}
    transition={{ duration: 0.16, ease: FORENSIC_EASE }}
    onClick={onClick}
    className={className}
  >
    {children}
  </motion.div>
);

export const AnimatedCounter: React.FC<{
  value: number;
  durationMs?: number;
  className?: string;
}> = ({ value, durationMs = 480, className = '' }) => {
  const prefersReduced = useReducedMotion();
  const [display, setDisplay] = useState(prefersReduced ? value : 0);

  useEffect(() => {
    if (prefersReduced) {
      setDisplay(value);
      return;
    }

    let rafId = 0;
    const startVal = display;
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(startVal + (value - startVal) * eased));
      if (progress < 1) {
        rafId = window.requestAnimationFrame(tick);
      }
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, prefersReduced, durationMs]);

  return <span className={`tabular-nums ${className}`}>{display}</span>;
};

export const ForensicScanOverlay: React.FC<{
  active?: boolean;
  label?: string;
}> = ({ active = true, label }) => {
  if (!active) return null;
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Precision optical scanline — used strictly during active backend submission */}
      <div className="animate-forensic-scan absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-transparent via-tl-cyan/20 to-transparent border-b border-tl-cyan/50" />
      <span className="absolute top-2.5 left-2.5 w-2.5 h-2.5 border-t border-l border-tl-cyan/60" />
      <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 border-t border-r border-tl-cyan/60" />
      <span className="absolute bottom-2.5 left-2.5 w-2.5 h-2.5 border-b border-l border-tl-cyan/60" />
      <span className="absolute bottom-2.5 right-2.5 w-2.5 h-2.5 border-b border-r border-tl-cyan/60" />
      {label && (
        <div className="absolute top-3 right-3 px-2 py-0.5 rounded bg-tl-bg/90 border border-tl-border font-mono text-[10px] text-tl-cyan">
          {label}
        </div>
      )}
    </div>
  );
};
