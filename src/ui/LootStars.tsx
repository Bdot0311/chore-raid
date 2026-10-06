import { MAX_LOOT_STARS } from '../game/tuning';

/** Loot Stars decide the rarity of the drop. Beating wind-ups earns them; missing one lets the boss heal its Ward. */
export function LootStars({ stars }: { stars: number }) {
  return (
    <div className="flex items-center gap-1.5" aria-label={`${stars} of ${MAX_LOOT_STARS} loot stars`}>
      <span className="mr-1 text-[11px] font-bold uppercase tracking-widest text-gold/80">Loot</span>
      {Array.from({ length: MAX_LOOT_STARS }, (_, i) => (
        <svg key={i} viewBox="0 0 24 24" className={`h-5 w-5 transition-all duration-300 ${i < stars ? 'scale-100' : 'scale-90 opacity-30'}`}>
          <path
            d="M12 2.5l2.9 6 6.6.8-4.9 4.6 1.3 6.5L12 17.2 6.1 20.4l1.3-6.5L2.5 9.3l6.6-.8z"
            fill={i < stars ? 'var(--color-gold)' : 'none'}
            stroke="var(--color-gold)"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      ))}
    </div>
  );
}
