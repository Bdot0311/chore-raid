import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { sfx } from '../audio/sfx';
import { CHEST_ART, bossSpriteUrl } from '../game/bossArt';
import { unitWord } from '../game/bosses';
import { RARITIES, RARITY_COLOR } from '../game/loot';
import type { BossDef, LootItem, Raid } from '../game/types';
import { formatDuration } from '../lib/format';
import { getPhoto } from '../lib/photos';
import { renderWinCard } from '../lib/winCard';
import { PhotoCapture } from './PhotoCapture';

interface Props {
  boss: BossDef;
  raid: Raid;
  loot: LootItem;
  onAfterPhoto: (file: File) => Promise<Raid>;
  onDone: () => void;
}

type Phase = 'chest' | 'loot' | 'card';

const primaryBtn =
  'w-full rounded-2xl bg-gradient-to-b from-[#ff8a5c] to-ember py-4 font-display text-xl tracking-wide text-dungeon-950 shadow-[inset_0_2px_0_rgba(255,255,255,0.4),0_5px_0_#a8391a] transition active:translate-y-1 active:shadow-none disabled:opacity-60';
const secondaryBtn =
  'w-full rounded-2xl bg-dungeon-800 py-4 font-display text-xl tracking-wide text-bone shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_5px_0_#0d0b1a] ring-1 ring-white/10 transition active:translate-y-1 active:shadow-none';

function Chest({ shaking, open, color }: { shaking: boolean; open: boolean; color: string }) {
  if (CHEST_ART) return <img src={CHEST_ART} alt="" className="h-full w-full object-contain" draggable={false} />;
  return (
    <svg viewBox="0 0 200 170" className="h-full w-full drop-shadow-2xl">
      <defs>
        <linearGradient id="wood" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#7a4a26" />
          <stop offset="1" stopColor="#3d2312" />
        </linearGradient>
        <linearGradient id="gold" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#ffe08a" />
          <stop offset="1" stopColor="#c98a1c" />
        </linearGradient>
      </defs>
      {open && <ellipse cx="100" cy="72" rx="80" ry="22" fill={color} opacity="0.9" />}
      <rect x="22" y="72" width="156" height="86" rx="10" fill="url(#wood)" stroke="#2a170b" strokeWidth="4" />
      <rect x="22" y="100" width="156" height="12" fill="url(#gold)" />
      <rect x="40" y="72" width="12" height="86" fill="url(#gold)" />
      <rect x="148" y="72" width="12" height="86" fill="url(#gold)" />
      <g style={{ transformOrigin: '100px 72px', transform: open ? 'rotate(-28deg) translate(-6px,-26px)' : undefined, transition: 'transform 300ms cubic-bezier(.2,1.6,.4,1)' }}>
        <path d="M22 76 Q22 22 100 22 Q178 22 178 76 Z" fill="url(#wood)" stroke="#2a170b" strokeWidth="4" />
        <path d="M40 76 Q42 34 52 30 L52 76 Z M160 76 Q158 34 148 30 L148 76 Z" fill="url(#gold)" />
      </g>
      <rect x="86" y="88" width="28" height="34" rx="5" fill="url(#gold)" stroke="#8a5a10" strokeWidth="3" />
      <circle cx="100" cy="102" r="5" fill="#3d2312" />
      {!open && shaking && <path d="M30 74 H170" stroke={color} strokeWidth="3" opacity="0.8" />}
    </svg>
  );
}

export function Victory({ boss, raid: initialRaid, loot, onAfterPhoto, onDone }: Props) {
  const [phase, setPhase] = useState<Phase>('chest');
  const [raid, setRaid] = useState(initialRaid);
  const [cardUrl, setCardUrl] = useState<string>();
  const [cardBlob, setCardBlob] = useState<Blob>();
  const color = RARITY_COLOR[loot.rarity];
  const rarityIndex = RARITIES.indexOf(loot.rarity) as 0 | 1 | 2 | 3;

  const openChest = () => {
    sfx.loot(rarityIndex);
    navigator.vibrate?.([30, 40, 30, 40, 120]);
    setPhase('loot');
  };

  useEffect(() => {
    if (phase !== 'card') return;
    let url: string | undefined;
    let cancelled = false;
    void (async () => {
      const [before, after] = await Promise.all([
        raid.beforePhotoId ? getPhoto(raid.beforePhotoId) : undefined,
        raid.afterPhotoId ? getPhoto(raid.afterPhotoId) : undefined,
      ]);
      const blob = await renderWinCard({ boss, raid, loot, before: before?.blob, after: after?.blob, bossArt: bossSpriteUrl(boss) });
      if (cancelled) return;
      url = URL.createObjectURL(blob);
      setCardBlob(blob);
      setCardUrl(url);
    })();
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [phase, raid, boss, loot]);

  const fileName = `chore-raid-${boss.kind}-${new Date(raid.endedAt ?? Date.now()).toISOString().slice(0, 10)}.png`;
  const canShare = cardBlob && typeof navigator.canShare === 'function' && navigator.canShare({ files: [new File([cardBlob], fileName, { type: 'image/png' })] });

  const share = async () => {
    if (!cardBlob) return;
    try {
      await navigator.share({
        files: [new File([cardBlob], fileName, { type: 'image/png' })],
        title: 'Chore Raid',
        text: `I defeated ${boss.name}: ${raid.maxHp} ${unitWord(boss, raid.maxHp)}, done for real.`,
      });
    } catch {
      /* the user closed the share sheet */
    }
  };

  const stats: [string, string][] = [
    [unitWord(boss, raid.maxHp), String(raid.maxHp)],
    ['Time', formatDuration((raid.endedAt ?? Date.now()) - raid.startedAt)],
    ['Best combo', `×${raid.bestCombo}`],
    ['Score', raid.score.toLocaleString()],
  ];

  return (
    <div
      className="min-h-full"
      style={{ background: `radial-gradient(circle at 50% 25%, hsl(${boss.hue} 45% 20%), var(--color-dungeon-950) 70%)` }}
    >
      <div className="safe-pad mx-auto flex min-h-full max-w-md flex-col items-center gap-6 text-center">
        <motion.header initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="pt-4">
          <p className="font-display text-lg tracking-[0.2em] text-gold">VICTORY</p>
          <h1 className="mt-1 font-display text-3xl leading-tight" style={{ color: `hsl(${boss.hue} 80% 72%)` }}>
            {boss.name} is defeated.
          </h1>
          <p className="mt-1 text-ash">It took the chore with it.</p>
        </motion.header>

        <AnimatePresence mode="wait">
          {phase === 'chest' && (
            <motion.button
              key="chest"
              className="relative mt-4 flex flex-col items-center"
              onClick={openChest}
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.3, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 220, damping: 14 }}
            >
              <motion.div
                className="h-52 w-60"
                animate={{ rotate: [0, -4, 4, -3, 3, 0], y: [0, -6, 0] }}
                transition={{ duration: 0.9 - rarityIndex * 0.12, repeat: Infinity, repeatDelay: 0.6 }}
              >
                <Chest shaking open={false} color={color} />
              </motion.div>
              <p className="mt-4 animate-pulse font-display text-2xl text-gold">Tap to open</p>
              <p className="mt-1 text-sm text-ash">
                {raid.lootStars} Loot Star{raid.lootStars === 1 ? '' : 's'} earned
              </p>
            </motion.button>
          )}

          {phase === 'loot' && (
            <motion.div key="loot" className="flex w-full flex-col items-center gap-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="relative grid h-56 w-full place-items-center">
                <motion.div
                  className="absolute h-72 w-72 rounded-full"
                  style={{ background: `conic-gradient(from 0deg, transparent, ${color}55, transparent 30%, ${color}55, transparent 60%, ${color}55, transparent)` }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                />
                <motion.div
                  className="absolute h-40 w-40 rounded-full blur-2xl"
                  style={{ background: color }}
                  initial={{ scale: 0, opacity: 1 }}
                  animate={{ scale: 2.4, opacity: 0.35 }}
                  transition={{ duration: 0.8 }}
                />
                <motion.div className="relative h-44 w-52" initial={{ scale: 1.4 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 10 }}>
                  <Chest shaking={false} open color={color} />
                </motion.div>
              </div>
              <motion.div
                className="w-full rounded-3xl bg-black/40 p-5 ring-2 backdrop-blur"
                style={{ ['--tw-ring-color' as string]: color, boxShadow: `0 0 40px ${color}55` }}
                initial={{ y: 40, opacity: 0, scale: 0.8 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                transition={{ delay: 0.25, type: 'spring', stiffness: 260, damping: 16 }}
              >
                <p className="font-display text-sm tracking-[0.25em]" style={{ color }}>
                  {loot.rarity.toUpperCase()} TROPHY
                </p>
                <p className="mt-1 font-display text-3xl text-white">{loot.name}</p>
              </motion.div>

              <dl className="grid w-full grid-cols-2 gap-3">
                {stats.map(([label, value]) => (
                  <div key={label} className="rounded-2xl bg-dungeon-900/80 p-3 ring-1 ring-white/10">
                    <dt className="text-xs font-bold uppercase tracking-widest text-ash">{label}</dt>
                    <dd className="mt-1 font-display text-2xl tabular-nums text-gold">{value}</dd>
                  </div>
                ))}
              </dl>

              <div className="w-full space-y-3 pb-2">
                <PhotoCapture
                  label={raid.afterPhotoId ? 'Retake AFTER photo' : 'Snap AFTER photo'}
                  className={primaryBtn}
                  onPhoto={async (file) => setRaid(await onAfterPhoto(file))}
                />
                <button className={secondaryBtn} onClick={() => setPhase('card')}>
                  {raid.afterPhotoId ? 'Make my win card' : 'Skip photo, make win card'}
                </button>
              </div>
            </motion.div>
          )}

          {phase === 'card' && (
            <motion.div key="card" className="flex w-full flex-col items-center gap-4 pb-2" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <div className="aspect-[4/5] w-full overflow-hidden rounded-3xl bg-black/40 ring-1 ring-white/10">
                {cardUrl ? (
                  <img src={cardUrl} alt="Your win card" className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full place-items-center text-ash">Forging your card…</div>
                )}
              </div>
              {canShare && (
                <button className={primaryBtn} onClick={share}>
                  Share
                </button>
              )}
              {cardUrl && (
                <a className={canShare ? secondaryBtn : primaryBtn} href={cardUrl} download={fileName}>
                  Save image
                </a>
              )}
              <button className="py-2 font-semibold text-ash" onClick={onDone}>
                Back to the dungeon
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
