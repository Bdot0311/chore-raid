import { motion } from 'motion/react';
import { heroLevel, WEAPONS } from '../game/progression';
import type { Profile } from '../game/types';
import { HeroPicker } from './HeroPicker';
import { XpBar } from './XpBar';

interface Props {
  profile: Profile;
  onEquip: (weaponId: string) => void;
  onHero: (heroClass: string) => void;
  onBack: () => void;
}

/** Weapons unlock with hero levels; each one changes the blade and its slash trails. */
export function Armory({ profile, onEquip, onHero, onBack }: Props) {
  const level = heroLevel(profile.xp);
  const equipped = WEAPONS.some((w) => w.id === profile.equippedSkin) ? profile.equippedSkin : 'broomblade';

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_50%_0%,#3a2d12,var(--color-dungeon-950)_60%)]">
      <div className="safe-pad mx-auto flex min-h-full max-w-md flex-col gap-5">
        <button className="self-start py-2 text-sm font-semibold text-ash" onClick={onBack}>
          ← Map
        </button>
        <header className="text-center">
          <h1 className="font-display text-4xl text-gold drop-shadow-[0_3px_0_#0d0b1a]">Armory</h1>
          <p className="mt-1 text-sm text-ash">Level up by finishing chores to unlock new weapons.</p>
        </header>
        <XpBar xp={profile.xp} />
        <section className="space-y-2">
          <h2 className="font-display text-xl text-white">Your hero</h2>
          <HeroPicker value={profile.heroClass} onChange={onHero} />
        </section>
        <h2 className="font-display text-xl text-white">Weapon glow</h2>
        <div className="space-y-3 pb-2">
          {WEAPONS.map((w, i) => {
            const unlocked = level >= w.unlockLevel;
            const on = equipped === w.id;
            const hex = `#${w.trail.toString(16).padStart(6, '0')}`;
            return (
              <motion.button
                key={w.id}
                disabled={!unlocked}
                onClick={() => onEquip(w.id)}
                className={`flex w-full items-center gap-4 rounded-3xl p-3 text-left ring-2 transition ${
                  on ? 'bg-white/10' : 'bg-black/30'
                } ${unlocked ? 'active:scale-[0.98]' : 'opacity-60'}`}
                style={{ ['--tw-ring-color' as string]: on ? hex : 'rgba(255,255,255,0.08)' }}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: unlocked ? 1 : 0.6 }}
                transition={{ delay: i * 0.06 }}
              >
                <div
                  className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl"
                  style={{ background: `radial-gradient(circle, ${hex}55, #0d0b1a)` }}
                >
                  <img
                    src="/art/weapon.webp"
                    alt=""
                    className="absolute inset-0 h-full w-full object-contain p-1"
                    style={{ filter: unlocked ? `drop-shadow(0 0 8px ${hex})` : 'grayscale(1) brightness(0.4)' }}
                  />
                  {!unlocked && <div className="absolute inset-0 grid place-items-center text-2xl">🔒</div>}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-xl text-white">{w.name}</p>
                  <p className="text-sm text-ash">{w.blurb}</p>
                  <p className="mt-1 text-xs font-bold uppercase tracking-widest" style={{ color: unlocked ? hex : undefined }}>
                    {on ? 'Equipped' : unlocked ? 'Tap to equip' : `Unlocks at level ${w.unlockLevel}`}
                  </p>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
