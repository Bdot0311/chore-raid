import { motion } from 'motion/react';
import type { BossDef } from '../game/types';

interface Props {
  boss: BossDef;
  /** 0–1 */
  hpPct: number;
  /** Changes on every hit to retrigger the flash. */
  hitKey: number;
}

/** Day 1 placeholder: a tinted mess-blob that shrinks and panics as HP drops. */
export function BossArt({ boss, hpPct, hitKey }: Props) {
  const scale = 0.55 + 0.45 * hpPct;
  const body = `hsl(${boss.hue} 70% 55%)`;
  const shade = `hsl(${boss.hue} 60% 35%)`;
  const panic = hpPct < 0.25;
  const sway = panic ? 6 : hpPct < 0.5 ? 4 : 2;

  return (
    <motion.div
      className="relative mx-auto aspect-square w-full max-w-[22rem]"
      animate={{ scale, rotate: [-sway, sway, -sway] }}
      transition={{
        scale: { type: 'spring', stiffness: 260, damping: 18 },
        rotate: { duration: panic ? 0.8 : 2.4, repeat: Infinity, ease: 'easeInOut' },
      }}
    >
      <motion.svg
        key={hitKey}
        viewBox="0 0 200 200"
        className="h-full w-full"
        initial={hitKey ? { scaleX: 1.12, scaleY: 0.88, filter: 'brightness(3)' } : false}
        animate={{ scaleX: 1, scaleY: 1, filter: 'brightness(1)' }}
        transition={{ type: 'spring', stiffness: 500, damping: 14 }}
        aria-hidden
      >
        <path
          d="M30 160c-6-50 14-120 70-120s76 70 70 120c-12-8-18 6-30-2-10 10-18-4-26 4-8-8-18 6-28-2-10 8-18-6-28 2-10-8-18 4-28-2z"
          fill={body}
          stroke={shade}
          strokeWidth="6"
          strokeLinejoin="round"
        />
        {/* Eyes: smug lids at full HP, wide open when it's losing. */}
        <ellipse cx="78" cy="95" rx="15" ry={panic ? 17 : 13} fill="#fff" />
        <ellipse cx="122" cy="95" rx="15" ry={panic ? 17 : 13} fill="#fff" />
        <circle cx="80" cy="98" r={panic ? 5 : 7} fill="#15122b" />
        <circle cx="124" cy="98" r={panic ? 5 : 7} fill="#15122b" />
        {hpPct > 0.5 && (
          <>
            <rect x="60" y="80" width="36" height="9" fill={body} />
            <rect x="104" y="80" width="36" height="9" fill={body} />
          </>
        )}
        <path
          d={hpPct > 0.5 ? 'M80 128q20 6 40 0' : panic ? 'M84 132q16-14 32 0' : 'M82 130h36'}
          stroke="#15122b"
          strokeWidth="5"
          fill="none"
          strokeLinecap="round"
        />
      </motion.svg>
    </motion.div>
  );
}
