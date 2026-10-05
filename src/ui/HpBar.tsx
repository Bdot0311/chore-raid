interface Props {
  hp: number;
  max: number;
  hue: number;
}

const MAX_SEGMENTS = 40;

/** One segment per item, so a hit visibly removes exactly one. Big piles fall back to a smooth bar. */
export function HpBar({ hp, max, hue }: Props) {
  const fill = `hsl(${hue} 80% 60%)`;
  if (max > MAX_SEGMENTS) {
    return (
      <div className="h-5 w-full overflow-hidden rounded-md bg-dungeon-800 ring-1 ring-dungeon-600">
        <div
          className="h-full rounded-md transition-[width] duration-300"
          style={{ width: `${(hp / max) * 100}%`, background: fill }}
        />
      </div>
    );
  }
  return (
    <div className="flex h-5 w-full gap-[3px]" role="meter" aria-valuenow={hp} aria-valuemax={max}>
      {Array.from({ length: max }, (_, i) => (
        <div
          key={i}
          className="h-full flex-1 rounded-sm transition-colors duration-300"
          style={{ background: i < hp ? fill : 'var(--color-dungeon-800)' }}
        />
      ))}
    </div>
  );
}
